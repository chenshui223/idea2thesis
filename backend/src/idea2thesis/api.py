from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from idea2thesis.contracts import PersistedSettings
from idea2thesis.services import ApplicationService, ConfigurationError


def create_router(service: ApplicationService) -> APIRouter:
    router = APIRouter()

    @router.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @router.get("/settings")
    def settings_summary() -> dict[str, object]:
        return service.get_settings_summary().model_dump(by_alias=True)

    @router.put("/settings")
    def update_settings(payload: PersistedSettings) -> dict[str, object]:
        try:
            response = service.save_persisted_settings(payload)
        except ConfigurationError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        return response.model_dump(by_alias=True)

    @router.post("/jobs", status_code=201)
    async def create_job(
        file: UploadFile = File(...), config: str = Form(...)
    ) -> dict[str, object]:
        payload = await file.read()
        try:
            runtime_config = service.parse_runtime_config(config)
            snapshot = service.create_job(
                file.filename or "brief.docx", payload, runtime_config
            )
        except ConfigurationError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        return snapshot.model_dump(by_alias=True)

    @router.get("/jobs")
    def list_jobs(
        status: str | None = None,
        query: str | None = None,
        limit: int = 50,
        offset: int = 0,
        sort: str = "updated_desc",
    ) -> dict[str, object]:
        try:
            return service.list_jobs(
                status=status, query=query, sort=sort, limit=limit, offset=offset
            ).model_dump(by_alias=True)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @router.get("/jobs/{job_id}")
    def get_job(job_id: str) -> dict[str, object]:
        detail = service.get_job(job_id)
        if detail is None:
            raise HTTPException(status_code=404, detail="job not found")
        return detail.model_dump(by_alias=True)

    @router.get("/jobs/{job_id}/events")
    def get_job_events(job_id: str) -> dict[str, object]:
        try:
            return service.list_job_events(job_id).model_dump(by_alias=True)
        except KeyError:
            raise HTTPException(status_code=404, detail="job not found")

    @router.get("/jobs/{job_id}/artifacts/content")
    def get_artifact_content(job_id: str, path: str) -> dict[str, object]:
        try:
            return service.get_artifact_content(job_id, path)
        except KeyError:
            raise HTTPException(status_code=404, detail="artifact not found")
        except ValueError as exc:
            raise HTTPException(status_code=415, detail=str(exc)) from exc

    @router.get("/jobs/{job_id}/artifacts/download")
    def download_artifact(job_id: str, path: str) -> FileResponse:
        try:
            artifact_path = service.get_artifact_download_path(job_id, path)
        except KeyError:
            raise HTTPException(status_code=404, detail="artifact not found")
        return FileResponse(
            path=artifact_path,
            filename=artifact_path.name,
        )

    @router.post("/jobs/{job_id}/artifacts/open")
    def open_artifact(job_id: str, path: str) -> dict[str, object]:
        try:
            return service.open_artifact_in_file_manager(job_id, path)
        except KeyError:
            raise HTTPException(status_code=404, detail="artifact not found")

    @router.get("/jobs/{job_id}/workspace/archive")
    def download_workspace_archive(job_id: str) -> FileResponse:
        try:
            archive_path = service.get_workspace_archive_path(job_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="job not found")
        return FileResponse(
            path=archive_path,
            filename=archive_path.name,
            media_type="application/zip",
        )

    @router.post("/jobs/{job_id}/rerun", status_code=201)
    async def rerun_job(job_id: str, config: str = Form(...)) -> dict[str, object]:
        try:
            runtime_config = service.parse_runtime_config(config)
            detail = service.rerun_job(job_id, runtime_config)
        except ConfigurationError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except KeyError:
            raise HTTPException(status_code=404, detail="job not found")
        return detail.model_dump(by_alias=True)

    @router.delete("/jobs/{job_id}")
    def delete_job(job_id: str) -> dict[str, object]:
        try:
            detail = service.delete_job(job_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="job not found")
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        return detail.model_dump(by_alias=True)

    return router
