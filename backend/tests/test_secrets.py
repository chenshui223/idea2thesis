from pathlib import Path

from idea2thesis.config import Settings
from idea2thesis.secrets import (
    JobSecretEnvelope,
    delete_job_secret,
    read_job_secret,
    write_job_secret,
)


def test_job_secret_round_trip_uses_machine_local_key(tmp_path: Path) -> None:
    settings = Settings(
        jobs_dir=tmp_path / "jobs",
        database_path=tmp_path / ".idea2thesis" / "jobs.db",
        settings_file=tmp_path / ".idea2thesis" / "settings.json",
        secret_key_path=tmp_path / ".idea2thesis" / "secret.key",
        secret_dir=tmp_path / ".idea2thesis" / "job-secrets",
    )
    envelope = JobSecretEnvelope(
        global_api_key="global-key",
        per_agent_api_keys={"coder": "coder-key"},
    )

    secret_path = write_job_secret(settings, "job-1", envelope)
    restored = read_job_secret(settings, secret_path)

    assert restored == envelope
    assert settings.secret_key_path.exists()


def test_delete_job_secret_removes_secret_file(tmp_path: Path) -> None:
    settings = Settings(
        jobs_dir=tmp_path / "jobs",
        database_path=tmp_path / ".idea2thesis" / "jobs.db",
        settings_file=tmp_path / ".idea2thesis" / "settings.json",
        secret_key_path=tmp_path / ".idea2thesis" / "secret.key",
        secret_dir=tmp_path / ".idea2thesis" / "job-secrets",
    )
    secret_path = write_job_secret(
        settings,
        "job-1",
        JobSecretEnvelope(global_api_key="global-key", per_agent_api_keys={}),
    )

    delete_job_secret(secret_path)

    assert not secret_path.exists()
