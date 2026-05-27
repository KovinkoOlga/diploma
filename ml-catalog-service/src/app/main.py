from __future__ import annotations

import json
import logging
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile

from app.image_utils import (
    build_full_item_inpaint_mask,
    build_inpaint_init_image,
    build_ip_adapter_reference_image,
    decode_rgba,
    encode_png_base64,
    postprocess_catalog_result,
)
from app.prompt_builder import build_catalog_prompt, normalize_text
from app.providers import Sd15IpAdapterInpaintProvider
from app.schemas import CatalogGenerationResponse
from app.settings import get_settings, resolve_device, resolve_torch_dtype


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ML Catalog Service", version="0.2.0")
catalog_provider = Sd15IpAdapterInpaintProvider(get_settings())


def _parse_color_ids(color_ids_json: str | None) -> list[str]:
    if not color_ids_json:
        return []
    try:
        parsed = json.loads(color_ids_json)
        if isinstance(parsed, list):
            values = parsed
        elif isinstance(parsed, str):
            values = [piece.strip() for piece in parsed.split(",")]
        else:
            values = []
    except json.JSONDecodeError:
        values = [piece.strip() for piece in str(color_ids_json).split(",")]

    result: list[str] = []
    for value in values:
        normalized = normalize_text(str(value))
        if normalized and normalized not in result:
            result.append(normalized)
    return result


def _response_metadata(
    *,
    category_hint: str | None,
    subcategory_id: str | None,
    subcategory_name: str | None,
    prompt_metadata: dict,
) -> dict:
    return {
        "category": normalize_text(category_hint) or "unknown",
        "subcategory_id": normalize_text(subcategory_id) or None,
        "subcategory_name": normalize_text(subcategory_name) or None,
        "subcategory_prompt_text": prompt_metadata.get("subcategory_prompt_text"),
        "color_ids": list(prompt_metadata.get("color_ids") or []),
        "color_prompt_text": prompt_metadata.get("color_prompt_text"),
    }


