import base64
from dataclasses import dataclass

import httpx

from app.core.config import get_settings


@dataclass
class BgRemovalResult:
    cutout_image: bytes
    mask_image: bytes
    mime_type: str
    category_prediction: dict
    model: str


async def remove_background(
    image_bytes: bytes,
    *,
    filename: str = "image.png",
    mime_type: str = "image/png",
) -> BgRemovalResult:
    settings = get_settings()
    timeout = httpx.Timeout(settings.ml_request_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{settings.ml_bg_service_url.rstrip('/')}/v1/remove-background",
            files={"image": (filename, image_bytes, mime_type)},
        )
    response.raise_for_status()
    payload = response.json()
    return BgRemovalResult(
        cutout_image=base64.b64decode(payload["cutout_image"]),
        mask_image=base64.b64decode(payload["mask_image"]),
        mime_type=payload.get("mime_type", mime_type),
        category_prediction=payload.get("category_prediction") or {},
        model=payload.get("model", "unknown"),
    )

