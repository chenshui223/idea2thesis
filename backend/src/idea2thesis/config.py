from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="IDEA2THESIS_",
        extra="ignore",
    )

    api_key: str = ""
    base_url: str = "https://api.openai.com/v1"
    model: str = "gpt-4.1-mini"
    organization: str | None = None
    jobs_dir: Path = Field(
        default_factory=lambda: Path(__file__).resolve().parents[3] / "jobs"
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
