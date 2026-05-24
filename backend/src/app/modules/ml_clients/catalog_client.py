import base64
import binascii
import json
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import get_settings


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
    deterministic: bool | None
    seed: int | None
    generation_status: str
    fallback_used: bool
    debug: dict[str, Any] | None


class CatalogGenerationError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        provider: str | None,
        model_used: str | None,
        category: str | None,
        subcategory_id: str | None,
        subcategory_name: str | None,
        subcategory_prompt_text: str | None,
        color_ids: list[str] | None,
        color_prompt_text: str | None,
        deterministic: bool | None,
        seed: int | None,
        generation_status: str | None,
        debug: dict[str, Any] | None,
    ) -> None:
        super().__init__(message)
        self.provider = provider
        self.model_used = model_used
        self.category = category
        self.subcategory_id = subcategory_id
        self.subcategory_name = subcategory_name
        self.subcategory_prompt_text = subcategory_prompt_text
        self.color_ids = color_ids or []
        self.color_prompt_text = color_prompt_text
        self.deterministic = deterministic
        self.seed = seed
        self.generation_status = generation_status
        self.debug = debug


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
    form_data: dict[str, str] = {"color_ids_json": json.dumps(color_ids or [], ensure_ascii=False)}
    if category_hint:
        form_data["category_hint"] = category_hint
    if subcategory_id:
        form_data["subcategory_id"] = subcategory_id
    if subcategory_name:
        form_data["subcategory_name"] = subcategory_name

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
        raise CatalogGenerationError(
            payload.get("error_message") or "Catalog generation failed",
            provider=payload.get("provider"),
            model_used=payload.get("model_used"),
            category=payload.get("category"),
            subcategory_id=payload.get("subcategory_id"),
            subcategory_name=payload.get("subcategory_name"),
            subcategory_prompt_text=payload.get("subcategory_prompt_text"),
            color_ids=payload.get("color_ids") if isinstance(payload.get("color_ids"), list) else [],
            color_prompt_text=payload.get("color_prompt_text"),
            deterministic=payload.get("deterministic"),
            seed=payload.get("seed"),
            generation_status=payload.get("generation_status"),
            debug=payload.get("debug"),
        )

    try:
        decoded = base64.b64decode(payload["catalog_image"], validate=True)
    except (binascii.Error, ValueError, TypeError) as exc:
        raise CatalogGenerationError(
            "Catalog generation returned invalid base64 image",
            provider=payload.get("provider"),
            model_used=payload.get("model_used"),
            category=payload.get("category"),
            subcategory_id=payload.get("subcategory_id"),
            subcategory_name=payload.get("subcategory_name"),
            subcategory_prompt_text=payload.get("subcategory_prompt_text"),
            color_ids=payload.get("color_ids") if isinstance(payload.get("color_ids"), list) else [],
            color_prompt_text=payload.get("color_prompt_text"),
            deterministic=payload.get("deterministic"),
            seed=payload.get("seed"),
            generation_status=payload.get("generation_status"),
            debug=payload.get("debug"),
        ) from exc

    return CatalogGenerationResult(
        catalog_image=decoded,
        mime_type=payload.get("mime_type", mime_type),
        provider=payload.get("provider", "unknown"),
        model_used=payload.get("model_used", "unknown"),
        category=payload.get("category", "unknown"),
        subcategory_id=payload.get("subcategory_id"),
        subcategory_name=payload.get("subcategory_name"),
        subcategory_prompt_text=payload.get("subcategory_prompt_text"),
        color_ids=payload.get("color_ids") if isinstance(payload.get("color_ids"), list) else [],
        color_prompt_text=payload.get("color_prompt_text"),
        deterministic=payload.get("deterministic"),
        seed=payload.get("seed"),
        generation_status=payload.get("generation_status", "failed"),
        fallback_used=bool(payload.get("fallback_used")),
        debug=payload.get("debug"),
    )
