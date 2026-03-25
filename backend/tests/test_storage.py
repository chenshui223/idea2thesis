from pathlib import Path

from idea2thesis.storage import JobStorage, build_execution_artifact_paths


def test_create_job_workspace_creates_expected_directories(tmp_path: Path) -> None:
    storage = JobStorage(base_dir=tmp_path)
    paths = storage.create_job_workspace("job-1")
    assert paths.root_dir.exists()
    assert paths.input_dir.exists()
    assert paths.parsed_dir.exists()
    assert paths.workspace_dir.exists()
    assert paths.artifacts_dir.exists()
    assert paths.logs_dir.exists()


def test_create_job_workspace_rejects_path_traversal(tmp_path: Path) -> None:
    storage = JobStorage(base_dir=tmp_path)
    try:
        storage.create_job_workspace("../escape")
    except ValueError as exc:
        assert "path traversal" in str(exc)
    else:
        raise AssertionError("expected path traversal rejection")


def test_job_paths_exposes_agent_and_manifest_artifact_locations(tmp_path: Path) -> None:
    storage = JobStorage(tmp_path / "jobs")
    paths = storage.create_job_workspace("job-1")

    artifact_paths = build_execution_artifact_paths(paths)

    assert artifact_paths.advisor_plan == paths.artifacts_dir / "agent" / "advisor" / "advisor_plan.json"
    assert artifact_paths.code_summary == paths.artifacts_dir / "agent" / "coder" / "code_summary.json"
    assert artifact_paths.thesis_draft == paths.artifacts_dir / "agent" / "writer" / "thesis_draft.md"
    assert artifact_paths.thesis_draft_docx == paths.artifacts_dir / "agent" / "writer" / "thesis_draft.docx"
    assert artifact_paths.code_eval == paths.artifacts_dir / "verification" / "code_eval.json"
    assert artifact_paths.final_manifest == paths.artifacts_dir / "final" / "job_manifest.json"
