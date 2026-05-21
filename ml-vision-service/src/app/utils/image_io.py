import base64
from io import BytesIO

from PIL import Image, ImageOps


def load_rgb_image(image_bytes: bytes) -> Image.Image:
    image = ImageOps.exif_transpose(Image.open(BytesIO(image_bytes)))
    if image.mode in {"RGBA", "LA"} or ("transparency" in image.info and image.mode != "RGB"):
        alpha_image = image.convert("RGBA")
        background = Image.new("RGBA", alpha_image.size, (255, 255, 255, 255))
        image = Image.alpha_composite(background, alpha_image)
    return image.convert("RGB")


def pil_image_to_png_bytes(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def image_bytes_to_base64(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("utf-8")


def pil_image_to_base64(image: Image.Image) -> str:
    return image_bytes_to_base64(pil_image_to_png_bytes(image))
