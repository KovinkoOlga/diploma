from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Protocol

ProviderStatus = Literal["ready", "disabled", "missing"]


class _TryOffDiffSettings(Protocol):
    catalog_enable_tryoffdiff: bool
    catalog_tryoffdiff_mode: str
    catalog_tryoffdiff_dir: Path
    catalog_scheduler_filename: str
    catalog_model_multi: str
    catalog_model_upper: str
    catalog_model_lower: str
    catalog_model_dress: str
    catalog_vae_dir: Path


class _IPAdapterSettings(Protocol):
    catalog_enable_ip_adapter: bool
    catalog_sd15_dir: Path
    catalog_ip_adapter_dir: Path
    catalog_ip_adapter_weight: str


@dataclass(frozen=True)
class ProviderFileState:
    enabled: bool
    required: dict[str, Path]
    missing: dict[str, str]
    status: ProviderStatus


def normalize_tryoffdiff_mode(mode: str) -> str:
    normalized = mode.strip().lower()
    if normalized not in {"multi", "separate"}:
        return "multi"
    return normalized


def tryoffdiff_required_files(settings: _TryOffDiffSettings) -> dict[str, Path]:
    if not settings.catalog_enable_tryoffdiff:
        return {}

    mode = normalize_tryoffdiff_mode(settings.catalog_tryoffdiff_mode)
    required = {
        "tryoffdiff_dir": settings.catalog_tryoffdiff_dir,
        "scheduler_config": settings.catalog_tryoffdiff_dir / settings.catalog_scheduler_filename,
        "vae_dir": settings.catalog_vae_dir,
        "vae_config": settings.catalog_vae_dir / "config.json",
    }
    if mode == "multi":
        required["model_multi"] = settings.catalog_tryoffdiff_dir / settings.catalog_model_multi
    else:
        required["model_upper"] = settings.catalog_tryoffdiff_dir / settings.catalog_model_upper
        required["model_lower"] = settings.catalog_tryoffdiff_dir / settings.catalog_model_lower
        required["model_dress"] = settings.catalog_tryoffdiff_dir / settings.catalog_model_dress
    return required


def resolve_ip_adapter_weight_path(settings: _IPAdapterSettings) -> Path:
    return settings.catalog_ip_adapter_dir / "models" / settings.catalog_ip_adapter_weight


def resolve_ip_adapter_image_encoder_dir(settings: _IPAdapterSettings) -> Path:
    return settings.catalog_ip_adapter_dir / "models" / "image_encoder"


def ip_adapter_required_files(settings: _IPAdapterSettings) -> dict[str, Path]:
    if not settings.catalog_enable_ip_adapter:
        return {}

    image_encoder_dir = resolve_ip_adapter_image_encoder_dir(settings)
    return {
        "sd15_model_index": settings.catalog_sd15_dir / "model_index.json",
        "sd15_scheduler_dir": settings.catalog_sd15_dir / "scheduler",
        "sd15_tokenizer_dir": settings.catalog_sd15_dir / "tokenizer",
        "sd15_text_encoder_config": settings.catalog_sd15_dir / "text_encoder" / "config.json",
        "sd15_text_encoder_weights": settings.catalog_sd15_dir / "text_encoder" / "model.fp16.safetensors",
        "sd15_unet_config": settings.catalog_sd15_dir / "unet" / "config.json",
        "sd15_unet_weights": settings.catalog_sd15_dir / "unet" / "diffusion_pytorch_model.fp16.safetensors",
        "sd15_vae_config": settings.catalog_sd15_dir / "vae" / "config.json",
        "sd15_vae_weights": settings.catalog_sd15_dir / "vae" / "diffusion_pytorch_model.fp16.safetensors",
        "ip_adapter_image_encoder_config": image_encoder_dir / "config.json",
        "ip_adapter_image_encoder_weights": image_encoder_dir / "model.safetensors",
        "ip_adapter_image_encoder_preprocessor": image_encoder_dir / "preprocessor_config.json",
        "ip_adapter_weight": resolve_ip_adapter_weight_path(settings),
    }


def provider_file_state(*, enabled: bool, required: dict[str, Path]) -> ProviderFileState:
    if not enabled:
        return ProviderFileState(enabled=False, required=required, missing={}, status="disabled")

    missing = {key: str(path) for key, path in required.items() if not path.exists()}
    status: ProviderStatus = "ready" if not missing else "missing"
    return ProviderFileState(enabled=True, required=required, missing=missing, status=status)
