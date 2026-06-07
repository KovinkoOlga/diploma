from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "local"
    database_url: str = "postgresql+asyncpg://app:app@localhost:5432/app"
    redis_url: str = "redis://localhost:6379/0"
    celery_task_always_eager: bool = False

    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    refresh_token_expire_days: int = 30
    email_code_ttl_seconds: int = 600
    email_code_resend_initial_seconds: int = 60
    email_code_resend_max_seconds: int = 900
    email_code_max_attempts: int = 5
    auth_dev_return_email_code: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_use_tls: bool = True

    s3_endpoint_url: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket_private: str = "wardrobe-private"
    s3_region: str = "ru-1"
    s3_presigned_expire_seconds: int = 3600
    s3_force_path_style: bool = True
    ml_vision_service_url: str = "http://ml-vision-service:8001"
    ml_request_timeout_seconds: int = 300
    backend_internal_url: str = "http://backend:8000"
    internal_service_token: str = "change-me-in-local-dev"
    weather_api_base_url: str = "https://api.open-meteo.com/v1"
    wardrobe_image_canvas_size: int = 512
    wardrobe_image_padding_ratio: float = 0.22
    wardrobe_image_min_padding_px: int = 48
    wardrobe_image_alpha_threshold: int = 8

    cors_origins: str = "http://localhost:8081,http://localhost:19006"

    sqladmin_username: str = "admin"
    sqladmin_password: str = "change-me"

    default_user_email: str = "demo@example.com"

    @property
    def cors_origin_list(self) -> list[str]:
        return [entry.strip() for entry in self.cors_origins.split(",") if entry.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"

    @property
    def is_local_or_dev(self) -> bool:
        return not self.is_production

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host.strip() and self.smtp_from_email.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
