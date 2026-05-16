import base64
from dataclasses import dataclass

import httpx

from app.core.config import get_settings


@dataclass
class CatalogGenerationResult:
    catalog_image: bytes
    mime_type: str
    model_used: str
    fallback_used: bool


async def generate_catalog_image(
    original_image: bytes,
    cutout_image: bytes,
    mask_image: bytes,
    *,
    filename: str = "image.png",
    mime_type: str = "image/png",
    category_hint: str | None = None,
) -> CatalogGenerationResult:
    settings = get_settings()
    timeout = httpx.Timeout(settings.ml_request_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{settings.ml_catalog_service_url.rstrip('/')}/v1/generate-catalog",
            files={
                "original_image": (filename, original_image, mime_type),
                "cutout_image": (f"cutout-{filename}", cutout_image, mime_type),
                "mask_image": (f"mask-{filename}", mask_image, mime_type),
            },
            data={"category_hint": category_hint} if category_hint else None,
        )
    response.raise_for_status()
    payload = response.json()
    return CatalogGenerationResult(
        catalog_image=base64.b64decode(payload["catalog_image"]),
        mime_type=payload.get("mime_type", mime_type),
        model_used=payload.get("model_used", "unknown"),
        fallback_used=bool(payload.get("fallback_used")),
    )
