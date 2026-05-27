from __future__ import annotations

from io import BytesIO
from typing import Any

from PIL import Image, ImageOps


def _png_bytes(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _threshold_mask(mask: Image.Image, alpha_threshold: int) -> Image.Image:
    threshold = max(0, min(255, int(alpha_threshold)))
    return mask.point(lambda value: 255 if int(value) >= threshold else 0)


def compose_square_cutout(square_source_bytes: bytes, square_mask_bytes: bytes) -> bytes:
    source = Image.open(BytesIO(square_source_bytes)).convert("RGBA")
    mask = Image.open(BytesIO(square_mask_bytes)).convert("L")
    if mask.size != source.size:
        mask = mask.resize(source.size, Image.Resampling.LANCZOS)

    cutout = source.copy()
    cutout.putalpha(mask)
    return _png_bytes(cutout)


def prepare_square_editor_assets(
    original_bytes: bytes,
    mask_bytes: bytes,
    *,
    canvas_size: int,
    padding_ratio: float,
    min_padding_px: int,
    alpha_threshold: int,
) -> dict[str, Any]:
    if canvas_size <= 0:
        raise ValueError("canvas_size must be positive")

    original = ImageOps.exif_transpose(Image.open(BytesIO(original_bytes))).convert("RGBA")
    mask = Image.open(BytesIO(mask_bytes)).convert("L")
    if mask.size != original.size:
        mask = mask.resize(original.size, Image.Resampling.LANCZOS)

    thresholded_mask = _threshold_mask(mask, alpha_threshold)
    bbox = thresholded_mask.getbbox()

    if bbox:
        left, top, right, bottom = bbox
    else:
        left, top, right, bottom = 0, 0, original.width, original.height

    bbox_width = max(1, right - left)
    bbox_height = max(1, bottom - top)
    padding = max(int(min_padding_px), int(round(max(bbox_width, bbox_height) * float(padding_ratio))))

    crop_box = (
        max(0, left - padding),
        max(0, top - padding),
        min(original.width, right + padding),
        min(original.height, bottom + padding),
    )

    crop_width = max(1, crop_box[2] - crop_box[0])
    crop_height = max(1, crop_box[3] - crop_box[1])
    scale = min(canvas_size / crop_width, canvas_size / crop_height)
    resized_width = max(1, int(round(crop_width * scale)))
    resized_height = max(1, int(round(crop_height * scale)))
    offset_x = (canvas_size - resized_width) // 2
    offset_y = (canvas_size - resized_height) // 2

    cropped_source = original.crop(crop_box).resize((resized_width, resized_height), Image.Resampling.LANCZOS)
    cropped_mask = mask.crop(crop_box).resize((resized_width, resized_height), Image.Resampling.LANCZOS)

    square_source = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    square_mask = Image.new("L", (canvas_size, canvas_size), 0)
    square_source.alpha_composite(cropped_source, dest=(offset_x, offset_y))
    square_mask.paste(cropped_mask, (offset_x, offset_y))

    square_source_bytes = _png_bytes(square_source)
    square_mask_bytes = _png_bytes(square_mask)
    square_cutout_bytes = compose_square_cutout(square_source_bytes, square_mask_bytes)

    return {
        "square_source_bytes": square_source_bytes,
        "square_mask_bytes": square_mask_bytes,
        "square_cutout_bytes": square_cutout_bytes,
        "metadata": {
            "canvas_size": canvas_size,
            "padding": padding,
            "bbox": [left, top, right, bottom],
            "crop_box": list(crop_box),
            "resized_size": [resized_width, resized_height],
            "offset": [offset_x, offset_y],
            "used_fallback_bbox": bbox is None,
        },
    }
