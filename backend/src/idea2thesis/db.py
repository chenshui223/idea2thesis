from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

from idea2thesis.config import Settings


SCHEMA_STATEMENTS = (
    """
    CREATE TABLE IF NOT EXISTS jobs (
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
    """,
    """
    CREATE TABLE IF NOT EXISTS job_agent_states (
        job_id TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        summary TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (job_id, role)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS job_artifacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        path TEXT NOT NULL,
        label TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS job_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        kind TEXT NOT NULL,
        message TEXT NOT NULL,
        payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS job_runtime_inputs (
        job_id TEXT PRIMARY KEY,
        global_base_url TEXT NOT NULL,
        global_model TEXT NOT NULL,
        agents_json TEXT NOT NULL,
        api_key_required INTEGER NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS workers (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        last_heartbeat_at TEXT NOT NULL,
        status TEXT NOT NULL
    )
    """,
)


def initialize_database(settings: Settings) -> None:
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    with open_connection(settings) as connection:
        for statement in SCHEMA_STATEMENTS:
            connection.execute(statement)
        _ensure_jobs_deleted_at_column(connection)
        connection.commit()


@contextmanager
def open_connection(settings: Settings) -> Iterator[sqlite3.Connection]:
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(settings.database_path)
    try:
        yield connection
    finally:
        connection.close()


def _ensure_jobs_deleted_at_column(connection: sqlite3.Connection) -> None:
    columns = {
        row[1]
        for row in connection.execute("PRAGMA table_info(jobs)")
    }
    if "deleted_at" not in columns:
        connection.execute("ALTER TABLE jobs ADD COLUMN deleted_at TEXT")
