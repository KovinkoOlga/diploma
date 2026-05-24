import logging
import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, UploadFile

from app.image_utils import (
    composite_stub_catalog,
    encode_png_base64,
    postprocess_catalog_result,
    prepare_catalog_input,
)
from app.prompt_builder import build_catalog_prompt
from app.providers.sd_turbo_img2img import SdTurboImage2ImageProvider, resolve_generation_seed
from app.schemas import CatalogGenerationResponse
from app.settings import get_settings, resolve_device

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()
provider = SdTurboImage2ImageProvider(settings)

app = FastAPI(title="ML Catalog Service", version="0.2.0")


def _parse_color_ids(color_ids_json: str | None, repeated_color_ids: list[str] | None) -> list[str]:
    raw_values: list[str] = []

    for value in repeated_color_ids or []:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            raw_values.append(text)

    raw_text = str(color_ids_json or "").strip()
    if raw_text:
        try:
            parsed = json.loads(raw_text)
        except json.JSONDecodeError:
            parsed = None

        if isinstance(parsed, list):
            raw_values.extend(str(item).strip() for item in parsed if str(item).strip())
        elif isinstance(parsed, str):
            raw_values.extend(part.strip() for part in parsed.split(",") if part.strip())
        else:
            if "," in raw_text:
                raw_values.extend(part.strip() for part in raw_text.split(",") if part.strip())
            elif raw_text.replace("-", "_").replace("_", "").isalnum():
                raw_values.append(raw_text.strip())

    normalized: list[str] = []
    seen: set[str] = set()
    for value in raw_values:
        for chunk in str(value).split(","):
            candidate = chunk.strip().lower().replace("-", "_")
            if not candidate or candidate in seen:
                continue
            seen.add(candidate)
            normalized.append(candidate)
    return normalized


def _default_prompt_tokenization_debug() -> dict[str, Any]:
    return {
        "prompt_token_count": None,
        "prompt_token_limit": 77,
        "prompt_truncated": None,
    }


@app.get("/health")
async def health() -> dict[str, Any]:
    model_path = Path(settings.catalog_model_id)
    return {
        "status": "ok",
        "provider": settings.catalog_provider,
        "model_id": settings.catalog_model_id,
        "model_variant": settings.catalog_model_variant,
        "local_files_only": settings.catalog_local_files_only,
        "device": resolve_device(settings.catalog_device),
        "output_size": settings.catalog_output_size,
        "steps": settings.catalog_num_inference_steps,
        "strength": settings.catalog_strength,
        "guidance_scale": settings.catalog_guidance_scale,
        "seed": settings.catalog_seed,
        "deterministic": settings.catalog_deterministic,
        "transparent_background": settings.catalog_transparent_background,
        "background_threshold": settings.catalog_background_threshold,
        "background_feather": settings.catalog_background_feather,
        "result_margin_ratio": settings.catalog_result_margin_ratio,
        "post_sharpen_enabled": settings.catalog_post_sharpen_enabled,
        "post_sharpen_radius": settings.catalog_post_sharpen_radius,
        "post_sharpen_percent": settings.catalog_post_sharpen_percent,
        "post_sharpen_threshold": settings.catalog_post_sharpen_threshold,
        "stub_enabled": settings.catalog_enable_stub,
        "force_failure": settings.catalog_force_failure,
        "model_path_exists": model_path.exists(),
        "model_index_exists": (model_path / "model_index.json").exists(),
        "cpu_only": True,
    }


