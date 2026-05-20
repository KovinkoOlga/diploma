from __future__ import annotations

import base64
import io
from dataclasses import dataclass

from PIL import Image


@dataclass
class CatalogImages:
    original: Image.Image
    cutout: Image.Image
    mask: Image.Image


def read_catalog_images(original_bytes: bytes, cutout_bytes: bytes, mask_bytes: bytes) -> CatalogImages:
    return CatalogImages(
        original=Image.open(io.BytesIO(original_bytes)).convert("RGBA"),
        cutout=Image.open(io.BytesIO(cutout_bytes)).convert("RGBA"),
        mask=Image.open(io.BytesIO(mask_bytes)).convert("L"),
    )


def encode_png(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def encode_png_base64(image: Image.Image) -> str:
    return base64.b64encode(encode_png(image)).decode("utf-8")


def paste_center(canvas: Image.Image, image: Image.Image) -> Image.Image:
    offset = ((canvas.width - image.width) // 2, (canvas.height - image.height) // 2)
    canvas.paste(image, offset)
    return canvas


def square_resize(image: Image.Image, size: int) -> Image.Image:
    side = max(image.width, image.height)
    square = Image.new("RGB", (side, side), color=(255, 255, 255))
    paste_center(square, image.convert("RGB"))
    return square.resize((size, size), Image.Resampling.LANCZOS)


def prepare_cutout_on_white(cutout: Image.Image, size: int) -> Image.Image:
    background = Image.new("RGBA", cutout.size, color=(255, 255, 255, 255))
    background.alpha_composite(cutout)
    return square_resize(background.convert("RGB"), size)


def prepare_tryoffdiff_condition(original: Image.Image, cutout: Image.Image, mask: Image.Image, size: int) -> Image.Image:
    if cutout.size != original.size:
        cutout = cutout.resize(original.size, Image.Resampling.LANCZOS)
    if mask.size != original.size:
        mask = mask.resize(original.size, Image.Resampling.NEAREST)

    bbox = mask.getbbox() or cutout.getbbox() or original.getbbox() or (0, 0, original.width, original.height)
    original_crop = original.crop(bbox)
    cutout_crop = cutout.crop(bbox)
    mask_crop = mask.crop(bbox)

    if cutout_crop.getchannel("A").getbbox() is None:
        transparent = Image.new("RGBA", original_crop.size, (0, 0, 0, 0))
        foreground = Image.composite(original_crop, transparent, mask_crop)
    else:
        foreground = cutout_crop

    white_bg = Image.new("RGBA", foreground.size, color=(255, 255, 255, 255))
    white_bg.alpha_composite(foreground)
    return square_resize(white_bg.convert("RGB"), size)
