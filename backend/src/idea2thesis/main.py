from __future__ import annotations

from fastapi import FastAPI

from idea2thesis.api import create_router
from idea2thesis.config import Settings, get_settings
from idea2thesis.services import ApplicationService


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()
    service = ApplicationService(resolved_settings)
    app = FastAPI(title="idea2thesis")
    app.include_router(create_router(service))
    return app


app = create_app()
