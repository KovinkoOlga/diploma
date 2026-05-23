from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    internal_service_token: str = "change-me-in-local-dev"
    internal_callback_timeout_seconds: float = 0.35
    bg_model_path: str = "/app/models/background_removal_model.keras"
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
    color_reliable_alpha_threshold: int = 160
    color_core_alpha_threshold: int = 220
    color_mask_erode_kernel: int = 5
    color_mask_core_distance_px: float = 2.0
    color_min_mask_component_pixels: int = 128
    color_max_pixels: int = 50000
    color_kmeans_k: int = 5
    color_kmeans_lightness_weight: float = 0.4
    color_lightness_trim_percentile: float = 2.5
    color_min_cluster_percent: float = 0.06
    color_single_color_percent: float = 0.82
    color_second_color_min_percent: float = 0.3
    color_neutral_second_color_min_percent: float = 0.2
    color_multicolor_min_percent: float = 0.12
    color_multicolor_min_families: int = 3
    color_neutral_saturation_max: float = 0.18
    color_neutral_chroma_max: float = 20.0
    color_soft_chromatic_saturation_min: float = 0.09
    color_soft_chromatic_chroma_min: float = 10.0
    color_neutral_chromatic_penalty: float = 14.0
    color_neutral_primary_override_margin: float = 10.0
    color_neutral_secondary_score_margin: float = 12.0
    color_neutral_secondary_strict_score_margin: float = 6.0
    color_neutral_secondary_max_ab_distance: float = 18.0
    color_white_lightness_min: float = 82.0
    color_black_lightness_max: float = 24.0
    color_beige_lightness_min: float = 62.0
    color_brown_lightness_max: float = 52.0
    color_same_family_hue_delta: float = 20.0
    color_same_family_chroma_delta: float = 18.0
    color_match_max_score: float = 65.0
    color_debug: bool = False
    classifier_model_path: str = "/app/models/wardrobe_classifier.keras"
    classifier_artifacts_dir: str = "/app/models/classifier_artifacts"
    classifier_enable_stub: bool = False
    classifier_img_size: int = 320
    classifier_top_k: int = 3
    classifier_min_confidence: float = 0.0
    classifier_use_cutout: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
