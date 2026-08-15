"""MacroStack Backend — Konfiguration via Environment."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    app_env: str = "development"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 3723

    # CORS
    cors_origins: str = "http://localhost:3722,http://127.0.0.1:3722"

    # Redis / RQ
    redis_url: str = "redis://redis:6379/0"

    # Storage
    tmp_dir: str = "/tmp/macrostack"
    job_ttl_seconds: int = 86400

    # Limits
    max_images: int = 30
    max_file_size_mb: int = 100

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
