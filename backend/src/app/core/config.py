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

    s3_endpoint_url: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket_private: str = "wardrobe-private"
    s3_region: str = "ru-1"
    s3_presigned_expire_seconds: int = 3600
    s3_force_path_style: bool = True
    ml_bg_service_url: str = "http://ml-bg-service:8001"
    ml_catalog_service_url: str = "http://ml-catalog-service:8002"
    ml_request_timeout_seconds: int = 300

    cors_origins: str = "http://localhost:8081,http://localhost:19006"

    sqladmin_username: str = "admin"
    sqladmin_password: str = "change-me"

    default_user_email: str = "demo@example.com"
    default_user_password: str = "demo-password"

    @property
    def cors_origin_list(self) -> list[str]:
        return [entry.strip() for entry in self.cors_origins.split(",") if entry.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
