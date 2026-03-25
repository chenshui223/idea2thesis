from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Iterable

from idea2thesis.config import Settings
from idea2thesis.contracts import (
    AgentStatus,
    ArtifactRef,
    JobListItem,
    JobListResponse,
    JobSnapshot,
)
from idea2thesis.db import open_connection


@dataclass
class JobRecord:
    job_id: str
    input_file_path: str
    workspace_path: str
    secret_file_path: str | None


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


class JobStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def create_job(
        self,
        *,
        job_id: str,
        brief_title: str,
        input_file_path: str,
        workspace_path: str,
        secret_file_path: str,
        runtime_inputs: dict[str, object],
        agents: Iterable[str],
    ) -> JobSnapshot:
        created_at = _utc_now()
        with open_connection(self.settings) as connection:
            connection.execute(
                """
                INSERT INTO jobs (
                    id, schema_version, brief_title, status, stage, created_at, updated_at,
                    started_at, finished_at, worker_id, source_job_id, workspace_path,
                    input_file_path, secret_file_path, error_message, validation_state,
                    final_disposition
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    job_id,
                    "v1alpha1",
                    brief_title,
                    "pending",
                    "queued",
                    created_at,
                    created_at,
                    None,
                    None,
                    None,
                    None,
                    workspace_path,
                    input_file_path,
                    secret_file_path,
                    "",
                    "pending",
                    "pending",
                ),
            )
            connection.execute(
                """
                INSERT INTO job_runtime_inputs (
                    job_id, global_base_url, global_model, agents_json, api_key_required
                ) VALUES (?, ?, ?, ?, ?)
                """,
                (
                    job_id,
                    str(runtime_inputs["global_base_url"]),
                    str(runtime_inputs["global_model"]),
                    str(runtime_inputs["agents_json"]),
                    1 if bool(runtime_inputs["api_key_required"]) else 0,
                ),
            )
            for role in agents:
                connection.execute(
                    """
                    INSERT INTO job_agent_states (job_id, role, status, summary, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (job_id, role, "pending", "", created_at),
                )
            connection.execute(
                """
                INSERT INTO job_events (job_id, timestamp, kind, message, payload_json)
                VALUES (?, ?, ?, ?, ?)
                """,
                (job_id, created_at, "job_created", "job enqueued", "{}"),
            )
            connection.commit()
        return self.get_job(job_id)

    def register_worker_session(self, worker_id: str) -> None:
        now = _utc_now()
        with open_connection(self.settings) as connection:
            connection.execute(
                """
                INSERT OR REPLACE INTO workers (id, started_at, last_heartbeat_at, status)
                VALUES (?, COALESCE((SELECT started_at FROM workers WHERE id = ?), ?), ?, ?)
                """,
                (worker_id, worker_id, now, now, "active"),
            )
            connection.commit()

    def claim_next_job(self, worker_id: str) -> JobSnapshot | None:
        now = _utc_now()
        with open_connection(self.settings) as connection:
            row = connection.execute(
                """
                SELECT id FROM jobs
                WHERE status = 'pending'
                ORDER BY created_at ASC
                LIMIT 1
                """
            ).fetchone()
            if row is None:
                return None
            job_id = str(row[0])
            connection.execute(
                """
                UPDATE jobs
                SET status = ?, stage = ?, worker_id = ?, started_at = ?, updated_at = ?
                WHERE id = ? AND status = 'pending'
                """,
                ("running", "running", worker_id, now, now, job_id),
            )
            connection.execute(
                """
                INSERT INTO job_events (job_id, timestamp, kind, message, payload_json)
                VALUES (?, ?, ?, ?, ?)
                """,
                (job_id, now, "worker_claimed", f"claimed by {worker_id}", "{}"),
            )
            connection.commit()
        return self.get_job(job_id)

    def reconcile_stale_running_jobs(self, active_worker_ids: set[str]) -> int:
        now = _utc_now()
        with open_connection(self.settings) as connection:
            rows = connection.execute(
                """
                SELECT id FROM jobs
                WHERE status = 'running'
                  AND (worker_id IS NULL OR worker_id NOT IN (
                    SELECT id FROM workers WHERE id IN ({placeholders})
                  ))
                """.format(
                    placeholders=",".join("?" for _ in active_worker_ids) or "NULL"
                ),
                tuple(active_worker_ids),
            ).fetchall()
            interrupted_ids = [str(row[0]) for row in rows]
            for job_id in interrupted_ids:
                connection.execute(
                    """
                    UPDATE jobs
                    SET status = ?, stage = ?, finished_at = ?, updated_at = ?, error_message = ?, final_disposition = ?
                    WHERE id = ?
                    """,
                    (
                        "interrupted",
                        "interrupted",
                        now,
                        now,
                        "worker restarted before completion",
                        "interrupted",
                        job_id,
                    ),
                )
                connection.execute(
                    """
                    INSERT INTO job_events (job_id, timestamp, kind, message, payload_json)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        job_id,
                        now,
                        "job_interrupted",
                        "worker restarted before completion",
                        "{}",
                    ),
                )
            connection.commit()
        return len(interrupted_ids)

    def get_job(self, job_id: str) -> JobSnapshot:
        with open_connection(self.settings) as connection:
            row = connection.execute(
                """
                SELECT id, stage, status, validation_state, final_disposition
                FROM jobs
                WHERE id = ?
                """,
                (job_id,),
            ).fetchone()
            if row is None:
                raise KeyError(job_id)
            agent_rows = connection.execute(
                """
                SELECT role, status, summary
                FROM job_agent_states
                WHERE job_id = ?
                ORDER BY rowid ASC
                """,
                (job_id,),
            ).fetchall()
            artifact_rows = connection.execute(
                """
                SELECT kind, path
                FROM job_artifacts
                WHERE job_id = ?
                ORDER BY id ASC
                """,
                (job_id,),
            ).fetchall()
        return JobSnapshot(
            job_id=str(row[0]),
            stage=str(row[1]),
            status=str(row[2]),
            agents=[
                AgentStatus(role=str(agent[0]), status=str(agent[1]), summary=str(agent[2]))
                for agent in agent_rows
            ],
            artifacts=[
                ArtifactRef(kind=str(artifact[0]), path=str(artifact[1]))
                for artifact in artifact_rows
            ],
            validation_state=str(row[3]),
            final_disposition=str(row[4]),
        )

    def get_job_record(self, job_id: str) -> JobRecord:
        with open_connection(self.settings) as connection:
            row = connection.execute(
                """
                SELECT id, input_file_path, workspace_path, secret_file_path
                FROM jobs
                WHERE id = ?
                """,
                (job_id,),
            ).fetchone()
        if row is None:
            raise KeyError(job_id)
        return JobRecord(
            job_id=str(row[0]),
            input_file_path=str(row[1]),
            workspace_path=str(row[2]),
            secret_file_path=row[3],
        )

    def list_jobs(self) -> JobListResponse:
        with open_connection(self.settings) as connection:
            rows = connection.execute(
                """
                SELECT id, brief_title, status, stage, updated_at, created_at, final_disposition
                FROM jobs
                ORDER BY created_at DESC
                """
            ).fetchall()
        items = [
            JobListItem(
                job_id=str(row[0]),
                brief_title=str(row[1]),
                status=str(row[2]),
                stage=str(row[3]),
                updated_at=str(row[4]),
                created_at=str(row[5]),
                final_disposition=str(row[6]),
            )
            for row in rows
        ]
        return JobListResponse(items=items, total=len(items))

    def mark_job_completed(self, snapshot: JobSnapshot, *, clear_secret_file: bool) -> None:
        now = _utc_now()
        with open_connection(self.settings) as connection:
            connection.execute(
                """
                UPDATE jobs
                SET status = ?, stage = ?, updated_at = ?, finished_at = ?, validation_state = ?, final_disposition = ?, secret_file_path = ?
                WHERE id = ?
                """,
                (
                    snapshot.status,
                    snapshot.stage,
                    now,
                    now,
                    snapshot.validation_state,
                    snapshot.final_disposition,
                    None if clear_secret_file else self.get_job_record(snapshot.job_id).secret_file_path,
                    snapshot.job_id,
                ),
            )
            connection.execute("DELETE FROM job_agent_states WHERE job_id = ?", (snapshot.job_id,))
            for agent in snapshot.agents:
                connection.execute(
                    """
                    INSERT INTO job_agent_states (job_id, role, status, summary, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (snapshot.job_id, agent.role, agent.status, agent.summary, now),
                )
            connection.execute("DELETE FROM job_artifacts WHERE job_id = ?", (snapshot.job_id,))
            for artifact in snapshot.artifacts:
                connection.execute(
                    """
                    INSERT INTO job_artifacts (job_id, kind, path, label)
                    VALUES (?, ?, ?, ?)
                    """,
                    (snapshot.job_id, artifact.kind, artifact.path, artifact.kind),
                )
            connection.execute(
                """
                INSERT INTO job_events (job_id, timestamp, kind, message, payload_json)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    snapshot.job_id,
                    now,
                    "job_completed",
                    "job completed",
                    "{}",
                ),
            )
            connection.commit()

    def clear_secret_file_reference(self, job_id: str) -> None:
        with open_connection(self.settings) as connection:
            connection.execute(
                "UPDATE jobs SET secret_file_path = ? WHERE id = ?",
                (None, job_id),
            )
            connection.commit()
