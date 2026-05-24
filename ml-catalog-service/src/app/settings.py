from functools import lru_cache

import torch
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    catalog_provider: str = "sd_turbo_img2img"
    catalog_model_id: str = "/app/models/sd-turbo-fp16"
    catalog_model_variant: str | None = "fp16"
    catalog_local_files_only: bool = True
    catalog_device: str = "cpu"
    catalog_output_size: int = 512
    catalog_num_inference_steps: int = 2
    catalog_strength: float = 0.5
    catalog_guidance_scale: float = 0.0
    catalog_deterministic: bool = False
    catalog_seed: int | None = None
    catalog_prompt_version: str = "catalog_prompt_v1"
    catalog_transparent_background: bool = True
    catalog_background_threshold: float = 30.0
    catalog_background_feather: float = 20.0
    catalog_result_margin_ratio: float = 0.06
    catalog_post_sharpen_enabled: bool = True
    catalog_post_sharpen_radius: float = 0.6
    catalog_post_sharpen_percent: int = 80
    catalog_post_sharpen_threshold: int = 3
    catalog_enable_stub: bool = False
    catalog_force_failure: bool = False
    catalog_num_threads: int | None = None


def resolve_device(device_name: str) -> str:
    normalized = (device_name or "").strip().lower()
    if normalized in {"cpu", "auto"}:
        return "cpu"
    return "cpu"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.catalog_num_threads is not None:
        torch.set_num_threads(settings.catalog_num_threads)
    return settings
