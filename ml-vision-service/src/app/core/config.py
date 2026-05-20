from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    bg_model_path: str = "/app/models/model.keras"
    bg_enable_stub: bool = False
    bg_img_size: int = 320
    bg_threshold: float = 0.5
    bg_low_threshold: float = 0.3
    bg_high_threshold: float = 0.7
    bg_min_area: int = 64
    bg_min_area_ratio: float = 0.003
    bg_max_hole_area: int = 128
    bg_close_kernel_size: int = 9
    bg_blur_kernel_size: int = 5


@lru_cache
def get_settings() -> Settings:
    return Settings()
