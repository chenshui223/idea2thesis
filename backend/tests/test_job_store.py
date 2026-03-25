from pathlib import Path

from docx import Document

from idea2thesis.config import Settings
from idea2thesis.db import initialize_database, open_connection
from idea2thesis.job_store import JobStore


def build_settings(tmp_path: Path) -> Settings:
    return Settings(
        jobs_dir=tmp_path / "jobs",
        database_path=tmp_path / ".idea2thesis" / "jobs.db",
        settings_file=tmp_path / ".idea2thesis" / "settings.json",
        secret_key_path=tmp_path / ".idea2thesis" / "secret.key",
        secret_dir=tmp_path / ".idea2thesis" / "job-secrets",
    )


def test_create_job_returns_pending_snapshot(tmp_path: Path) -> None:
    settings = build_settings(tmp_path)
    initialize_database(settings)
    store = JobStore(settings)

    snapshot = store.create_job(
        job_id="job-1",
        brief_title="学生成绩分析系统",
        input_file_path=str(tmp_path / "jobs" / "job-1" / "input" / "brief.docx"),
        workspace_path=str(tmp_path / "jobs" / "job-1" / "workspace"),
        secret_file_path=str(tmp_path / ".idea2thesis" / "job-secrets" / "job-1.bin"),
        runtime_inputs={
            "global_base_url": "https://example.com/v1",
            "global_model": "gpt-test",
            "agents_json": "{}",
            "api_key_required": True,
        },
        agents=["advisor", "coder"],
    )

    assert snapshot.status == "pending"
    assert snapshot.stage == "queued"
    assert [agent.role for agent in snapshot.agents] == ["advisor", "coder"]
    assert [agent.status for agent in snapshot.agents] == ["pending", "pending"]


def test_claim_next_job_marks_pending_job_running(tmp_path: Path) -> None:
    settings = build_settings(tmp_path)
    initialize_database(settings)
    store = JobStore(settings)
    store.create_job(
        job_id="job-1",
        brief_title="学生成绩分析系统",
        input_file_path=str(tmp_path / "jobs" / "job-1" / "input" / "brief.docx"),
        workspace_path=str(tmp_path / "jobs" / "job-1" / "workspace"),
        secret_file_path=str(tmp_path / ".idea2thesis" / "job-secrets" / "job-1.bin"),
        runtime_inputs={
            "global_base_url": "https://example.com/v1",
            "global_model": "gpt-test",
            "agents_json": "{}",
            "api_key_required": True,
        },
        agents=["advisor", "coder"],
    )

    worker_id = "worker-current"
    store.register_worker_session(worker_id)
    claimed = store.claim_next_job(worker_id)

    assert claimed is not None
    assert claimed.job_id == "job-1"
    assert claimed.status == "running"


def test_reconcile_stale_running_jobs_marks_only_prior_running_jobs_interrupted(
    tmp_path: Path,
) -> None:
    settings = build_settings(tmp_path)
    initialize_database(settings)
    store = JobStore(settings)

    store.create_job(
        job_id="running-job",
        brief_title="运行中任务",
        input_file_path=str(tmp_path / "jobs" / "running-job" / "input" / "brief.docx"),
        workspace_path=str(tmp_path / "jobs" / "running-job" / "workspace"),
        secret_file_path=str(tmp_path / ".idea2thesis" / "job-secrets" / "running-job.bin"),
        runtime_inputs={
            "global_base_url": "https://example.com/v1",
            "global_model": "gpt-test",
            "agents_json": "{}",
            "api_key_required": True,
        },
        agents=["advisor"],
    )
    store.create_job(
        job_id="pending-job",
        brief_title="待执行任务",
        input_file_path=str(tmp_path / "jobs" / "pending-job" / "input" / "brief.docx"),
        workspace_path=str(tmp_path / "jobs" / "pending-job" / "workspace"),
        secret_file_path=str(tmp_path / ".idea2thesis" / "job-secrets" / "pending-job.bin"),
        runtime_inputs={
            "global_base_url": "https://example.com/v1",
            "global_model": "gpt-test",
            "agents_json": "{}",
            "api_key_required": True,
        },
        agents=["advisor"],
    )

    store.register_worker_session("worker-stale")
    store.register_worker_session("worker-current")
    store.claim_next_job("worker-stale")

    interrupted_count = store.reconcile_stale_running_jobs(
        active_worker_ids={"worker-current"}
    )

    assert interrupted_count == 1
    assert store.get_job("running-job").status == "interrupted"
    assert store.get_job("pending-job").status == "pending"


