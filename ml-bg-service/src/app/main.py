import base64
import io
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile
from PIL import Image
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    bg_model_path: str = "/app/models/model.keras"
    category_classifier_impl: str = "stub"
    bg_enable_stub: bool = False
    bg_img_size: int = 320
    bg_threshold: float = 0.5
    bg_low_threshold: float = 0.3
    bg_high_threshold: float = 0.7
    bg_min_area: int = 64
    bg_min_area_ratio: float = 0.003
    bg_max_hole_area: int = 128
    bg_close_kernel_size: int = 9
    bg_blur_kernel_size: int = 5


@lru_cache
def get_settings() -> Settings:
    return Settings()


class StubCategoryClassifier:
    def predict(self, image: np.ndarray) -> dict:
        return {
            "category_id": "tops",
            "subcategory": "",
            "label": "Stub category suggestion",
        }


def dice_coefficient(y_true, y_pred, smooth: float = 1e-6):
    import tensorflow as tf

    y_true = tf.cast(y_true, tf.float32)
    y_pred = tf.cast(y_pred, tf.float32)
    y_true = tf.reshape(y_true, [-1])
    y_pred = tf.reshape(y_pred, [-1])
    intersection = tf.reduce_sum(y_true * y_pred)
    denominator = tf.reduce_sum(y_true) + tf.reduce_sum(y_pred)
    return (2.0 * intersection + smooth) / (denominator + smooth)


def dice_loss(y_true, y_pred):
    return 1.0 - dice_coefficient(y_true, y_pred)


def bce_dice_loss(y_true, y_pred):
    import tensorflow as tf

    bce = tf.keras.losses.binary_crossentropy(y_true, y_pred)
    return tf.reduce_mean(bce) + dice_loss(y_true, y_pred)


def iou_metric(y_true, y_pred, smooth: float = 1e-6):
    import tensorflow as tf

    y_true = tf.cast(y_true, tf.float32)
    y_pred = tf.cast(y_pred > 0.5, tf.float32)
    y_true = tf.reshape(y_true, [-1])
    y_pred = tf.reshape(y_pred, [-1])
    intersection = tf.reduce_sum(y_true * y_pred)
    union = tf.reduce_sum(y_true) + tf.reduce_sum(y_pred) - intersection
    return (intersection + smooth) / (union + smooth)


def preprocess_mask(mask: np.ndarray, threshold: float = 0.5) -> np.ndarray:
    if mask.ndim == 3:
        mask = np.squeeze(mask)
    if mask.max() > 1:
        mask = mask / 255.0
    return (mask >= threshold).astype(np.uint8)


def normalize_probability_mask(mask: np.ndarray) -> np.ndarray:
    if mask.ndim == 3:
        mask = np.squeeze(mask)
    mask = mask.astype(np.float32)
    if mask.max() > 1:
        mask = mask / 255.0
    return np.clip(mask, 0.0, 1.0)


def _odd_kernel_size(kernel_size: int) -> int:
    kernel_size = max(1, int(kernel_size))
    if kernel_size % 2 == 0:
        kernel_size += 1
    return kernel_size


def _connected_components(mask: np.ndarray) -> tuple[int, np.ndarray, np.ndarray]:
    mask_uint8 = (mask.astype(np.uint8) * 255).astype(np.uint8)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask_uint8, connectivity=8)
    return num_labels, labels, stats


def _largest_component_mask(mask: np.ndarray) -> np.ndarray:
    num_labels, labels, stats = _connected_components(mask)
    if num_labels <= 1:
        return np.zeros_like(mask, dtype=np.uint8)

    largest_label = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    return (labels == largest_label).astype(np.uint8)


def _keep_components_by_area(mask: np.ndarray, min_area: int) -> np.ndarray:
    num_labels, labels, stats = _connected_components(mask)
    if num_labels <= 1:
        return np.zeros_like(mask, dtype=np.uint8)

    cleaned = np.zeros_like(mask, dtype=np.uint8)
    for label in range(1, num_labels):
        if stats[label, cv2.CC_STAT_AREA] >= min_area:
            cleaned[labels == label] = 1
    return cleaned