@app.get("/health")
async def health() -> dict:
    settings = get_settings()
    sd15_path = Path(settings.catalog_sd15_inpaint_model_id)
    ip_adapter_path = Path(settings.catalog_ip_adapter_model_id)
    ip_adapter_subfolder = ip_adapter_path / settings.catalog_ip_adapter_subfolder
    return {
        "status": "ok",
        "provider": settings.catalog_provider,
        "device": resolve_device(settings.catalog_device),
        "torch_dtype": str(resolve_torch_dtype(settings.catalog_torch_dtype)).replace("torch.", ""),
        "sd15_inpaint_model_path": settings.catalog_sd15_inpaint_model_id,
        "sd15_inpaint_model_path_exists": sd15_path.exists(),
        "sd15_inpaint_model_index_exists": (sd15_path / "model_index.json").exists(),
        "ip_adapter_model_path": settings.catalog_ip_adapter_model_id,
        "ip_adapter_path_exists": ip_adapter_path.exists(),
        "ip_adapter_image_encoder_exists": (ip_adapter_subfolder / "image_encoder").exists(),
        "ip_adapter_weight_exists": (ip_adapter_subfolder / settings.catalog_ip_adapter_weight_name).exists(),
        "local_files_only": settings.catalog_local_files_only,
        "output_size": settings.catalog_output_size,
        "num_inference_steps": settings.catalog_num_inference_steps,
        "guidance_scale": settings.catalog_guidance_scale,
        "strength": settings.catalog_strength,
        "ip_adapter_scale": settings.catalog_ip_adapter_scale,
        "mask_mode": settings.catalog_mask_mode,
        "mask_expand_px": settings.catalog_mask_expand_px,
        "mask_blur_px": settings.catalog_mask_blur_px,
        "deterministic": settings.catalog_deterministic,
        "transparent_background": settings.catalog_transparent_background,
        "result_margin_ratio": settings.catalog_result_margin_ratio,
        "post_sharpen_enabled": settings.catalog_post_sharpen_enabled,
        "post_sharpen_radius": settings.catalog_post_sharpen_radius,
        "post_sharpen_percent": settings.catalog_post_sharpen_percent,
        "post_sharpen_threshold": settings.catalog_post_sharpen_threshold,
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
) -> CatalogGenerationResponse:
    settings = get_settings()
    original_bytes = await original_image.read()
    cutout_bytes = await cutout_image.read()
    mask_bytes = await mask_image.read()
    color_ids = _parse_color_ids(color_ids_json)

    prompt, negative_prompt, prompt_metadata = build_catalog_prompt(
        category_hint,
        subcategory_id=subcategory_id,
        subcategory_name=subcategory_name,
        color_ids=color_ids,
    )
    response_metadata = _response_metadata(
        category_hint=category_hint,
        subcategory_id=subcategory_id,
        subcategory_name=subcategory_name,
        prompt_metadata=prompt_metadata,
    )

    if settings.catalog_force_failure:
        return CatalogGenerationResponse(
            provider=settings.catalog_provider,
            model_used="forced_failure",
            generation_status="failed",
            error_message="Forced catalog generation failure",
            fallback_used=False,
            deterministic=settings.catalog_deterministic,
            seed=settings.catalog_seed,
            debug={"force_failure": True, "prompt": prompt, "negative_prompt": negative_prompt},
            **response_metadata,
        )

    try:
        if settings.catalog_enable_stub:
            stub_image = decode_rgba(cutout_bytes)
            final_image = postprocess_catalog_result(
                stub_image,
                output_size=settings.catalog_output_size,
                transparent_background=settings.catalog_transparent_background,
                background_threshold=settings.catalog_background_threshold,
                background_feather=settings.catalog_background_feather,
                result_margin_ratio=settings.catalog_result_margin_ratio,
                post_sharpen_enabled=settings.catalog_post_sharpen_enabled,
                post_sharpen_radius=settings.catalog_post_sharpen_radius,
                post_sharpen_percent=settings.catalog_post_sharpen_percent,
                post_sharpen_threshold=settings.catalog_post_sharpen_threshold,
            )
            return CatalogGenerationResponse(
                catalog_image=encode_png_base64(final_image),
                mime_type="image/png",
                provider=settings.catalog_provider,
                model_used="catalog-stub-composite",
                generation_status="ready",
                fallback_used=True,
                deterministic=settings.catalog_deterministic,
                seed=settings.catalog_seed,
                debug={"stub_used": True, "prompt": prompt, "negative_prompt": negative_prompt},
                **response_metadata,
            )

        init_image = build_inpaint_init_image(original_bytes, settings.catalog_output_size)
        reference_image = build_ip_adapter_reference_image(cutout_bytes, settings.catalog_output_size)
        inpaint_mask = build_full_item_inpaint_mask(
            mask_bytes,
            cutout_bytes,
            settings.catalog_output_size,
            settings.catalog_mask_alpha_threshold,
            settings.catalog_mask_expand_px,
            settings.catalog_mask_blur_px,
        )
        output = catalog_provider.generate(init_image, inpaint_mask, reference_image, prompt, negative_prompt)
        final_image = postprocess_catalog_result(
            output.image,
            output_size=settings.catalog_output_size,
            transparent_background=settings.catalog_transparent_background,
            background_threshold=settings.catalog_background_threshold,
            background_feather=settings.catalog_background_feather,
            result_margin_ratio=settings.catalog_result_margin_ratio,
            post_sharpen_enabled=settings.catalog_post_sharpen_enabled,
            post_sharpen_radius=settings.catalog_post_sharpen_radius,
            post_sharpen_percent=settings.catalog_post_sharpen_percent,
            post_sharpen_threshold=settings.catalog_post_sharpen_threshold,
        )
        debug = {
            **(output.debug or {}),
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "mask_debug": inpaint_mask.info.get("mask_debug"),
            "transparent_background": settings.catalog_transparent_background,
            "result_margin_ratio": settings.catalog_result_margin_ratio,
        }
        return CatalogGenerationResponse(
            catalog_image=encode_png_base64(final_image),
            mime_type="image/png",
            provider=output.provider,
            model_used=output.model_used,
            generation_status="ready",
            fallback_used=False,
            deterministic=output.deterministic,
            seed=output.seed,
            debug=debug,
            **response_metadata,
        )
    except Exception as exc:
        logger.exception("Catalog generation failed")
        return CatalogGenerationResponse(
            provider=settings.catalog_provider,
            model_used="sd15-inpainting-failure",
            generation_status="failed",
            error_message=str(exc),
            fallback_used=False,
            deterministic=settings.catalog_deterministic,
            seed=settings.catalog_seed,
            debug={"prompt": prompt, "negative_prompt": negative_prompt, "exception_type": exc.__class__.__name__},
            **response_metadata,
        )