@app.post("/v1/generate-catalog", response_model=CatalogGenerationResponse)
async def generate_catalog(
    original_image: UploadFile = File(...),
    cutout_image: UploadFile = File(...),
    mask_image: UploadFile = File(...),
    category_hint: str | None = Form(None),
    subcategory_id: str | None = Form(None),
    subcategory_name: str | None = Form(None),
    color_ids_json: str | None = Form(None),
    color_ids: list[str] | None = Form(None),
) -> CatalogGenerationResponse:
    original_bytes = await original_image.read()
    cutout_bytes = await cutout_image.read()
    mask_bytes = await mask_image.read()
    category = category_hint or "unknown"
    parsed_color_ids = _parse_color_ids(color_ids_json, color_ids)
    prompt, prompt_metadata = build_catalog_prompt(
        category_hint=category_hint,
        subcategory_id=subcategory_id,
        subcategory_name=subcategory_name,
        color_ids=parsed_color_ids,
    )

    if settings.catalog_force_failure:
        seed, deterministic = resolve_generation_seed(settings)
        return CatalogGenerationResponse(
            catalog_image=None,
            mime_type=None,
            provider=settings.catalog_provider,
            model_used=settings.catalog_model_id,
            category=category,
            subcategory_id=subcategory_id,
            subcategory_name=subcategory_name,
            subcategory_prompt_text=prompt_metadata.get("subcategory_prompt_text"),
            color_ids=prompt_metadata.get("color_ids") or [],
            color_prompt_text=prompt_metadata.get("color_prompt_text"),
            deterministic=deterministic,
            seed=seed,
            generation_status="failed",
            error_message="Forced catalog generation failure",
            fallback_used=False,
            debug={
                "prompt_version": settings.catalog_prompt_version,
                "prompt": prompt,
                "prompt_metadata": prompt_metadata,
                "compact_prompt_used": bool(prompt_metadata.get("compact_prompt_used")),
                "model_variant": settings.catalog_model_variant,
                "local_files_only": settings.catalog_local_files_only,
                "transparent_background": settings.catalog_transparent_background,
                "background_threshold": settings.catalog_background_threshold,
                "background_feather": settings.catalog_background_feather,
                "result_margin_ratio": settings.catalog_result_margin_ratio,
                "post_sharpen_enabled": settings.catalog_post_sharpen_enabled,
                "post_sharpen_radius": settings.catalog_post_sharpen_radius,
                "post_sharpen_percent": settings.catalog_post_sharpen_percent,
                "post_sharpen_threshold": settings.catalog_post_sharpen_threshold,
                "deterministic": deterministic,
                "seed": seed,
                "cpu_only": True,
                **_default_prompt_tokenization_debug(),
            },
        )

    if settings.catalog_enable_stub:
        seed, deterministic = resolve_generation_seed(settings)
        image = composite_stub_catalog(
            original_bytes,
            cutout_bytes,
            mask_bytes,
            output_size=settings.catalog_output_size,
        )
        postprocessed, postprocess_debug = postprocess_catalog_result(
            image,
            output_size=settings.catalog_output_size,
            margin_ratio=settings.catalog_result_margin_ratio,
            transparent_background=settings.catalog_transparent_background,
            threshold=settings.catalog_background_threshold,
            feather=settings.catalog_background_feather,
            post_sharpen_enabled=settings.catalog_post_sharpen_enabled,
            post_sharpen_radius=settings.catalog_post_sharpen_radius,
            post_sharpen_percent=settings.catalog_post_sharpen_percent,
            post_sharpen_threshold=settings.catalog_post_sharpen_threshold,
        )
        return CatalogGenerationResponse(
            catalog_image=encode_png_base64(postprocessed),
            mime_type="image/png",
            provider="stub",
            model_used="catalog-composite-stub",
            category=category,
            subcategory_id=subcategory_id,
            subcategory_name=subcategory_name,
            subcategory_prompt_text=prompt_metadata.get("subcategory_prompt_text"),
            color_ids=prompt_metadata.get("color_ids") or [],
            color_prompt_text=prompt_metadata.get("color_prompt_text"),
            deterministic=deterministic,
            seed=seed,
            generation_status="ready",
            fallback_used=True,
            debug={
                "prompt_version": settings.catalog_prompt_version,
                "prompt": prompt,
                "prompt_metadata": prompt_metadata,
                "compact_prompt_used": bool(prompt_metadata.get("compact_prompt_used")),
                "output_size": settings.catalog_output_size,
                "transparent_background": settings.catalog_transparent_background,
                "background_threshold": settings.catalog_background_threshold,
                "background_feather": settings.catalog_background_feather,
                "result_margin_ratio": settings.catalog_result_margin_ratio,
                "post_sharpen_enabled": settings.catalog_post_sharpen_enabled,
                "post_sharpen_radius": settings.catalog_post_sharpen_radius,
                "post_sharpen_percent": settings.catalog_post_sharpen_percent,
                "post_sharpen_threshold": settings.catalog_post_sharpen_threshold,
                "deterministic": deterministic,
                "seed": seed,
                "postprocess": postprocess_debug,
                "cpu_only": True,
                **_default_prompt_tokenization_debug(),
            },
        )

    try:
        input_image = prepare_catalog_input(
            original_bytes,
            cutout_bytes,
            mask_bytes,
            output_size=settings.catalog_output_size,
        )
        output = provider.generate(input_image, prompt)
        postprocessed, postprocess_debug = postprocess_catalog_result(
            output.image,
            output_size=settings.catalog_output_size,
            margin_ratio=settings.catalog_result_margin_ratio,
            transparent_background=settings.catalog_transparent_background,
            threshold=settings.catalog_background_threshold,
            feather=settings.catalog_background_feather,
            post_sharpen_enabled=settings.catalog_post_sharpen_enabled,
            post_sharpen_radius=settings.catalog_post_sharpen_radius,
            post_sharpen_percent=settings.catalog_post_sharpen_percent,
            post_sharpen_threshold=settings.catalog_post_sharpen_threshold,
        )

        debug = dict(output.debug)
        debug["prompt_version"] = settings.catalog_prompt_version
        debug["prompt"] = prompt
        debug["prompt_metadata"] = prompt_metadata
        debug["compact_prompt_used"] = bool(prompt_metadata.get("compact_prompt_used"))
        debug["transparent_background"] = settings.catalog_transparent_background
        debug["background_threshold"] = settings.catalog_background_threshold
        debug["background_feather"] = settings.catalog_background_feather
        debug["result_margin_ratio"] = settings.catalog_result_margin_ratio
        debug["post_sharpen_enabled"] = settings.catalog_post_sharpen_enabled
        debug["post_sharpen_radius"] = settings.catalog_post_sharpen_radius
        debug["post_sharpen_percent"] = settings.catalog_post_sharpen_percent
        debug["post_sharpen_threshold"] = settings.catalog_post_sharpen_threshold
        debug["postprocess"] = postprocess_debug

        response_seed = output.debug.get("seed") if isinstance(output.debug, dict) else None
        response_deterministic = output.debug.get("deterministic") if isinstance(output.debug, dict) else None

        return CatalogGenerationResponse(
            catalog_image=encode_png_base64(postprocessed),
            mime_type="image/png",
            provider=output.provider,
            model_used=output.model_used,
            category=category,
            subcategory_id=subcategory_id,
            subcategory_name=subcategory_name,
            subcategory_prompt_text=prompt_metadata.get("subcategory_prompt_text"),
            color_ids=prompt_metadata.get("color_ids") or [],
            color_prompt_text=prompt_metadata.get("color_prompt_text"),
            deterministic=bool(response_deterministic) if response_deterministic is not None else None,
            seed=int(response_seed) if response_seed is not None else None,
            generation_status="ready",
            fallback_used=False,
            debug=debug,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Catalog generation failed")
        seed, deterministic = resolve_generation_seed(settings)
        return CatalogGenerationResponse(
            catalog_image=None,
            mime_type=None,
            provider=settings.catalog_provider,
            model_used=settings.catalog_model_id,
            category=category,
            subcategory_id=subcategory_id,
            subcategory_name=subcategory_name,
            subcategory_prompt_text=prompt_metadata.get("subcategory_prompt_text"),
            color_ids=prompt_metadata.get("color_ids") or [],
            color_prompt_text=prompt_metadata.get("color_prompt_text"),
            deterministic=deterministic,
            seed=seed,
            generation_status="failed",
            error_message=str(exc),
            fallback_used=False,
            debug={
                "prompt_version": settings.catalog_prompt_version,
                "prompt": prompt,
                "prompt_metadata": prompt_metadata,
                "compact_prompt_used": bool(prompt_metadata.get("compact_prompt_used")),
                "model_variant": settings.catalog_model_variant,
                "local_files_only": settings.catalog_local_files_only,
                "transparent_background": settings.catalog_transparent_background,
                "background_threshold": settings.catalog_background_threshold,
                "background_feather": settings.catalog_background_feather,
                "result_margin_ratio": settings.catalog_result_margin_ratio,
                "post_sharpen_enabled": settings.catalog_post_sharpen_enabled,
                "post_sharpen_radius": settings.catalog_post_sharpen_radius,
                "post_sharpen_percent": settings.catalog_post_sharpen_percent,
                "post_sharpen_threshold": settings.catalog_post_sharpen_threshold,
                "deterministic": deterministic,
                "seed": seed,
                "cpu_only": True,
                **_default_prompt_tokenization_debug(),
            },
        )
