from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from app.core.config import get_settings
from app.utils.image_io import load_rgb_image, pil_image_to_png_bytes
from app.utils.mask_processing import blur_mask, ensure_odd_kernel_size, postprocess_mask, resize_mask_to_image


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


@dataclass
class BackgroundRemovalResult:
    cutout_image: bytes
    mask_image: bytes
    mime_type: str
    model_name: str


def create_transparent_cutout(image: np.ndarray, alpha_mask: np.ndarray) -> Image.Image:
    if alpha_mask.shape[:2] != image.shape[:2]:
        alpha_mask = resize_mask_to_image(alpha_mask, image, interpolation=cv2.INTER_LINEAR)
    alpha = (np.clip(alpha_mask, 0.0, 1.0) * 255).astype(np.uint8)
    rgba = np.dstack([image, alpha])
    return Image.fromarray(rgba)


class BackgroundRemovalService:
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

    def remove_background(self, image_bytes: bytes) -> BackgroundRemovalResult:
        settings = get_settings()
        pil_image = load_rgb_image(image_bytes)
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
        blur_kernel_size = ensure_odd_kernel_size(settings.bg_blur_kernel_size)
        if blur_kernel_size > 1:
            alpha_mask_original = blur_mask(alpha_mask_original, blur_kernel_size)
            alpha_mask_original = np.maximum(alpha_mask_original, core_mask_original)

        alpha_mask_original = np.clip(alpha_mask_original, 0.0, 1.0)
        if np.any(processed_mask_original > 0):
            alpha_mask_original[processed_mask_original > 0] = np.maximum(
                alpha_mask_original[processed_mask_original > 0],
                1e-3,
            )

        cutout = create_transparent_cutout(image, alpha_mask_original)
        mask_image = Image.fromarray((alpha_mask_original * 255).astype(np.uint8))
        return BackgroundRemovalResult(
            cutout_image=pil_image_to_png_bytes(cutout),
            mask_image=pil_image_to_png_bytes(mask_image),
            mime_type="image/png",
            model_name=self._model_name,
        )
