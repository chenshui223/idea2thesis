from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterable

from idea2thesis.config import Settings
from idea2thesis.contracts import (
    AgentStatus,
    ArtifactRef,
    EventListResponse,
    JobDetailResponse,
    JobEventItem,
    JobListItem,
    JobListResponse,
    JobSnapshot,
    RerunPreload,
    RuntimePreset,
    RuntimePresetAgent,
    RuntimePresetGlobal,
)
from idea2thesis.db import open_connection


TERMINAL_STATUSES = {"completed", "failed", "blocked", "interrupted"}


@dataclass
class JobRecord:
    job_id: str
    input_file_path: str
    workspace_path: str
    secret_file_path: str | None


@dataclass
class RerunCreationResult:
    detail: JobDetailResponse


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


def _parse_runtime_agents(raw_json: str) -> dict[str, RuntimePresetAgent]:
    data = json.loads(raw_json or "{}")
    agents: dict[str, RuntimePresetAgent] = {}
    for role, value in data.items():
        agents[role] = RuntimePresetAgent.model_validate(
            {
                "useGlobal": bool(value.get("use_global", value.get("useGlobal", True))),
                "base_url": str(value.get("base_url", "")),
                "model": str(value.get("model", "")),
            }
        )
    return agents


def _runtime_preset_from_row(
    global_base_url: str, global_model: str, agents_json: str
) -> RuntimePreset:
    return RuntimePreset(
        schema_version="v1alpha1",
        global_config=RuntimePresetGlobal(base_url=global_base_url, model=global_model),
        agents=_parse_runtime_agents(agents_json),
    )


def _detail_from_row(
    connection,
    row,
    *,
    runtime_preset: RuntimePreset,
    rerun_preload: RerunPreload | None = None,
) -> JobDetailResponse:
    job_id = str(row[0])
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
    return JobDetailResponse(
        schema_version="v1alpha1",
        job_id=job_id,
        brief_title=str(row[2]),
        source_job_id=row[10],
        workspace_path=str(row[11]),
        input_file_path=str(row[12]),
        error_message=str(row[14] or ""),
        deleted_at=row[17],
        status=str(row[3]),
        stage=str(row[4]),
        created_at=str(row[5]),
        updated_at=str(row[6]),
        started_at=row[7],
        finished_at=row[8],
        validation_state=str(row[15]),
        final_disposition=str(row[16]),
        agents=[
            AgentStatus(role=str(agent[0]), status=str(agent[1]), summary=str(agent[2]))
            for agent in agent_rows
        ],
        artifacts=[
            ArtifactRef(kind=str(artifact[0]), path=str(artifact[1]))
            for artifact in artifact_rows
        ],
        runtime_preset=runtime_preset,
        rerun_preload=rerun_preload or RerunPreload(
            schema_version="v1alpha1",
            global_config=runtime_preset.global_config.model_dump(),
            agents=runtime_preset.agents,
        ),
    )


def _normalize_list_status(value: str) -> str:
    return "deleted" if value == "deleted" else value


