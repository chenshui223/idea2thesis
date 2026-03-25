from pathlib import Path

from idea2thesis.config import Settings
from idea2thesis.db import initialize_database
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
