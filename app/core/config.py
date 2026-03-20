from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Inclusive City ML API"
    app_version: str = "0.1.0"
    app_env: str = Field(default="dev", alias="APP_ENV")

    city_name: str = Field(default="Almaty, Kazakhstan", alias="CITY_NAME")
    graph_file: Path = Field(default=Path("artifacts/graph/almaty_walk.graphml"), alias="GRAPH_FILE")
    model_dir: Path = Field(default=Path("artifacts/models/navigation"), alias="MODEL_DIR")
    cache_dir: Path = Field(default=Path("artifacts/cache"), alias="CACHE_DIR")

    osmnx_network_type: str = Field(default="walk", alias="OSMNX_NETWORK_TYPE")
    overpass_rate_limit: bool = Field(default=True, alias="OVERPASS_RATE_LIMIT")
    gps_model_file: Path = Field(default=Path("artifacts/models/gps/isolation_forest.joblib"), alias="GPS_MODEL_FILE")
    gps_metadata_file: Path = Field(
        default=Path("artifacts/models/gps/isolation_forest_metadata.json"),
        alias="GPS_METADATA_FILE",
    )
    gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-2.5-flash", alias="GEMINI_MODEL")
    backend_api_url: str | None = Field(default=None, alias="BACKEND_API_URL")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
