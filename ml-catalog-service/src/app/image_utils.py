from __future__ import annotations

import base64
import io
from typing import Iterable

from PIL import Image, ImageChops, ImageFilter, ImageOps


def decode_rgba(content: bytes) -> Image.Image:
    return Image.open(io.BytesIO(content)).convert("RGBA")


def decode_mask(content: bytes) -> Image.Image:
    return Image.open(io.BytesIO(content)).convert("L")


def encode_png(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def encode_png_base64(image: Image.Image) -> str:
    return base64.b64encode(encode_png(image)).decode("utf-8")


def resize_to_output_size(
    image: Image.Image,
    output_size: int,
    resample: int = Image.Resampling.LANCZOS,
) -> Image.Image:
    if image.size == (output_size, output_size):
        return image
    return image.resize((output_size, output_size), resample)


def compose_rgba_on_light_background(
    image: Image.Image,
    background: tuple[int, int, int] = (248, 248, 248),
) -> Image.Image:
    rgba = image.convert("RGBA")
    canvas = Image.new("RGBA", rgba.size, (*background, 255))
    canvas.alpha_composite(rgba)
    return canvas.convert("RGB")


def _safe_decode_image(content: bytes | None, decoder) -> Image.Image | None:
    if not content:
        return None
    try:
        return decoder(content)
    except Exception:
        return None


def _binary_mask_from_grayscale(mask: Image.Image, alpha_threshold: int) -> Image.Image:
    grayscale = mask.convert("L")
    return grayscale.point(lambda value: 255 if int(value) >= alpha_threshold else 0, mode="L")


def _binary_mask_from_alpha(image: Image.Image, alpha_threshold: int) -> Image.Image:
    return _binary_mask_from_grayscale(image.getchannel("A"), alpha_threshold)


def mask_coverage_stats(mask: Image.Image, alpha_threshold: int = 8) -> dict[str, float | int | bool]:
    grayscale = mask.convert("L")
    histogram = grayscale.histogram()
    total_pixels = max(1, grayscale.width * grayscale.height)
    active_pixels = sum(int(count) for count in histogram[alpha_threshold:])
    return {
        "active_pixels": active_pixels,
        "total_pixels": total_pixels,
        "coverage_ratio": active_pixels / total_pixels,
        "is_empty": active_pixels == 0,
        "is_nearly_full": active_pixels / total_pixels >= 0.96,
    }


def build_inpaint_init_image(original_bytes: bytes, output_size: int) -> Image.Image:
    original = resize_to_output_size(decode_rgba(original_bytes), output_size)
    return compose_rgba_on_light_background(original)


def build_ip_adapter_reference_image(cutout_bytes: bytes, output_size: int) -> Image.Image:
    cutout = resize_to_output_size(decode_rgba(cutout_bytes), output_size)
    return compose_rgba_on_light_background(cutout)


def expand_mask(mask: Image.Image, expand_px: int) -> Image.Image:
    if expand_px <= 0:
        return mask.convert("L")
    size = max(3, expand_px * 2 + 1)
    if size % 2 == 0:
        size += 1
    return mask.convert("L").filter(ImageFilter.MaxFilter(size=size))


def blur_mask(mask: Image.Image, blur_px: int) -> Image.Image:
    if blur_px <= 0:
        return mask.convert("L")
    return mask.convert("L").filter(ImageFilter.GaussianBlur(radius=blur_px))


def build_full_item_inpaint_mask(
    mask_bytes: bytes,
    cutout_bytes: bytes,
    output_size: int,
    alpha_threshold: int,
    expand_px: int,
    blur_px: int,
) -> Image.Image:
    warnings: list[str] = []
    primary_mask = _safe_decode_image(mask_bytes, decode_mask)
    cutout = _safe_decode_image(cutout_bytes, decode_rgba)

    base_mask: Image.Image | None = None
    mask_source = "mask"
    if primary_mask is not None:
        base_mask = resize_to_output_size(primary_mask, output_size, resample=Image.Resampling.NEAREST)
        base_mask = _binary_mask_from_grayscale(base_mask, alpha_threshold)
    if base_mask is None or base_mask.getbbox() is None:
        if cutout is not None:
            cutout = resize_to_output_size(cutout, output_size)
            base_mask = _binary_mask_from_alpha(cutout, alpha_threshold)
            mask_source = "cutout_alpha"
            warnings.append("mask_bytes_unusable_fallback_to_cutout_alpha")

    if base_mask is None or base_mask.getbbox() is None:
        base_mask = Image.new("L", (output_size, output_size), 255)
        mask_source = "full_canvas_fallback"
        warnings.append("mask_empty_fallback_to_full_canvas")

    before_expand_stats = mask_coverage_stats(base_mask, alpha_threshold)
    expanded_mask = expand_mask(base_mask, expand_px)
    expanded_stats = mask_coverage_stats(expanded_mask, alpha_threshold)
    guarded_mask = expanded_mask
    if expanded_stats["coverage_ratio"] >= 0.96 and before_expand_stats["coverage_ratio"] < 0.96:
        guarded_mask = base_mask
        warnings.append("mask_expand_guardrail_reverted_to_base_mask")

    blurred_mask = blur_mask(guarded_mask, blur_px)
    after_blur_stats = mask_coverage_stats(blurred_mask, alpha_threshold)
    if after_blur_stats["coverage_ratio"] >= 0.985 and before_expand_stats["coverage_ratio"] < 0.96:
        blurred_mask = base_mask
        after_blur_stats = mask_coverage_stats(blurred_mask, alpha_threshold)
        warnings.append("mask_blur_guardrail_reverted_to_base_mask")

    if blurred_mask.getbbox() is None:
        blurred_mask = Image.new("L", (output_size, output_size), 255)
        after_blur_stats = mask_coverage_stats(blurred_mask, alpha_threshold)
        warnings.append("mask_final_empty_fallback_to_full_canvas")

    blurred_mask.info["mask_debug"] = {
        "mask_mode": "full_item",
        "mask_semantics": {"white": "repaint", "black": "preserve"},
        "mask_source": mask_source,
        "coverage_before_expand": before_expand_stats,
        "coverage_after_expand": expanded_stats,
        "coverage_after_blur": after_blur_stats,
        "warnings": warnings,
    }
    return blurred_mask


def estimate_background_color_from_corners(image: Image.Image, sample_size: int = 16) -> tuple[int, int, int]:
    rgb = image.convert("RGB")
    width, height = rgb.size
    sample = max(1, min(sample_size, width, height))
    boxes = [
        (0, 0, sample, sample),
        (max(0, width - sample), 0, width, sample),
        (0, max(0, height - sample), sample, height),
        (max(0, width - sample), max(0, height - sample), width, height),
    ]
    red_total = 0
    green_total = 0
    blue_total = 0
    count = 0
    for box in boxes:
        histogram = rgb.crop(box).histogram()
        for value, pixels_count in enumerate(histogram[:256]):
            red_total += value * pixels_count
            count += pixels_count
        for value, pixels_count in enumerate(histogram[256:512]):
            green_total += value * pixels_count
        for value, pixels_count in enumerate(histogram[512:768]):
            blue_total += value * pixels_count
    count = max(1, count)
    red = red_total // count
    green = green_total // count
    blue = blue_total // count
    return red, green, blue


def remove_light_background_to_alpha(
    image: Image.Image,
    background_threshold: float,
    feather: float,
) -> Image.Image:
    rgb = image.convert("RGB")
    estimated_background = estimate_background_color_from_corners(rgb)
    background = Image.new("RGB", rgb.size, estimated_background)
    diff = ImageOps.grayscale(ImageChops.difference(rgb, background))
    safe_feather = max(1.0, float(feather))
    threshold = float(background_threshold)
    alpha = diff.point(
        lambda value: 0
        if value <= threshold
        else 255
        if value >= threshold + safe_feather
        else int(((value - threshold) / safe_feather) * 255),
        mode="L",
    )
    rgba = rgb.convert("RGBA")
    rgba.putalpha(alpha)
    return rgba


def recrop_rgba_by_alpha(image: Image.Image, margin_ratio: float = 0.06) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha_bbox = rgba.getchannel("A").getbbox()
    if not alpha_bbox:
        return rgba
    left, top, right, bottom = alpha_bbox
    margin = int(max(right - left, bottom - top) * max(0.0, margin_ratio))
    crop_box = (
        max(0, left - margin),
        max(0, top - margin),
        min(rgba.width, right + margin),
        min(rgba.height, bottom + margin),
    )
    return rgba.crop(crop_box)


def fit_rgba_to_square_canvas(image: Image.Image, output_size: int) -> Image.Image:
    rgba = image.convert("RGBA")
    if rgba.size == (output_size, output_size):
        return rgba
    scale = min(output_size / max(1, rgba.width), output_size / max(1, rgba.height))
    new_size = (
        max(1, int(round(rgba.width * scale))),
        max(1, int(round(rgba.height * scale))),
    )
    resized = rgba.resize(new_size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (output_size, output_size), (0, 0, 0, 0))
    offset = ((output_size - resized.width) // 2, (output_size - resized.height) // 2)
    canvas.alpha_composite(resized, dest=offset)
    return canvas


def apply_soft_post_sharpen(
    image: Image.Image,
    enabled: bool,
    radius: float,
    percent: int,
    threshold: int,
) -> Image.Image:
    if not enabled:
        return image.copy()
    if image.mode == "RGBA":
        red, green, blue, alpha = image.split()
        rgb = Image.merge("RGB", (red, green, blue))
        sharpened = rgb.filter(
            ImageFilter.UnsharpMask(radius=max(0.1, radius), percent=max(0, percent), threshold=max(0, threshold))
        )
        result = sharpened.convert("RGBA")
        result.putalpha(alpha)
        return result
    return image.filter(
        ImageFilter.UnsharpMask(radius=max(0.1, radius), percent=max(0, percent), threshold=max(0, threshold))
    )


def _conservative_alpha_fallback(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    if rgba.getchannel("A").getbbox():
        return rgba
    fallback = rgba.copy()
    fallback.putalpha(Image.new("L", rgba.size, 255))
    return fallback


def postprocess_catalog_result(
    image: Image.Image,
    *,
    output_size: int,
    transparent_background: bool,
    background_threshold: float,
    background_feather: float,
    result_margin_ratio: float,
    post_sharpen_enabled: bool,
    post_sharpen_radius: float,
    post_sharpen_percent: int,
    post_sharpen_threshold: int,
) -> Image.Image:
    if transparent_background:
        candidate = remove_light_background_to_alpha(image, background_threshold, background_feather)
        candidate_stats = mask_coverage_stats(candidate.getchannel("A"))
        if candidate.getchannel("A").getbbox() is None or candidate_stats["coverage_ratio"] < 0.02:
            candidate = _conservative_alpha_fallback(image)
        cropped = recrop_rgba_by_alpha(candidate, result_margin_ratio)
        fitted = fit_rgba_to_square_canvas(cropped, output_size)
        if fitted.getchannel("A").getbbox() is None:
            fitted = fit_rgba_to_square_canvas(_conservative_alpha_fallback(image), output_size)
        return apply_soft_post_sharpen(
            fitted,
            enabled=post_sharpen_enabled,
            radius=post_sharpen_radius,
            percent=post_sharpen_percent,
            threshold=post_sharpen_threshold,
        )

    if image.mode == "RGBA" and image.getchannel("A").getbbox():
        cropped_rgba = recrop_rgba_by_alpha(image, result_margin_ratio)
        fitted_rgba = fit_rgba_to_square_canvas(cropped_rgba, output_size)
        flattened = compose_rgba_on_light_background(fitted_rgba)
    else:
        flattened = resize_to_output_size(image.convert("RGB"), output_size)
    return apply_soft_post_sharpen(
        flattened,
        enabled=post_sharpen_enabled,
        radius=post_sharpen_radius,
        percent=post_sharpen_percent,
        threshold=post_sharpen_threshold,
    ).convert("RGB")
