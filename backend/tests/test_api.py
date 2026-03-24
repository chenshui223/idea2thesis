from pathlib import Path

from fastapi.testclient import TestClient

from idea2thesis.config import Settings
from idea2thesis.main import create_app


def build_client(tmp_path: Path) -> TestClient:
    settings = Settings(
        jobs_dir=tmp_path / "jobs",
        api_key="",
        base_url="https://example.com/v1",
        model="gpt-test",
    )
    return TestClient(create_app(settings))


def test_health_endpoint(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_settings_endpoint_returns_model_config_shape(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/settings")
    assert response.status_code == 200
    body = response.json()
    assert set(body) >= {"base_url", "model", "api_key_configured"}


def test_job_status_endpoint_returns_not_found_for_missing_job(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/jobs/example-job")
    assert response.status_code == 404


def test_job_status_endpoint_rejects_path_traversal_job_id(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/jobs/../escape")
    assert response.status_code in {400, 404}
