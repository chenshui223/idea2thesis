from __future__ import annotations

import base64
import json
import secrets
from dataclasses import dataclass
from pathlib import Path

from idea2thesis.config import Settings


@dataclass(eq=True)
class JobSecretEnvelope:
    global_api_key: str
    per_agent_api_keys: dict[str, str]


def _ensure_secret_key(settings: Settings) -> bytes:
    settings.secret_key_path.parent.mkdir(parents=True, exist_ok=True)
    if settings.secret_key_path.exists():
        return settings.secret_key_path.read_bytes()
    key = secrets.token_bytes(32)
    settings.secret_key_path.write_bytes(key)
    return key


def _xor_bytes(payload: bytes, key: bytes) -> bytes:
    return bytes(byte ^ key[index % len(key)] for index, byte in enumerate(payload))


def write_job_secret(
    settings: Settings, job_id: str, envelope: JobSecretEnvelope
) -> Path:
    settings.secret_dir.mkdir(parents=True, exist_ok=True)
    key = _ensure_secret_key(settings)
    payload = json.dumps(
        {
            "global_api_key": envelope.global_api_key,
            "per_agent_api_keys": envelope.per_agent_api_keys,
        },
        ensure_ascii=False,
    ).encode("utf-8")
    encrypted = base64.b64encode(_xor_bytes(payload, key))
    secret_path = settings.secret_dir / f"{job_id}.bin"
    secret_path.write_bytes(encrypted)
    return secret_path


def read_job_secret(settings: Settings, path: Path) -> JobSecretEnvelope:
    key = _ensure_secret_key(settings)
    encrypted = path.read_bytes()
    payload = _xor_bytes(base64.b64decode(encrypted), key)
    data = json.loads(payload.decode("utf-8"))
    return JobSecretEnvelope(
        global_api_key=data["global_api_key"],
        per_agent_api_keys=dict(data["per_agent_api_keys"]),
    )


def delete_job_secret(path: Path) -> None:
    path.unlink(missing_ok=True)
