import base64
import json
from dataclasses import dataclass

import httpx

from app.core.config import get_settings


class CatalogGenerationError(RuntimeError):
    pass


@dataclass
class CatalogGenerationResult:
    catalog_image: bytes
    mime_type: str
    provider: str
    model_used: str
    category: str
    subcategory_id: str | None
    subcategory_name: str | None
    subcategory_prompt_text: str | None
    color_ids: list[str]
    color_prompt_text: str | None
    generation_status: str
    fallback_used: bool
    deterministic: bool | None
    seed: int | None
    debug: dict | None


async def generate_catalog_image(
    original_image: bytes,
    cutout_image: bytes,
    mask_image: bytes,
    *,
    filename: str = "image.png",
    mime_type: str = "image/png",
    category_hint: str | None = None,
    subcategory_id: str | None = None,
    subcategory_name: str | None = None,
    color_ids: list[str] | None = None,
) -> CatalogGenerationResult:
    settings = get_settings()
    timeout = httpx.Timeout(settings.ml_request_timeout_seconds)
    form_data = {
        "category_hint": category_hint or "",
        "subcategory_id": subcategory_id or "",
        "subcategory_name": subcategory_name or "",
        "color_ids_json": json.dumps(color_ids or [], ensure_ascii=False),
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{settings.ml_catalog_service_url.rstrip('/')}/v1/generate-catalog",
            files={
                "original_image": (filename, original_image, mime_type),
                "cutout_image": (f"cutout-{filename}", cutout_image, mime_type),
                "mask_image": (f"mask-{filename}", mask_image, mime_type),
            },
            data=form_data,
        )
    response.raise_for_status()
    payload = response.json()

    if payload.get("generation_status") != "ready" or not payload.get("catalog_image"):
        raise CatalogGenerationError(payload.get("error_message") or "Catalog generation did not return a ready image")

    try:
        catalog_image = base64.b64decode(payload["catalog_image"], validate=True)
    except Exception as exc:
        raise CatalogGenerationError("Catalog generation returned invalid base64 image data") from exc

    return CatalogGenerationResult(
        catalog_image=catalog_image,
        mime_type=payload.get("mime_type", mime_type),
        provider=payload.get("provider", "unknown"),
        model_used=payload.get("model_used", "unknown"),
        category=payload.get("category", category_hint or "unknown"),
        subcategory_id=payload.get("subcategory_id"),
        subcategory_name=payload.get("subcategory_name"),
        subcategory_prompt_text=payload.get("subcategory_prompt_text"),
        color_ids=list(payload.get("color_ids") or []),
        color_prompt_text=payload.get("color_prompt_text"),
        generation_status=payload.get("generation_status", "failed"),
        fallback_used=bool(payload.get("fallback_used")),
        deterministic=payload.get("deterministic"),
        seed=payload.get("seed"),
        debug=payload.get("debug"),
    )
