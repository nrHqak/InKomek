from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[1] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Inclusive City Backend"
    supabase_url: str = Field(..., alias="SUPABASE_URL")
    supabase_anon_key: str = Field(..., alias="SUPABASE_ANON_KEY")
    supabase_service_role_key: str = Field(..., alias="SUPABASE_SERVICE_ROLE_KEY")
    database_url: str = Field(..., alias="DATABASE_URL")
    gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")
    upload_dir: str = Field(default="backend/uploads", alias="UPLOAD_DIR")
    ml_service_url: str = Field(default="http://127.0.0.1:8001", alias="ML_SERVICE_URL")


@lru_cache
def get_settings() -> Settings:
    return Settings()

