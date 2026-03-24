from pathlib import Path

from idea2thesis.storage import JobStorage


def test_create_job_workspace_creates_expected_directories(tmp_path: Path) -> None:
    storage = JobStorage(base_dir=tmp_path)
    paths = storage.create_job_workspace("job-1")
    assert paths.root_dir.exists()
    assert paths.input_dir.exists()
    assert paths.parsed_dir.exists()
    assert paths.workspace_dir.exists()
    assert paths.artifacts_dir.exists()
    assert paths.logs_dir.exists()