def seed_job(
    store: JobStore,
    tmp_path: Path,
    *,
    job_id: str,
    brief_title: str,
    status: str,
    stage: str,
    created_at: str,
    updated_at: str,
    source_job_id: str | None = None,
    deleted_at: str | None = None,
) -> None:
    input_path = tmp_path / "jobs" / job_id / "input" / "brief.docx"
    input_path.parent.mkdir(parents=True, exist_ok=True)
    input_path.write_bytes(b"brief")
    with store.settings.database_path.open("a"):
        pass

    with open_connection(store.settings) as connection:
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
                status,
                stage,
                created_at,
                updated_at,
                None,
                None,
                None,
                source_job_id,
                str(tmp_path / "jobs" / job_id / "workspace"),
                str(input_path),
                None,
                "",
                "pending",
                "completed" if status == "deleted" else "pending",
                deleted_at,
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
                "https://example.com/v1",
                "gpt-test",
                '{"coder": {"use_global": true, "api_key": "", "base_url": "", "model": ""}}',
                0,
            ),
        )
        connection.execute(
            """
            INSERT INTO job_events (job_id, timestamp, kind, message, payload_json)
            VALUES (?, ?, ?, ?, ?)
            """,
            (job_id, created_at, "job_created", "job enqueued", "{}"),
        )
        connection.commit()


def test_list_jobs_filters_search_sorts_and_paginates(tmp_path: Path) -> None:
    settings = build_settings(tmp_path)
    initialize_database(settings)
    store = JobStore(settings)

    seed_job(
        store,
        tmp_path,
        job_id="job-1",
        brief_title="图书管理系统",
        status="pending",
        stage="queued",
        created_at="2026-03-25T09:00:00Z",
        updated_at="2026-03-25T09:10:00Z",
    )
    seed_job(
        store,
        tmp_path,
        job_id="job-2",
        brief_title="成绩分析系统",
        status="deleted",
        stage="completed",
        created_at="2026-03-25T10:00:00Z",
        updated_at="2026-03-25T10:10:00Z",
        deleted_at="2026-03-25T11:00:00Z",
    )
    seed_job(
        store,
        tmp_path,
        job_id="job-3",
        brief_title="库存管理系统",
        status="running",
        stage="running",
        created_at="2026-03-25T08:00:00Z",
        updated_at="2026-03-25T08:05:00Z",
    )

    result = store.list_jobs(query="系统", sort="created_asc", limit=2, offset=0)
    assert [item.job_id for item in result.items] == ["job-3", "job-1"]
    assert result.total == 3

    deleted_only = store.list_jobs(status="deleted")
    assert [item.job_id for item in deleted_only.items] == ["job-2"]


