from __future__ import annotations

from functools import lru_cache

import torch
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    catalog_provider: str = "sd15_ip_adapter_inpaint"

    catalog_sd15_inpaint_model_id: str = "/app/models/sd15-inpainting-fp16"
    catalog_ip_adapter_model_id: str = "/app/models/ip-adapter-sd15"
    catalog_ip_adapter_subfolder: str = "models"
    catalog_ip_adapter_weight_name: str = "ip-adapter_sd15_light.safetensors"

    catalog_model_variant: str | None = "fp16"
    catalog_local_files_only: bool = True

    catalog_device: str = "cpu"
    catalog_torch_dtype: str = "float32"
    catalog_num_threads: int | None = None

    catalog_output_size: int = 512
    catalog_num_inference_steps: int = 25
    catalog_guidance_scale: float = 7.0
    catalog_strength: float = 0.75
    catalog_ip_adapter_scale: float = 0.65

    catalog_mask_mode: str = "full_item"
    catalog_mask_expand_px: int = 16
    catalog_mask_blur_px: int = 8
    catalog_mask_alpha_threshold: int = 8

    catalog_deterministic: bool = False
    catalog_seed: int | None = None

    catalog_enable_stub: bool = False
    catalog_force_failure: bool = False

    catalog_transparent_background: bool = True
    catalog_background_threshold: float = 34.0
    catalog_background_feather: float = 20.0
    catalog_result_margin_ratio: float = 0.06

    catalog_post_sharpen_enabled: bool = True
    catalog_post_sharpen_radius: float = 0.6
    catalog_post_sharpen_percent: int = 80
    catalog_post_sharpen_threshold: int = 3


@lru_cache
def get_settings() -> Settings:
    return Settings()


def resolve_device(_: str | None) -> str:
    return "cpu"


def resolve_torch_dtype(dtype_name: str | None) -> torch.dtype:
    normalized = str(dtype_name or "").strip().lower()
    if normalized == "float16":
        return torch.float16
    if normalized == "float32":
        return torch.float32
    return torch.float32
