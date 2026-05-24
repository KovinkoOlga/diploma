from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, UploadFile

from app.image_utils import encode_png_base64, read_catalog_images
from app.model_paths import (
    ProviderFileState,
    ip_adapter_required_files,
    normalize_tryoffdiff_mode,
    provider_file_state,
    tryoffdiff_required_files,
)
from app.providers.base import GenerationInput
from app.providers.errors import MissingModelFileError, ProviderDisabledError
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
    KNOWN_PROVIDERS = ("tryoffdiff", "ip_adapter")

    def __init__(self) -> None:
        self._providers: dict[str, Any] = {}

    def provider_names(self) -> list[str]:
        return list(self.KNOWN_PROVIDERS)

    def enabled_provider_names(self) -> list[str]:
        return [name for name in self.provider_names() if self.is_enabled(name)]

    def is_enabled(self, provider_name: str) -> bool:
        if provider_name == "tryoffdiff":
            return settings.catalog_enable_tryoffdiff
        if provider_name == "ip_adapter":
            return settings.catalog_enable_ip_adapter
        return False

    def required_files(self, provider_name: str) -> dict[str, Path]:
        if provider_name == "tryoffdiff":
            return tryoffdiff_required_files(settings)
        if provider_name == "ip_adapter":
            return ip_adapter_required_files(settings)
        raise ValueError(f"Unsupported provider: {provider_name}")

    def file_state(self, provider_name: str) -> ProviderFileState:
        return provider_file_state(
            enabled=self.is_enabled(provider_name),
            required=self.required_files(provider_name),
        )

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

    def health_snapshot(self) -> dict[str, dict[str, Any]]:
        snapshot: dict[str, dict[str, Any]] = {}
        for name in self.provider_names():
            state = self.file_state(name)
            info: dict[str, Any] = {
                "enabled": state.enabled,
                "status": state.status,
                "required_files": {key: str(path) for key, path in state.required.items()},
                "missing": state.missing,
            }
            if name == "tryoffdiff":
                info["mode"] = normalize_tryoffdiff_mode(settings.catalog_tryoffdiff_mode)
            if name == "ip_adapter":
                info["base_model"] = settings.catalog_ip_base_model
            snapshot[name] = info
        return snapshot


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
        "providers_enabled": provider_registry.enabled_provider_names(),
        "providers_known": provider_registry.provider_names(),
        "providers": provider_registry.health_snapshot(),
    }


@app.get("/debug/provider-route", response_model=ProviderRouteDebugResponse)
async def debug_provider_route(category: str) -> ProviderRouteDebugResponse:
    route = resolve_route(category)
    state = provider_registry.file_state(route.provider)
    return ProviderRouteDebugResponse(
        normalized_category=route.normalized_category,
        provider=route.provider,
        model_key=route.model_key,
        prompt_type=route.prompt_type,
        provider_enabled=state.enabled,
        provider_status=state.status,
        tryoffdiff_mode=normalize_tryoffdiff_mode(settings.catalog_tryoffdiff_mode)
        if route.provider == "tryoffdiff"
        else None,
        ip_base_model=settings.catalog_ip_base_model if route.provider == "ip_adapter" else None,
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

    state = provider_registry.file_state(route.provider)
    if not state.enabled:
        message = (
            "IP-Adapter provider is disabled"
            if route.provider == "ip_adapter"
            else f"{route.provider} provider is disabled"
        )
        return _failed_response(
            provider=route.provider,
            model_used="disabled",
            category=route.normalized_category,
            message=message,
        )
    if state.status == "missing":
        missing_paths = ", ".join(state.missing.values())
        return _failed_response(
            provider=route.provider,
            model_used=route.model_key,
            category=route.normalized_category,
            message=f"Missing model files: {missing_paths}",
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
    except (ProviderDisabledError, MissingModelFileError, CategoryRoutingError) as exc:
        return _failed_response(
            provider=route.provider,
            model_used=route.model_key,
            category=route.normalized_category,
            message=str(exc),
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
