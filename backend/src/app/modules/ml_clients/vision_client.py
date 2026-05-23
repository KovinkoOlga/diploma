import base64
import json
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import get_settings


@dataclass
class ItemImageAnalysisResult:
    cutout_image: bytes
    mask_image: bytes
    mime_type: str
    predictions: dict[str, Any | None]
    timings_ms: dict[str, int]


async def analyze_item_image(
    image_bytes: bytes,
    *,
    draft_id: str,
    progress_callback_url: str,
    progress_token: str,
    color_palette: list[dict[str, Any]] | None = None,
    filename: str = "image.png",
    mime_type: str = "image/png",
) -> ItemImageAnalysisResult:
    settings = get_settings()
    timeout = httpx.Timeout(settings.ml_request_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{settings.ml_vision_service_url.rstrip('/')}/v1/analyze-item-image",
            files={"image": (filename, image_bytes, mime_type)},
            data={
                "draft_id": draft_id,
                "progress_callback_url": progress_callback_url,
                "progress_token": progress_token,
                "palette_json": json.dumps(color_palette or [], ensure_ascii=False),
            },
        )
    response.raise_for_status()
    payload = response.json()
    return ItemImageAnalysisResult(
        cutout_image=base64.b64decode(payload["cutout_image"]),
        mask_image=base64.b64decode(payload["mask_image"]),
        mime_type=payload.get("mime_type", mime_type),
        predictions=payload.get("predictions") or {"category": None, "colors": None},
        timings_ms=payload.get("timings_ms") or {},
    )
