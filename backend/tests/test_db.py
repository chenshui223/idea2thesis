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


def test_initialize_database_adds_deleted_at_column_to_existing_jobs_table(
    tmp_path: Path,
) -> None:
    settings = Settings(
        jobs_dir=tmp_path / "jobs",
        database_path=tmp_path / ".idea2thesis" / "jobs.db",
        settings_file=tmp_path / ".idea2thesis" / "settings.json",
        secret_key_path=tmp_path / ".idea2thesis" / "secret.key",
        secret_dir=tmp_path / ".idea2thesis" / "job-secrets",
    )
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    with open_connection(settings) as connection:
        connection.execute(
            """
            CREATE TABLE jobs (
                id TEXT PRIMARY KEY,
                schema_version TEXT NOT NULL,
                brief_title TEXT NOT NULL,
                status TEXT NOT NULL,
                stage TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                started_at TEXT,
                finished_at TEXT,
                worker_id TEXT,
                source_job_id TEXT,
                workspace_path TEXT NOT NULL,
                input_file_path TEXT NOT NULL,
                secret_file_path TEXT,
                error_message TEXT NOT NULL,
                validation_state TEXT NOT NULL,
                final_disposition TEXT NOT NULL
            )
            """
        )
        connection.commit()

    initialize_database(settings)

    with open_connection(settings) as connection:
        columns = [row[1] for row in connection.execute("PRAGMA table_info(jobs)")]

    assert "deleted_at" in columns
