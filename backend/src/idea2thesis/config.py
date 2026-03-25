from __future__ import annotations

import ipaddress
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlsplit

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
    settings_file: Path = Field(
        default_factory=lambda: Path(__file__).resolve().parents[3]
        / ".idea2thesis"
        / "settings.json"
    )


def validate_base_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("base_url must use http or https")
    if not parsed.hostname:
        raise ValueError("base_url must include a hostname")
    hostname = parsed.hostname.strip().lower()
    if hostname == "localhost":
        raise ValueError("base_url host must not be loopback or private-network")
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        return value
    if (
        address.is_loopback
        or address.is_private
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    ):
        raise ValueError("base_url host must not be loopback or private-network")
    return value


def atomic_write_text(path: Path, contents: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(f"{path.suffix}.tmp")
    temp_path.write_text(contents, encoding="utf-8")
    temp_path.replace(path)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
