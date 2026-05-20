from __future__ import annotations

from pathlib import Path
from typing import Protocol


class _TryOffDiffSettings(Protocol):
    catalog_tryoffdiff_dir: Path
    catalog_scheduler_filename: str
    catalog_model_upper: str
    catalog_model_lower: str
    catalog_model_dress: str
    catalog_vae_dir: Path


class _IPAdapterSettings(Protocol):
    catalog_sd15_dir: Path
    catalog_ip_adapter_dir: Path
    catalog_ip_adapter_weight: str


def tryoffdiff_required_files(settings: _TryOffDiffSettings) -> dict[str, Path]:
    return {
        "tryoffdiff_dir": settings.catalog_tryoffdiff_dir,
        "scheduler_config": settings.catalog_tryoffdiff_dir / settings.catalog_scheduler_filename,
        "model_upper": settings.catalog_tryoffdiff_dir / settings.catalog_model_upper,
        "model_lower": settings.catalog_tryoffdiff_dir / settings.catalog_model_lower,
        "model_dress": settings.catalog_tryoffdiff_dir / settings.catalog_model_dress,
        "vae_dir": settings.catalog_vae_dir,
        "vae_config": settings.catalog_vae_dir / "config.json",
    }


def resolve_ip_adapter_weight_path(settings: _IPAdapterSettings) -> Path:
    preferred = settings.catalog_ip_adapter_dir / "models" / settings.catalog_ip_adapter_weight
    if preferred.exists():
        return preferred
    return settings.catalog_ip_adapter_dir / "models" / "ip-adapter_sd15_light.safetensors"


def ip_adapter_required_files(settings: _IPAdapterSettings) -> dict[str, Path]:
    return {
        "sd15_dir": settings.catalog_sd15_dir,
        "sd15_model_index": settings.catalog_sd15_dir / "model_index.json",
        "ip_adapter_dir": settings.catalog_ip_adapter_dir,
        "ip_adapter_models_dir": settings.catalog_ip_adapter_dir / "models",
        "ip_adapter_image_encoder_config": settings.catalog_ip_adapter_dir / "models" / "image_encoder" / "config.json",
        "ip_adapter_weight": resolve_ip_adapter_weight_path(settings),
    }
