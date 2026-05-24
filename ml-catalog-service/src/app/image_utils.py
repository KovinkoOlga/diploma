import base64
import io

import numpy as np
from PIL import Image, ImageFilter, UnidentifiedImageError


LIGHT_BACKGROUND = (248, 248, 248)


def _open_image(content: bytes, mode: str, label: str) -> Image.Image:
    if not content:
        raise ValueError(f"{label} image is empty")
    try:
        image = Image.open(io.BytesIO(content))
        image.load()
        return image.convert(mode)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ValueError(f"Invalid {label} image bytes") from exc


def read_rgba(content: bytes) -> Image.Image:
    return _open_image(content, "RGBA", "RGBA")


def read_mask(content: bytes) -> Image.Image:
    return _open_image(content, "L", "mask")


def encode_png(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def encode_png_base64(image: Image.Image) -> str:
    return base64.b64encode(encode_png(image)).decode("utf-8")


def _fallback_cutout(original_bytes: bytes) -> Image.Image:
    try:
        return read_rgba(original_bytes)
    except ValueError as exc:
        raise ValueError("Both cutout and original images are unavailable") from exc


def _extract_foreground(
    *,
    original: Image.Image,
    cutout: Image.Image,
    mask: Image.Image,
    bbox: tuple[int, int, int, int],
    alpha_bbox: tuple[int, int, int, int] | None,
) -> Image.Image:
    cutout_crop = cutout.crop(bbox)
    if alpha_bbox is not None:
        return cutout_crop

    original_crop = original.crop(bbox)
    mask_crop = mask.crop(bbox)
    transparent = Image.new("RGBA", original_crop.size, (0, 0, 0, 0))
    return Image.composite(original_crop, transparent, mask_crop)


def _fit_on_square(foreground: Image.Image, output_size: int, margin_ratio: float = 0.12) -> Image.Image:
    if output_size <= 0:
        raise ValueError("output_size must be greater than 0")

    available = max(1, int(output_size * (1.0 - 2 * margin_ratio)))
    fg = foreground.convert("RGBA")
    width, height = fg.size
    if width <= 0 or height <= 0:
        raise ValueError("Foreground image has invalid size")

    scale = min(available / width, available / height)
    new_size = (max(1, int(round(width * scale))), max(1, int(round(height * scale))))
    resized = fg.resize(new_size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (output_size, output_size), (*LIGHT_BACKGROUND, 255))
    offset = ((output_size - resized.width) // 2, (output_size - resized.height) // 2)
    canvas.alpha_composite(resized, offset)
    return canvas.convert("RGB")


def estimate_background_color_from_corners(image: Image.Image, sample_size: int = 24) -> np.ndarray:
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    height, width, _ = rgb.shape
    sample = max(1, min(sample_size, height // 4, width // 4))
    patches = [
        rgb[:sample, :sample],
        rgb[:sample, width - sample : width],
        rgb[height - sample : height, :sample],
        rgb[height - sample : height, width - sample : width],
    ]
    corners = np.concatenate([patch.reshape(-1, 3) for patch in patches], axis=0)
    return corners.mean(axis=0)


def _corner_similarity_check(image: Image.Image, sample_size: int = 24, max_std: float = 24.0) -> bool:
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    height, width, _ = rgb.shape
    sample = max(1, min(sample_size, height // 4, width // 4))
    patches = np.concatenate(
        [
            rgb[:sample, :sample].reshape(-1, 3),
            rgb[:sample, width - sample : width].reshape(-1, 3),
            rgb[height - sample : height, :sample].reshape(-1, 3),
            rgb[height - sample : height, width - sample : width].reshape(-1, 3),
        ],
        axis=0,
    )
    return float(np.std(patches, axis=0).mean()) <= max_std


def _corner_lightness_check(background_color: np.ndarray, min_lightness: float = 170.0) -> bool:
    return float(background_color.mean()) >= min_lightness


def _alpha_coverage(alpha: np.ndarray, cutoff: int = 24) -> float:
    return float((alpha >= cutoff).mean())


def remove_light_background_to_alpha(
    image: Image.Image,
    *,
    threshold: float,
    feather: float,
    alpha_floor: int = 40,
    preserve_contrast_threshold: float = 36.0,
) -> tuple[Image.Image, dict[str, float | bool]]:
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    background = estimate_background_color_from_corners(image)
    corner_similar = _corner_similarity_check(image)
    corner_light = _corner_lightness_check(background)

    if not corner_light:
        rgba = np.dstack([rgb.astype(np.uint8), np.full(rgb.shape[:2], 255, dtype=np.uint8)])
        coverage = _alpha_coverage(rgba[:, :, 3])
        return Image.fromarray(rgba, mode="RGBA"), {
            "corner_similarity_ok": corner_similar,
            "corner_lightness_ok": corner_light,
            "effective_threshold": 0.0,
            "effective_feather": 0.0,
            "alpha_coverage": coverage,
            "background_removal_disabled": True,
        }

    effective_threshold = float(max(1.0, threshold))
    effective_feather = float(max(1.0, feather))
    if not corner_similar:
        effective_threshold *= 0.55
        effective_feather *= 1.35

    dist = np.linalg.norm(rgb - background, axis=2)
    alpha = np.clip((dist - effective_threshold) / effective_feather, 0.0, 1.0) * 255.0

    # Keep low-alpha floor around strong-contrast edges to avoid eating light garments.
    contrast_mask = dist >= preserve_contrast_threshold
    alpha = np.where(contrast_mask, np.maximum(alpha, alpha_floor), alpha)

    rgba = np.dstack([rgb.astype(np.uint8), np.clip(alpha, 0.0, 255.0).astype(np.uint8)])
    coverage = _alpha_coverage(rgba[:, :, 3])
    return Image.fromarray(rgba, mode="RGBA"), {
        "corner_similarity_ok": corner_similar,
        "corner_lightness_ok": corner_light,
        "effective_threshold": effective_threshold,
        "effective_feather": effective_feather,
        "alpha_coverage": coverage,
    }


def recrop_rgba_by_alpha(image: Image.Image, margin_ratio: float = 0.06) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return rgba

    left, top, right, bottom = bbox
    obj_w = max(1, right - left)
    obj_h = max(1, bottom - top)
    pad = max(2, int(round(max(obj_w, obj_h) * max(0.0, margin_ratio))))
    crop_box = (
        max(0, left - pad),
        max(0, top - pad),
        min(rgba.width, right + pad),
        min(rgba.height, bottom + pad),
    )
    if crop_box[2] <= crop_box[0] or crop_box[3] <= crop_box[1]:
        return rgba
    return rgba.crop(crop_box)


def fit_rgba_to_square_canvas(
    image: Image.Image,
    output_size: int,
    margin_ratio: float = 0.06,
    *,
    transparent_background: bool = True,
) -> Image.Image:
    if output_size <= 0:
        raise ValueError("output_size must be greater than 0")

    rgba = image.convert("RGBA")
    alpha_bbox = rgba.getchannel("A").getbbox()
    if alpha_bbox is not None:
        rgba = rgba.crop(alpha_bbox)

    width, height = rgba.size
    if width <= 0 or height <= 0:
        raise ValueError("Image has invalid size")

    safe_margin = min(0.45, max(0.0, margin_ratio))
    available = max(1, int(output_size * (1.0 - 2.0 * safe_margin)))
    scale = min(available / width, available / height)
    resized = rgba.resize(
        (max(1, int(round(width * scale))), max(1, int(round(height * scale)))),
        Image.Resampling.LANCZOS,
    )

    if transparent_background:
        canvas = Image.new("RGBA", (output_size, output_size), (0, 0, 0, 0))
    else:
        canvas = Image.new("RGBA", (output_size, output_size), (*LIGHT_BACKGROUND, 255))
    offset = ((output_size - resized.width) // 2, (output_size - resized.height) // 2)
    canvas.alpha_composite(resized, offset)
    return canvas if transparent_background else canvas.convert("RGB")


def apply_soft_post_sharpen(
    image: Image.Image,
    *,
    enabled: bool,
    radius: float,
    percent: int,
    threshold: int,
) -> Image.Image:
    if not enabled:
        return image

    sharpen_filter = ImageFilter.UnsharpMask(
        radius=float(max(0.1, radius)),
        percent=int(max(1, percent)),
        threshold=int(max(0, threshold)),
    )
    source = image.convert("RGBA") if image.mode == "RGBA" else image.convert("RGB")

    if source.mode == "RGBA":
        red, green, blue, alpha = source.split()
        rgb = Image.merge("RGB", (red, green, blue)).filter(sharpen_filter)
        out = rgb.convert("RGBA")
        out.putalpha(alpha)
        return out
    return source.filter(sharpen_filter)


def postprocess_catalog_result(
    image: Image.Image,
    *,
    output_size: int,
    margin_ratio: float = 0.06,
    transparent_background: bool = True,
    threshold: float = 30.0,
    feather: float = 20.0,
    min_alpha_coverage: float = 0.08,
    post_sharpen_enabled: bool = True,
    post_sharpen_radius: float = 0.6,
    post_sharpen_percent: int = 80,
    post_sharpen_threshold: int = 3,
) -> tuple[Image.Image, dict[str, float | bool]]:
    rgb = image.convert("RGB")
    debug: dict[str, float | bool] = {
        "transparent_background": bool(transparent_background),
        "background_threshold": float(threshold),
        "background_feather": float(feather),
        "result_margin_ratio": float(margin_ratio),
        "post_sharpen_enabled": bool(post_sharpen_enabled),
        "post_sharpen_radius": float(post_sharpen_radius),
        "post_sharpen_percent": int(post_sharpen_percent),
        "post_sharpen_threshold": int(post_sharpen_threshold),
    }

    if transparent_background:
        first_pass, first_meta = remove_light_background_to_alpha(rgb, threshold=threshold, feather=feather)
        debug.update({f"pass1_{key}": value for key, value in first_meta.items()})

        if float(first_meta["alpha_coverage"]) < min_alpha_coverage:
            second_threshold = max(6.0, float(threshold) * 0.55)
            second_feather = max(10.0, float(feather) * 1.6)
            second_pass, second_meta = remove_light_background_to_alpha(
                rgb,
                threshold=second_threshold,
                feather=second_feather,
            )
            debug["fallback_pass_used"] = True
            debug["pass2_threshold"] = second_threshold
            debug["pass2_feather"] = second_feather
            debug.update({f"pass2_{key}": value for key, value in second_meta.items()})
            processed = second_pass if float(second_meta["alpha_coverage"]) >= min_alpha_coverage else rgb.convert("RGBA")
            if processed is not second_pass:
                debug["alpha_guard_fallback_original"] = True
        else:
            debug["fallback_pass_used"] = False
            processed = first_pass
    else:
        processed = rgb.convert("RGBA")
        debug["fallback_pass_used"] = False

    recropped = recrop_rgba_by_alpha(processed, margin_ratio=margin_ratio)
    fitted = fit_rgba_to_square_canvas(
        recropped,
        output_size=output_size,
        margin_ratio=margin_ratio,
        transparent_background=transparent_background,
    )
    sharpened = apply_soft_post_sharpen(
        fitted,
        enabled=post_sharpen_enabled,
        radius=post_sharpen_radius,
        percent=post_sharpen_percent,
        threshold=post_sharpen_threshold,
    )
    return sharpened, debug


def prepare_catalog_input(
    original_bytes: bytes,
    cutout_bytes: bytes,
    mask_bytes: bytes,
    output_size: int = 512,
) -> Image.Image:
    try:
        cutout = read_rgba(cutout_bytes)
    except ValueError:
        cutout = _fallback_cutout(original_bytes)

    mask = read_mask(mask_bytes)
    if mask.size != cutout.size:
        mask = mask.resize(cutout.size, Image.Resampling.NEAREST)

    alpha_bbox = cutout.getchannel("A").getbbox()
    mask_bbox = mask.getbbox()
    bbox = alpha_bbox or mask_bbox or (0, 0, cutout.width, cutout.height)

    original = read_rgba(original_bytes) if original_bytes else cutout
    if original.size != cutout.size:
        original = original.resize(cutout.size, Image.Resampling.LANCZOS)

    foreground = _extract_foreground(
        original=original,
        cutout=cutout,
        mask=mask,
        bbox=bbox,
        alpha_bbox=alpha_bbox,
    )

    return _fit_on_square(foreground, output_size=output_size)


def composite_stub_catalog(
    original_bytes: bytes,
    cutout_bytes: bytes,
    mask_bytes: bytes,
    output_size: int = 512,
) -> Image.Image:
    return prepare_catalog_input(
        original_bytes=original_bytes,
        cutout_bytes=cutout_bytes,
        mask_bytes=mask_bytes,
        output_size=output_size,
    )
