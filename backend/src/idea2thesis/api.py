from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile

from idea2thesis.services import ApplicationService


def create_router(service: ApplicationService) -> APIRouter:
    router = APIRouter()

    @router.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @router.get("/settings")
    def settings_summary() -> dict[str, object]:
        return service.get_settings_summary()

    @router.post("/jobs", status_code=201)
    async def create_job(file: UploadFile = File(...)) -> dict[str, object]:
        payload = await file.read()
        snapshot = service.create_job(file.filename or "brief.docx", payload)
        return snapshot.model_dump()

    @router.get("/jobs/{job_id}")
    def get_job(job_id: str) -> dict[str, object]:
        snapshot = service.get_job(job_id)
        if snapshot is None:
            raise HTTPException(status_code=404, detail="job not found")
        return snapshot.model_dump()

    return router