def test_get_job_returns_enriched_detail(tmp_path: Path) -> None:
    settings = build_settings(tmp_path)
    initialize_database(settings)
    store = JobStore(settings)

    input_path = tmp_path / "jobs" / "job-1" / "input" / "brief.docx"
    input_path.parent.mkdir(parents=True, exist_ok=True)
    document = Document()
    document.add_heading("图书管理系统", level=1)
    document.save(input_path)
    with open_connection(settings) as connection:
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
                "job-1",
                "v1alpha1",
                "图书管理系统",
                "running",
                "running",
                "2026-03-25T09:00:00Z",
                "2026-03-25T09:10:00Z",
                "2026-03-25T09:05:00Z",
                None,
                None,
                "job-0",
                str(tmp_path / "jobs" / "job-1" / "workspace"),
                str(input_path),
                None,
                "",
                "running",
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
                "job-1",
                "https://example.com/v1",
                "gpt-test",
                '{"coder": {"use_global": false, "api_key": "", "base_url": "https://coder.example.com/v1", "model": "gpt-coder"}}',
                0,
            ),
        )
        connection.execute(
            """
            INSERT INTO job_agent_states (job_id, role, status, summary, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            ("job-1", "coder", "running", "working", "2026-03-25T09:10:00Z"),
        )
        connection.execute(
            """
            INSERT INTO job_events (job_id, timestamp, kind, message, payload_json)
            VALUES (?, ?, ?, ?, ?)
            """,
            ("job-1", "2026-03-25T09:11:00Z", "job_created", "created", "{}"),
        )
        connection.commit()

    detail = store.get_job("job-1")
    assert detail.source_job_id == "job-0"
    assert detail.runtime_preset.global_config.model == "gpt-test"
    assert detail.runtime_preset.agents["coder"].use_global is False
    assert detail.runtime_preset.agents["coder"].base_url == "https://coder.example.com/v1"
    assert detail.runtime_preset.agents["coder"].model == "gpt-coder"
    assert detail.model_dump(by_alias=True)["runtime_preset"]["agents"]["coder"]["useGlobal"] is False


def test_list_job_events_returns_ordered_events(tmp_path: Path) -> None:
    settings = build_settings(tmp_path)
    initialize_database(settings)
    store = JobStore(settings)
    seed_job(
        store,
        tmp_path,
        job_id="job-1",
        brief_title="图书管理系统",
        status="pending",
        stage="queued",
        created_at="2026-03-25T09:00:00Z",
        updated_at="2026-03-25T09:10:00Z",
    )
    with open_connection(settings) as connection:
        connection.execute(
            "INSERT INTO job_events (job_id, timestamp, kind, message, payload_json) VALUES (?, ?, ?, ?, ?)",
            ("job-1", "2026-03-25T09:01:00Z", "a", "first", "{}"),
        )
        connection.execute(
            "INSERT INTO job_events (job_id, timestamp, kind, message, payload_json) VALUES (?, ?, ?, ?, ?)",
            ("job-1", "2026-03-25T09:02:00Z", "b", "second", '{"x": 1}'),
        )
        connection.commit()

    events = store.list_job_events("job-1")
    assert [event.kind for event in events.items] == ["job_created", "a", "b"]


def test_create_rerun_job_links_source_and_reuses_runtime_inputs(tmp_path: Path) -> None:
    settings = build_settings(tmp_path)
    initialize_database(settings)
    store = JobStore(settings)
    source_input = tmp_path / "jobs" / "source-job" / "input" / "brief.docx"
    source_input.parent.mkdir(parents=True, exist_ok=True)
    source_input.write_bytes(b"docx")
    with open_connection(settings) as connection:
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
                "source-job",
                "v1alpha1",
                "图书管理系统",
                "completed",
                "completed",
                "2026-03-25T09:00:00Z",
                "2026-03-25T09:10:00Z",
                None,
                "2026-03-25T09:20:00Z",
                None,
                None,
                str(tmp_path / "jobs" / "source-job" / "workspace"),
                str(source_input),
                None,
                "",
                "completed",
                "completed",
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
                "source-job",
                "https://example.com/v1",
                "gpt-test",
                '{"coder": {"use_global": true, "api_key": "", "base_url": "", "model": ""}}',
                0,
            ),
        )
        connection.commit()

    rerun = store.create_rerun_job(
        source_job_id="source-job",
        new_job_id="rerun-job",
        secret_file_path=str(tmp_path / ".idea2thesis" / "job-secrets" / "rerun-job.bin"),
        runtime_inputs={"global_base_url": "https://example.com/v1", "global_model": "gpt-test"},
        agents=["coder"],
    )
    assert rerun.job_id == "rerun-job"
    assert rerun.source_job_id == "source-job"
    assert rerun.status == "pending"


def test_create_rerun_job_fails_when_source_input_missing(tmp_path: Path) -> None:
    settings = build_settings(tmp_path)
    initialize_database(settings)
    store = JobStore(settings)
    with open_connection(settings) as connection:
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
                "source-job",
                "v1alpha1",
                "图书管理系统",
                "completed",
                "completed",
                "2026-03-25T09:00:00Z",
                "2026-03-25T09:10:00Z",
                None,
                "2026-03-25T09:20:00Z",
                None,
                None,
                str(tmp_path / "jobs" / "source-job" / "workspace"),
                str(tmp_path / "jobs" / "source-job" / "input" / "brief.docx"),
                None,
                "",
                "completed",
                "completed",
                None,
            ),
        )
        connection.commit()

    try:
        store.create_rerun_job(
            source_job_id="source-job",
            new_job_id="rerun-job",
            secret_file_path=str(tmp_path / ".idea2thesis" / "job-secrets" / "rerun-job.bin"),
            runtime_inputs={"global_base_url": "https://example.com/v1", "global_model": "gpt-test"},
            agents=["coder"],
        )
    except FileNotFoundError:
        pass
    else:
        raise AssertionError("expected missing source input to fail")


def test_soft_delete_job_marks_deleted_and_preserves_files(tmp_path: Path) -> None:
    settings = build_settings(tmp_path)
    initialize_database(settings)
    store = JobStore(settings)
    seed_job(
        store,
        tmp_path,
        job_id="job-1",
        brief_title="图书管理系统",
        status="completed",
        stage="completed",
        created_at="2026-03-25T09:00:00Z",
        updated_at="2026-03-25T09:10:00Z",
    )

    deleted = store.soft_delete_job("job-1")
    assert deleted.status == "deleted"
    assert deleted.deleted_at is not None
    assert (tmp_path / "jobs" / "job-1").exists()


def test_soft_delete_rejects_non_terminal_jobs(tmp_path: Path) -> None:
    settings = build_settings(tmp_path)
    initialize_database(settings)
    store = JobStore(settings)
    seed_job(
        store,
        tmp_path,
        job_id="job-1",
        brief_title="图书管理系统",
        status="running",
        stage="running",
        created_at="2026-03-25T09:00:00Z",
        updated_at="2026-03-25T09:10:00Z",
    )

    try:
        store.soft_delete_job("job-1")
    except ValueError:
        pass
    else:
        raise AssertionError("expected non-terminal delete to fail")