def _keep_low_components_linked_to_core(low_mask: np.ndarray, high_mask: np.ndarray) -> np.ndarray:
    num_labels, labels, stats = _connected_components(low_mask)
    if num_labels <= 1:
        return np.zeros_like(low_mask, dtype=np.uint8)

    linked = np.zeros_like(low_mask, dtype=np.uint8)
    for label in range(1, num_labels):
        component = labels == label
        if np.any(high_mask[component] > 0):
            linked[component] = 1
    return linked


def _fill_small_holes(mask: np.ndarray, max_hole_area: int) -> np.ndarray:
    inverted = 1 - mask.astype(np.uint8)
    num_labels, labels, stats = _connected_components(inverted)
    filled = mask.copy().astype(np.uint8)
    height, width = mask.shape

    for label in range(1, num_labels):
        area = stats[label, cv2.CC_STAT_AREA]
        if area > max_hole_area:
            continue

        x = stats[label, cv2.CC_STAT_LEFT]
        y = stats[label, cv2.CC_STAT_TOP]
        w = stats[label, cv2.CC_STAT_WIDTH]
        h = stats[label, cv2.CC_STAT_HEIGHT]
        touches_border = x == 0 or y == 0 or (x + w) >= width or (y + h) >= height
        if touches_border:
            continue

        filled[labels == label] = 1
    return filled


def _smoothstep(values: np.ndarray, low: float, high: float) -> np.ndarray:
    if high <= low:
        return (values >= high).astype(np.float32)
    scaled = np.clip((values - low) / (high - low), 0.0, 1.0)
    return scaled * scaled * (3.0 - 2.0 * scaled)


def postprocess_mask(
    probability_mask: np.ndarray,
    threshold: float,
    low_threshold: float,
    high_threshold: float,
    min_area: int,
    min_area_ratio: float,
    max_hole_area: int,
    close_kernel_size: int,
    blur_kernel_size: int,
) -> tuple[np.ndarray, np.ndarray]:
    probabilities = normalize_probability_mask(probability_mask)

    low = float(np.clip(min(low_threshold, high_threshold, threshold), 0.0, 1.0))
    high = float(np.clip(max(low_threshold, high_threshold, threshold), 0.0, 1.0))
    if high <= low:
        high = min(1.0, low + 0.1)

    low_mask = (probabilities >= low).astype(np.uint8)
    high_mask = (probabilities >= high).astype(np.uint8)

    if np.any(high_mask):
        support_mask = _keep_low_components_linked_to_core(low_mask, high_mask)
    elif np.any(low_mask):
        support_mask = _largest_component_mask(low_mask)
    else:
        return np.zeros_like(probabilities, dtype=np.uint8), np.zeros_like(probabilities, dtype=np.float32)

    largest_support = _largest_component_mask(support_mask)
    largest_area = int(np.count_nonzero(largest_support))
    dynamic_min_area = max(int(min_area), int(largest_area * max(0.0, min_area_ratio)))
    support_mask = _keep_components_by_area(support_mask, dynamic_min_area)
    support_mask = _fill_small_holes(support_mask, max_hole_area)

    if not np.any(support_mask):
        support_mask = largest_support

    alpha = _smoothstep(probabilities, low, high)
    alpha *= support_mask.astype(np.float32)

    core_mask = (high_mask & support_mask).astype(np.uint8)
    if np.any(core_mask):
        alpha = np.maximum(alpha, core_mask.astype(np.float32))

    return support_mask.astype(np.uint8), np.clip(alpha, 0.0, 1.0)


def resize_mask_to_image(mask: np.ndarray, image: np.ndarray, interpolation: int = cv2.INTER_NEAREST) -> np.ndarray:
    height, width = image.shape[:2]
    return cv2.resize(mask.astype(np.float32), (width, height), interpolation=interpolation)


def create_transparent_cutout(image: np.ndarray, alpha_mask: np.ndarray) -> Image.Image:
    if alpha_mask.shape[:2] != image.shape[:2]:
        alpha_mask = resize_mask_to_image(alpha_mask, image, interpolation=cv2.INTER_LINEAR)
    alpha = (np.clip(alpha_mask, 0.0, 1.0) * 255).astype(np.uint8)
    rgba = np.dstack([image, alpha])
    return Image.fromarray(rgba)


