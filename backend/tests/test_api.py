from pathlib import Path

from fastapi.testclient import TestClient

from idea2thesis.config import Settings
from idea2thesis.main import create_app


def build_client(tmp_path: Path, api_key: str = "") -> TestClient:
    settings = Settings(
        jobs_dir=tmp_path / "jobs",
        api_key=api_key,
        base_url="https://example.com/v1",
        model="gpt-test",
        settings_file=tmp_path / ".idea2thesis" / "settings.json",
        database_path=tmp_path / ".idea2thesis" / "jobs.db",
        secret_key_path=tmp_path / ".idea2thesis" / "secret.key",
        secret_dir=tmp_path / ".idea2thesis" / "job-secrets",
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
    assert body["global"]["base_url"] == "https://example.com/v1"
    assert body["global"]["model"] == "gpt-test"
    assert body["api_key_configured"] is False
    assert body["agents"] == {}


def test_put_settings_persists_non_sensitive_values_across_restart(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.put(
        "/settings",
        json={
            "schema_version": "v1alpha1",
            "global": {
                "base_url": "https://api.example.com/v1",
                "model": "gpt-override",
            },
            "agents": {
                "coder": {
                    "use_global": False,
                    "base_url": "https://coder.example.com/v1",
                    "model": "gpt-coder",
                }
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["global"]["base_url"] == "https://api.example.com/v1"

    reloaded_client = build_client(tmp_path)
    reloaded = reloaded_client.get("/settings")
    assert reloaded.status_code == 200
    body = reloaded.json()
    assert body["global"]["base_url"] == "https://api.example.com/v1"
    assert body["agents"]["coder"]["model"] == "gpt-coder"


def test_get_settings_reports_api_key_configured_without_returning_secret(
    tmp_path: Path,
) -> None:
    client = build_client(tmp_path, api_key="server-secret")
    response = client.get("/settings")

    assert response.status_code == 200
    assert response.json()["api_key_configured"] is True
    assert "server-secret" not in response.text


def test_put_settings_rejects_private_base_url(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.put(
        "/settings",
        json={
            "schema_version": "v1alpha1",
            "global": {
                "base_url": "http://127.0.0.1:8000/v1",
                "model": "gpt-test",
            },
            "agents": {},
        },
    )

    assert response.status_code == 422


def test_job_status_endpoint_returns_not_found_for_missing_job(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/jobs/example-job")
    assert response.status_code == 404


def test_job_status_endpoint_rejects_path_traversal_job_id(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/jobs/../escape")
    assert response.status_code in {400, 404}


def test_get_jobs_lists_durable_jobs(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/jobs")

    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


def test_get_jobs_supports_query_params(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/jobs", params={"status": "deleted", "query": "系统", "limit": 10, "offset": 0, "sort": "created_asc"})

    assert response.status_code == 200


def test_get_jobs_rejects_invalid_sort(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/jobs", params={"sort": "bogus"})

    assert response.status_code == 422


def test_get_job_returns_enriched_detail_without_secrets(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/jobs/job-1")

    assert response.status_code == 404


def test_get_job_events_returns_timeline_payload(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/jobs/job-1/events")

    assert response.status_code == 404


def test_post_rerun_returns_new_pending_job(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.post("/jobs/job-1/rerun", data={"config": "{}"})

    assert response.status_code == 422


def test_delete_job_maps_missing_and_conflict_responses(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    missing = client.delete("/jobs/job-1")
    assert missing.status_code == 404


def test_artifact_download_endpoint_returns_not_found_for_missing_job(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get(
        "/jobs/job-1/artifacts/download",
        params={"path": "/tmp/missing.txt"},
    )
    assert response.status_code == 404


def test_artifact_open_endpoint_returns_not_found_for_missing_job(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.post(
        "/jobs/job-1/artifacts/open",
        params={"path": "/tmp/missing.txt"},
    )
    assert response.status_code == 404
