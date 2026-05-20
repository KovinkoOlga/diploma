import base64
from io import BytesIO

from PIL import Image


def load_rgb_image(image_bytes: bytes) -> Image.Image:
    return Image.open(BytesIO(image_bytes)).convert("RGB")


def pil_image_to_png_bytes(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def image_bytes_to_base64(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("utf-8")


def pil_image_to_base64(image: Image.Image) -> str:
    return image_bytes_to_base64(pil_image_to_png_bytes(image))