def _resolve_sort_clause(sort: str) -> str:
    clauses = {
        "updated_desc": "updated_at DESC",
        "created_desc": "created_at DESC",
        "created_asc": "created_at ASC",
    }
    try:
        return clauses[sort]
    except KeyError as exc:
        raise ValueError(f"invalid sort: {sort}") from exc


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
    ) -> JobDetailResponse:
        created_at = _utc_now()
        with open_connection(self.settings) as connection:
            connection.execute(
                """
                INSERT INTO jobs (
                    id, schema_version, brief_title, status, stage, created_at, updated_at,
                    started_at, finished_at, worker_id, source_job_id, workspace_path,
                    input_file_path, secret_file_path, error_message, validation_state,
                    final_disposition, deleted_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    None,
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
                    str(runtime_inputs.get("agents_json", "{}")),
                    1 if bool(runtime_inputs.get("api_key_required", False)) else 0,
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

    def claim_next_job(self, worker_id: str) -> JobDetailResponse | None:
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

    def get_job(self, job_id: str) -> JobDetailResponse:
        with open_connection(self.settings) as connection:
            row = connection.execute(
                """
                SELECT id, schema_version, brief_title, status, stage, created_at, updated_at,
                       started_at, finished_at, worker_id, source_job_id, workspace_path,
                       input_file_path, secret_file_path, error_message, validation_state,
                       final_disposition, deleted_at
                FROM jobs
                WHERE id = ?
                """,
                (job_id,),
            ).fetchone()
            if row is None:
                raise KeyError(job_id)
            runtime_row = connection.execute(
                """
                SELECT global_base_url, global_model, agents_json
                FROM job_runtime_inputs
                WHERE job_id = ?
                """,
                (job_id,),
            ).fetchone()
            if runtime_row is None:
                runtime_preset = RuntimePreset(
                    schema_version="v1alpha1",
                    global_config=RuntimePresetGlobal(),
                    agents={},
                )
            else:
                runtime_preset = _runtime_preset_from_row(
                    str(runtime_row[0]), str(runtime_row[1]), str(runtime_row[2])
                )
            return _detail_from_row(connection, row, runtime_preset=runtime_preset)

    def list_jobs(
        self,
        status: str | None = None,
        query: str | None = None,
        sort: str = "updated_desc",
        limit: int = 50,
        offset: int = 0,
    ) -> JobListResponse:
        clauses = []
        params: list[object] = []
        if status:
            clauses.append("status = ?")
            params.append(status)
        if query:
            clauses.append("(brief_title LIKE ? OR id LIKE ?)")
            params.extend([f"%{query}%", f"%{query}%"])
        where_clause = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        order_clause = _resolve_sort_clause(sort)
        with open_connection(self.settings) as connection:
            total = connection.execute(
                f"SELECT COUNT(*) FROM jobs {where_clause}", tuple(params)
            ).fetchone()[0]
            rows = connection.execute(
                f"""
                SELECT id, brief_title, status, stage, updated_at, created_at, final_disposition
                FROM jobs
                {where_clause}
                ORDER BY {order_clause}
                LIMIT ? OFFSET ?
                """,
                (*params, limit, offset),
            ).fetchall()
        items = [
            JobListItem(
                schema_version="v1alpha1",
                job_id=str(row[0]),
                brief_title=str(row[1]),
                status=_normalize_list_status(str(row[2])),
                stage=str(row[3]),
                updated_at=str(row[4]),
                created_at=str(row[5]),
                final_disposition=_normalize_list_status(str(row[6])),
            )
            for row in rows
        ]
        return JobListResponse(schema_version="v1alpha1", items=items, total=int(total))

    def list_job_events(self, job_id: str) -> EventListResponse:
        with open_connection(self.settings) as connection:
            rows = connection.execute(
                """
                SELECT id, timestamp, kind, message, payload_json
                FROM job_events
                WHERE job_id = ?
                ORDER BY id ASC
                """,
                (job_id,),
            ).fetchall()
        if not rows:
            raise KeyError(job_id)
        return EventListResponse(
            schema_version="v1alpha1",
            items=[
                JobEventItem(
                    schema_version="v1alpha1",
                    id=int(row[0]),
                    timestamp=str(row[1]),
                    kind=str(row[2]),
                    message=str(row[3]),
                    payload=json.loads(row[4] or "{}"),
                )
                for row in rows
            ],
        )

    def record_job_progress(
        self,
        *,
        job_id: str,
        stage: str,
        agent_statuses: Iterable[AgentStatus],
        event_kind: str,
        event_message: str,
        payload: dict[str, object] | None = None,
    ) -> None:
        now = _utc_now()
        with open_connection(self.settings) as connection:
            row = connection.execute(
                "SELECT id, secret_file_path FROM jobs WHERE id = ?",
                (job_id,),
            ).fetchone()
            if row is None:
                raise KeyError(job_id)
            connection.execute(
                """
                UPDATE jobs
                SET status = ?, stage = ?, updated_at = ?, validation_state = ?
                WHERE id = ?
                """,
                ("running", stage, now, "running", job_id),
            )
            connection.execute("DELETE FROM job_agent_states WHERE job_id = ?", (job_id,))
            for agent in agent_statuses:
                connection.execute(
                    """
                    INSERT INTO job_agent_states (job_id, role, status, summary, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (job_id, agent.role, agent.status, agent.summary, now),
                )
            connection.execute(
                """
                INSERT INTO job_events (job_id, timestamp, kind, message, payload_json)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    job_id,
                    now,
                    event_kind,
                    event_message,
                    json.dumps(payload or {}, ensure_ascii=False),
                ),
            )
            connection.commit()

    def create_rerun_job(
        self,
        *,
        source_job_id: str,
        new_job_id: str,
        secret_file_path: str,
        runtime_inputs: dict[str, object],
        agents: Iterable[str],
    ) -> JobDetailResponse:
        source = self.get_job(source_job_id)
        source_record = self.get_job_record(source_job_id)
        source_input_path = Path(source_record.input_file_path)
        if not source_input_path.exists():
            raise FileNotFoundError(source_input_path)
        created_at = _utc_now()
        rerun_root = Path(source_record.workspace_path).parent
        workspace_path = str(rerun_root / "workspace")
        with open_connection(self.settings) as connection:
            connection.execute(
                """
                INSERT INTO jobs (
                    id, schema_version, brief_title, status, stage, created_at, updated_at,
                    started_at, finished_at, worker_id, source_job_id, workspace_path,
                    input_file_path, secret_file_path, error_message, validation_state,
                    final_disposition, deleted_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    new_job_id,
                    "v1alpha1",
                    source.brief_title,
                    "pending",
                    "queued",
                    created_at,
                    created_at,
                    None,
                    None,
                    None,
                    source_job_id,
                    workspace_path,
                    str(source_input_path),
                    secret_file_path,
                    "",
                    "pending",
                    "pending",
                    None,
                ),
            )
            connection.execute(
                """
                INSERT INTO job_runtime_inputs (
                    job_id, global_base_url, global_model, agents_json, api_key_required
                ) VALUES (?, ?, ?, ?, ?)
                """,
                (
                    new_job_id,
                    str(runtime_inputs["global_base_url"]),
                    str(runtime_inputs["global_model"]),
                    str(runtime_inputs.get("agents_json", "{}")),
                    1 if bool(runtime_inputs.get("api_key_required", False)) else 0,
                ),
            )
            for role in agents:
                connection.execute(
                    """
                    INSERT INTO job_agent_states (job_id, role, status, summary, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (new_job_id, role, "pending", "", created_at),
                )
            connection.execute(
                """
                INSERT INTO job_events (job_id, timestamp, kind, message, payload_json)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    new_job_id,
                    created_at,
                    "job_rerun_created",
                    f"rerun created from {source_job_id}",
                    json.dumps({"source_job_id": source_job_id}),
                ),
            )
            connection.commit()
        return self.get_job(new_job_id)

    def soft_delete_job(self, job_id: str) -> JobDetailResponse:
        now = _utc_now()
        with open_connection(self.settings) as connection:
            row = connection.execute(
                "SELECT status FROM jobs WHERE id = ?",
                (job_id,),
            ).fetchone()
            if row is None:
                raise KeyError(job_id)
            if str(row[0]) not in TERMINAL_STATUSES:
                raise ValueError("job is not terminal")
            connection.execute(
                """
                UPDATE jobs
                SET status = ?, final_disposition = ?, deleted_at = ?, updated_at = ?
                WHERE id = ?
                """,
                ("deleted", "deleted", now, now, job_id),
            )
            connection.execute(
                """
                INSERT INTO job_events (job_id, timestamp, kind, message, payload_json)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    job_id,
                    now,
                    "job_deleted",
                    "job soft deleted",
                    "{}",
                ),
            )
            connection.commit()
        return self.get_job(job_id)

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
