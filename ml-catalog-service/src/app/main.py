from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import FastAPI, File, Form, UploadFile

from app.image_utils import encode_png_base64, read_catalog_images
from app.providers.base import GenerationInput
from app.providers.ip_adapter_provider import IPAdapterProductProvider
from app.providers.router import CategoryRoutingError, resolve_route
from app.providers.tryoffdiff_provider import TryOffDiffProvider
from app.schemas import CatalogGenerationResponse, ProviderRouteDebugResponse
from app.settings import get_settings, resolve_device

logging.basicConfig(level=logging.INFO)
LOGGER = logging.getLogger(__name__)

settings = get_settings()
os.environ.setdefault("HF_HUB_OFFLINE", settings.hf_hub_offline)
os.environ.setdefault("TRANSFORMERS_OFFLINE", settings.transformers_offline)
os.environ.setdefault("DIFFUSERS_OFFLINE", settings.diffusers_offline)


class ProviderRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, Any] = {}

    def get(self, provider_name: str):
        if provider_name in self._providers:
            return self._providers[provider_name]
        if provider_name == "tryoffdiff":
            provider = TryOffDiffProvider(settings)
        elif provider_name == "ip_adapter":
            provider = IPAdapterProductProvider(settings)
        else:
            raise ValueError(f"Unsupported provider: {provider_name}")
        self._providers[provider_name] = provider
        return provider

    def provider_names(self) -> list[str]:
        return ["tryoffdiff", "ip_adapter"]

    def required_files_status(self) -> dict[str, dict[str, bool]]:
        status: dict[str, dict[str, bool]] = {}
        for name in self.provider_names():
            provider = self.get(name)
            status[name] = {
                key: path.exists()
                for key, path in provider.required_files().items()
            }
        return status


provider_registry = ProviderRegistry()
app = FastAPI(title="ML Catalog Service", version="0.2.0")


def _category_value(category: str | None, category_hint: str | None) -> str | None:
    return category or category_hint


def _failed_response(
    *,
    provider: str,
    model_used: str,
    category: str,
    message: str,
) -> CatalogGenerationResponse:
    return CatalogGenerationResponse(
        catalog_image=None,
        mime_type=None,
        provider=provider,
        model_used=model_used,
        category=category,
        generation_status="failed",
        error_message=message,
    )


@app.get("/health")
async def health() -> dict:
    model_root = settings.catalog_models_dir
    return {
        "status": "ok",
        "device": resolve_device(settings.catalog_device),
        "offline_flags": {
            "HF_HUB_OFFLINE": os.getenv("HF_HUB_OFFLINE"),
            "TRANSFORMERS_OFFLINE": os.getenv("TRANSFORMERS_OFFLINE"),
            "DIFFUSERS_OFFLINE": os.getenv("DIFFUSERS_OFFLINE"),
        },
        "models_dir_exists": model_root.exists(),
        "providers_enabled": provider_registry.provider_names(),
        "required_files": provider_registry.required_files_status(),
    }


@app.get("/debug/provider-route", response_model=ProviderRouteDebugResponse)
async def debug_provider_route(category: str) -> ProviderRouteDebugResponse:
    route = resolve_route(category)
    return ProviderRouteDebugResponse(
        normalized_category=route.normalized_category,
        provider=route.provider,
        model_key=route.model_key,
        prompt_type=route.prompt_type,
    )


@app.post("/v1/generate-catalog", response_model=CatalogGenerationResponse)
async def generate_catalog(
    original_image: UploadFile = File(...),
    cutout_image: UploadFile = File(...),
    mask_image: UploadFile = File(...),
    category_hint: str | None = Form(None),
    category: str | None = Form(None),
) -> CatalogGenerationResponse:
    requested_category = _category_value(category, category_hint)

    try:
        route = resolve_route(requested_category)
    except CategoryRoutingError as exc:
        return _failed_response(
            provider="unknown",
            model_used="unknown",
            category=(requested_category or "unknown"),
            message=str(exc),
        )

    try:
        original_bytes = await original_image.read()
        cutout_bytes = await cutout_image.read()
        mask_bytes = await mask_image.read()
        images = read_catalog_images(original_bytes, cutout_bytes, mask_bytes)

        provider = provider_registry.get(route.provider)
        output = provider.generate(
            GenerationInput(
                original=images.original,
                cutout=images.cutout,
                mask=images.mask,
                category=route.normalized_category,
            ),
            route,
        )
    except Exception as exc:
        LOGGER.exception("Catalog generation failed")
        return _failed_response(
            provider=route.provider,
            model_used=route.model_key,
            category=route.normalized_category,
            message=str(exc),
        )

    return CatalogGenerationResponse(
        catalog_image=encode_png_base64(output.image),
        mime_type="image/png",
        provider=route.provider,
        model_used=output.model_used,
        category=route.normalized_category,
        generation_status="ready",
        error_message=None,
    )