class BackgroundRemover:
    def __init__(self) -> None:
        self._model = None
        self._model_name = "stub"

    def _load_model(self):
        settings = get_settings()
        if self._model is not None:
            return self._model

        model_path = Path(settings.bg_model_path)
        if not model_path.exists():
            if settings.bg_enable_stub:
                return None
            raise FileNotFoundError(f"Background model not found: {model_path}")

        import tensorflow as tf

        self._model = tf.keras.models.load_model(
            model_path,
            custom_objects={
                "bce_dice_loss": bce_dice_loss,
                "dice_loss": dice_loss,
                "dice_coefficient": dice_coefficient,
                "iou_metric": iou_metric,
            },
        )
        self._model_name = model_path.name
        return self._model

    def _stub_probability_mask(self, image: np.ndarray) -> np.ndarray:
        return np.ones((image.shape[0], image.shape[1]), dtype=np.float32)

    def _predict_probability_mask(self, image: np.ndarray) -> np.ndarray:
        model = self._load_model()
        settings = get_settings()
        if model is None:
            return self._stub_probability_mask(image)

        resized = cv2.resize(image, (settings.bg_img_size, settings.bg_img_size), interpolation=cv2.INTER_AREA)
        batch = np.expand_dims(resized.astype(np.float32), axis=0)
        probability_mask = model.predict(batch, verbose=0)[0, ..., 0]
        return probability_mask

    def process(self, image_bytes: bytes) -> dict:
        settings = get_settings()
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image = np.array(pil_image)
        probability_mask = self._predict_probability_mask(image)
        processed_mask, alpha_mask = postprocess_mask(
            probability_mask,
            threshold=settings.bg_threshold,
            low_threshold=settings.bg_low_threshold,
            high_threshold=settings.bg_high_threshold,
            min_area=settings.bg_min_area,
            min_area_ratio=settings.bg_min_area_ratio,
            max_hole_area=settings.bg_max_hole_area,
            close_kernel_size=settings.bg_close_kernel_size,
            blur_kernel_size=settings.bg_blur_kernel_size,
        )
        processed_mask_original = resize_mask_to_image(processed_mask, image, interpolation=cv2.INTER_NEAREST)
        alpha_mask_original = resize_mask_to_image(alpha_mask, image, interpolation=cv2.INTER_LINEAR)

        support_gate = resize_mask_to_image(processed_mask, image, interpolation=cv2.INTER_LINEAR)
        alpha_mask_original *= np.clip(support_gate, 0.0, 1.0)

        core_mask_original = (alpha_mask_original >= 0.98).astype(np.float32)
        blur_kernel_size = _odd_kernel_size(settings.bg_blur_kernel_size)
        if blur_kernel_size > 1:
            alpha_mask_original = cv2.GaussianBlur(alpha_mask_original, (blur_kernel_size, blur_kernel_size), 0)
            alpha_mask_original = np.maximum(alpha_mask_original, core_mask_original)

        alpha_mask_original = np.clip(alpha_mask_original, 0.0, 1.0)
        if np.any(processed_mask_original > 0):
            alpha_mask_original[processed_mask_original > 0] = np.maximum(
                alpha_mask_original[processed_mask_original > 0],
                1e-3,
            )

        cutout = create_transparent_cutout(image, alpha_mask_original)
        mask_image = Image.fromarray((alpha_mask_original * 255).astype(np.uint8))
        classifier = StubCategoryClassifier()
        return {
            "cutout_image": _image_to_base64(cutout),
            "mask_image": _image_to_base64(mask_image),
            "mime_type": "image/png",
            "category_prediction": classifier.predict(image),
            "model": self._model_name,
        }


def _image_to_base64(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


service = BackgroundRemover()
app = FastAPI(title="ML Background Removal Service", version="0.1.0")


@app.get("/health")
async def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "model_path": settings.bg_model_path,
        "stub_enabled": settings.bg_enable_stub,
        "img_size": settings.bg_img_size,
        "threshold": settings.bg_threshold,
        "low_threshold": settings.bg_low_threshold,
        "high_threshold": settings.bg_high_threshold,
        "min_area": settings.bg_min_area,
    }


@app.post("/v1/remove-background")
async def remove_background(image: UploadFile = File(...)) -> dict:
    content = await image.read()
    return service.process(content)
