from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

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
            snapshot = service.create_job(file.filename or "brief.docx", payload, runtime_config)
        except ConfigurationError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        return snapshot.model_dump()

    @router.get("/jobs")
    def list_jobs() -> dict[str, object]:
        return service.list_jobs().model_dump()

    @router.get("/jobs/{job_id}")
    def get_job(job_id: str) -> dict[str, object]:
        snapshot = service.get_job(job_id)
        if snapshot is None:
            raise HTTPException(status_code=404, detail="job not found")
        return snapshot.model_dump()

    return router
