from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import torch
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    catalog_models_dir: Path = Path("/app/models")
    catalog_tryoffdiff_dir: Path = Path("/app/models/tryoffdiff")
    catalog_vae_dir: Path = Path("/app/models/sd-vae-ft-mse")
    catalog_sd15_dir: Path = Path("/app/models/sd15")
    catalog_ip_adapter_dir: Path = Path("/app/models/ip-adapter")

    catalog_device: str = "auto"
    catalog_seed: int = 42
    catalog_output_size: int = 512

    catalog_num_inference_steps: int = 20
    catalog_guidance_scale: float = 2.0
    catalog_scheduler_filename: str = "scheduler/scheduler_config_v2.json"
    catalog_model_upper: str = "tryoffdiffv2_upper.pth"
    catalog_model_lower: str = "tryoffdiffv2_lower.pth"
    catalog_model_dress: str = "tryoffdiffv2_dress.pth"

    catalog_ip_adapter_weight: str = "ip-adapter_sd15_light.safetensors"
    catalog_ip_adapter_scale: float = 0.75
    catalog_ip_adapter_strength: float = 0.45
    catalog_ip_adapter_steps: int = 12
    catalog_ip_adapter_guidance_scale: float = 5.0

    hf_hub_offline: str = "1"
    transformers_offline: str = "1"
    diffusers_offline: str = "1"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def resolve_device(device_name: str) -> str:
    normalized = device_name.strip().lower()
    if normalized == "auto":
        return "cuda" if torch.cuda.is_available() else "cpu"
    if normalized == "cuda" and not torch.cuda.is_available():
        return "cpu"
    if normalized not in {"cpu", "cuda"}:
        return "cpu"
    return normalized
