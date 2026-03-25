from pathlib import Path

from docx import Document
from fastapi.testclient import TestClient

from idea2thesis.config import Settings
from idea2thesis.main import create_app


def test_create_job_from_uploaded_brief_returns_snapshot_and_artifacts(tmp_path: Path) -> None:
    file_path = tmp_path / "brief.docx"
    document = Document()
    document.add_heading("图书管理系统", level=1)
    document.add_paragraph("功能要求：用户登录、图书查询")
    document.save(file_path)

    settings = Settings(
        jobs_dir=tmp_path / "jobs",
        api_key="",
        base_url="https://example.com/v1",
        model="gpt-test",
        settings_file=tmp_path / ".idea2thesis" / "settings.json",
        database_path=tmp_path / ".idea2thesis" / "jobs.db",
        secret_key_path=tmp_path / ".idea2thesis" / "secret.key",
        secret_dir=tmp_path / ".idea2thesis" / "job-secrets",
    )
    client = TestClient(create_app(settings))
    with file_path.open("rb") as handle:
        response = client.post(
            "/jobs",
            files={
                "file": (
                    "brief.docx",
                    handle.read(),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
            },
            data={
                "config": """
                {
                  "schema_version": "v1alpha1",
                  "global": {
                    "api_key": "runtime-key",
                    "base_url": "https://example.com/v1",
                    "model": "gpt-test"
                  },
                  "agents": {}
                }
                """
            },
        )

    assert response.status_code == 201
    body = response.json()
    assert body["schema_version"] == "v1alpha1"
    assert body["job_id"]
    assert body["status"] == "pending"
    assert body["stage"] == "queued"
    assert body["validation_state"] == "pending"
    assert body["final_disposition"] == "pending"
    assert isinstance(body["artifacts"], list)
    assert body["artifacts"] == []


def test_uploaded_filename_is_sanitized_to_workspace(tmp_path: Path) -> None:
    file_path = tmp_path / "brief.docx"
    document = Document()
    document.add_heading("图书管理系统", level=1)
    document.add_paragraph("功能要求：用户登录、图书查询")
    document.save(file_path)

    settings = Settings(
        jobs_dir=tmp_path / "jobs",
        api_key="",
        base_url="https://example.com/v1",
        model="gpt-test",
        settings_file=tmp_path / ".idea2thesis" / "settings.json",
        database_path=tmp_path / ".idea2thesis" / "jobs.db",
        secret_key_path=tmp_path / ".idea2thesis" / "secret.key",
        secret_dir=tmp_path / ".idea2thesis" / "job-secrets",
    )
    client = TestClient(create_app(settings))
    with file_path.open("rb") as handle:
        response = client.post(
            "/jobs",
            files={
                "file": (
                    "../../outside.docx",
                    handle.read(),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
            },
            data={
                "config": """
                {
                  "schema_version": "v1alpha1",
                  "global": {
                    "api_key": "runtime-key",
                    "base_url": "https://example.com/v1",
                    "model": "gpt-test"
                  },
                  "agents": {}
                }
                """
            },
        )

    assert response.status_code == 201
    jobs_dir = settings.jobs_dir
    assert not (tmp_path / "outside.docx").exists()
    stored_files = list(jobs_dir.glob("*/input/*"))
    assert stored_files
    assert all(path.parent.parent.parent == jobs_dir for path in stored_files)
    secret_files = list(settings.secret_dir.glob("*.bin"))
    assert secret_files


def test_job_creation_rejects_unknown_agent_override_role(tmp_path: Path) -> None:
    file_path = tmp_path / "brief.docx"
    document = Document()
    document.add_heading("图书管理系统", level=1)
    document.add_paragraph("功能要求：用户登录、图书查询")
    document.save(file_path)

    settings = Settings(
        jobs_dir=tmp_path / "jobs",
        api_key="",
        base_url="https://example.com/v1",
        model="gpt-test",
        settings_file=tmp_path / ".idea2thesis" / "settings.json",
        database_path=tmp_path / ".idea2thesis" / "jobs.db",
        secret_key_path=tmp_path / ".idea2thesis" / "secret.key",
        secret_dir=tmp_path / ".idea2thesis" / "job-secrets",
    )
    client = TestClient(create_app(settings))
    with file_path.open("rb") as handle:
        response = client.post(
            "/jobs",
            files={
                "file": (
                    "brief.docx",
                    handle.read(),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
            },
            data={
                "config": """
                {
                  "schema_version": "v1alpha1",
                  "global": {
                    "api_key": "runtime-key",
                    "base_url": "https://example.com/v1",
                    "model": "gpt-test"
                  },
                  "agents": {
                    "rogue": {
                      "use_global": false,
                      "api_key": "rogue-key",
                      "base_url": "https://rogue.example/v1",
                      "model": "gpt-rogue"
                    }
                  }
                }
                """
            },
        )

    assert response.status_code == 422
    assert "unknown agent role" in response.text


def test_job_creation_rejects_missing_effective_api_key(tmp_path: Path) -> None:
    file_path = tmp_path / "brief.docx"
    document = Document()
    document.add_heading("图书管理系统", level=1)
    document.add_paragraph("功能要求：用户登录、图书查询")
    document.save(file_path)

    settings = Settings(
        jobs_dir=tmp_path / "jobs",
        api_key="",
        base_url="https://example.com/v1",
        model="gpt-test",
        settings_file=tmp_path / ".idea2thesis" / "settings.json",
        database_path=tmp_path / ".idea2thesis" / "jobs.db",
        secret_key_path=tmp_path / ".idea2thesis" / "secret.key",
        secret_dir=tmp_path / ".idea2thesis" / "job-secrets",
    )
    client = TestClient(create_app(settings))
    with file_path.open("rb") as handle:
        response = client.post(
            "/jobs",
            files={
                "file": (
                    "brief.docx",
                    handle.read(),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
            },
            data={
                "config": """
                {
                  "schema_version": "v1alpha1",
                  "global": {
                    "api_key": "",
                    "base_url": "https://example.com/v1",
                    "model": "gpt-test"
                  },
                  "agents": {}
                }
                """
            },
        )

    assert response.status_code == 422
    assert "missing effective api_key" in response.text


def test_rerun_and_delete_integration(tmp_path: Path) -> None:
    client = TestClient(
        create_app(
            Settings(
                jobs_dir=tmp_path / "jobs",
                api_key="",
                base_url="https://example.com/v1",
                model="gpt-test",
                settings_file=tmp_path / ".idea2thesis" / "settings.json",
                database_path=tmp_path / ".idea2thesis" / "jobs.db",
                secret_key_path=tmp_path / ".idea2thesis" / "secret.key",
                secret_dir=tmp_path / ".idea2thesis" / "job-secrets",
            )
        )
    )

    rerun = client.post("/jobs/source-job/rerun", data={"config": "{}"})
    assert rerun.status_code == 422

    deleted = client.delete("/jobs/source-job")
    assert deleted.status_code == 404
