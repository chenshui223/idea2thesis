from pathlib import Path

from idea2thesis.config import Settings
from idea2thesis.db import initialize_database, open_connection


def test_initialize_database_creates_required_tables(tmp_path: Path) -> None:
    settings = Settings(
        jobs_dir=tmp_path / "jobs",
        database_path=tmp_path / ".idea2thesis" / "jobs.db",
        settings_file=tmp_path / ".idea2thesis" / "settings.json",
        secret_key_path=tmp_path / ".idea2thesis" / "secret.key",
        secret_dir=tmp_path / ".idea2thesis" / "job-secrets",
    )

    initialize_database(settings)

    with open_connection(settings) as connection:
        rows = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }

    assert {
        "jobs",
        "job_agent_states",
        "job_artifacts",
        "job_events",
        "job_runtime_inputs",
        "workers",
    } <= rows
