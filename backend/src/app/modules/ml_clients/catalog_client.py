import base64
from dataclasses import dataclass

import httpx

from app.core.config import get_settings


@dataclass
class CatalogGenerationResult:
    catalog_image: bytes
    mime_type: str
    provider: str
    model_used: str
    category: str
    generation_status: str
    error_message: str | None


class CatalogGenerationError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        provider: str | None = None,
        model_used: str | None = None,
        category: str | None = None,
        generation_status: str | None = None,
    ) -> None:
        super().__init__(message)
        self.provider = provider
        self.model_used = model_used
        self.category = category
        self.generation_status = generation_status


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

    generation_status = payload.get("generation_status", "failed")
    catalog_image_base64 = payload.get("catalog_image")
    if generation_status != "ready" or not catalog_image_base64:
        message = payload.get("error_message") or "Catalog generation failed"
        raise CatalogGenerationError(
            message,
            provider=payload.get("provider"),
            model_used=payload.get("model_used"),
            category=payload.get("category", category_hint),
            generation_status=generation_status,
        )

    return CatalogGenerationResult(
        catalog_image=base64.b64decode(catalog_image_base64),
        mime_type=payload.get("mime_type", mime_type),
        provider=payload.get("provider", "unknown"),
        model_used=payload.get("model_used", "unknown"),
        category=payload.get("category", category_hint or "unknown"),
        generation_status=generation_status,
        error_message=payload.get("error_message"),
    )
