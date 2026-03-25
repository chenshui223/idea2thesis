from __future__ import annotations

import json
import platform
import subprocess
from pathlib import Path
from uuid import uuid4

from pydantic import ValidationError

from idea2thesis.config import Settings, atomic_write_text, validate_base_url
from idea2thesis.contracts import (
    JobDetailResponse,
    JobListResponse,
    JobRuntimeConfig,
    JobSnapshot,
    ParsedBrief,
    PersistedSettings,
    RerunPreload,
    SettingsResponse,
    SchemaCompatibilityError,
)
from idea2thesis.db import initialize_database
from idea2thesis.executor import LocalCommandExecutor
from idea2thesis.git_ops import create_milestone_commit, initialize_repository
from idea2thesis.job_store import JobStore
from idea2thesis.orchestrator import SupervisorOrchestrator
from idea2thesis.parser import parse_brief
from idea2thesis.secrets import JobSecretEnvelope, delete_job_secret, write_job_secret
from idea2thesis.storage import JobPaths, JobStorage


class ConfigurationError(ValueError):
    """Raised when runtime or persisted configuration is invalid."""


class ApplicationService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.storage = JobStorage(settings.jobs_dir)
        self.orchestrator = SupervisorOrchestrator()
        initialize_database(settings)
        self.job_store = JobStore(settings)

    def get_settings_summary(self) -> SettingsResponse:
        persisted = self.get_persisted_settings()
        return SettingsResponse(
            schema_version=persisted.schema_version,
            global_config=persisted.global_config,
            agents=persisted.agents,
            api_key_configured=bool(self.settings.api_key),
        )

    def get_persisted_settings(self) -> PersistedSettings:
        if self.settings.settings_file.exists():
            payload = self.settings.settings_file.read_text(encoding="utf-8")
            return PersistedSettings.model_validate_json(payload)
        return PersistedSettings.model_validate(
            {
                "schema_version": "v1alpha1",
                "global": {
                    "base_url": self.settings.base_url,
                    "model": self.settings.model,
                },
                "agents": {},
            }
        )

    def save_persisted_settings(self, persisted: PersistedSettings) -> SettingsResponse:
        self._validate_persisted_settings(persisted)
        atomic_write_text(
            self.settings.settings_file,
            persisted.model_dump_json(indent=2, by_alias=True),
        )
        return SettingsResponse(
            schema_version=persisted.schema_version,
            global_config=persisted.global_config,
            agents=persisted.agents,
            api_key_configured=bool(self.settings.api_key),
        )

    def parse_runtime_config(self, raw_config: str) -> JobRuntimeConfig:
        try:
            config = JobRuntimeConfig.model_validate_json(raw_config)
        except (ValidationError, SchemaCompatibilityError, ValueError) as exc:
            raise ConfigurationError(f"invalid runtime config: {exc}") from exc
        self._validate_runtime_config(config)
        return config

    def create_job(
        self, file_name: str, file_bytes: bytes, runtime_config: JobRuntimeConfig
    ) -> JobSnapshot:
        job_id = uuid4().hex[:12]
        paths = self.storage.create_job_workspace(job_id)
        secret_path: Path | None = None
        try:
            self.orchestrator.resolve_effective_agent_configs(runtime_config)
            safe_name = Path(file_name).name or "brief.docx"
            input_path = paths.input_dir / safe_name
            input_path.write_bytes(file_bytes)

            brief = parse_brief(input_path)
            self._write_parsed_brief(paths, brief)

            secret_path = write_job_secret(
                self.settings,
                job_id,
                JobSecretEnvelope(
                    global_api_key=runtime_config.global_config.api_key,
                    per_agent_api_keys={
                        role: override.api_key
                        for role, override in runtime_config.agents.items()
                        if override.api_key.strip()
                    },
                ),
            )

            return self.job_store.create_job(
                job_id=job_id,
                brief_title=brief.title,
                input_file_path=str(input_path),
                workspace_path=str(paths.workspace_dir),
                secret_file_path=str(secret_path),
                runtime_inputs={
                    "global_base_url": runtime_config.global_config.base_url,
                    "global_model": runtime_config.global_config.model,
                    "agents_json": self._persisted_runtime_agents_json(runtime_config),
                    "api_key_required": True,
                },
                agents=[
                    task.role
                    for task in self.orchestrator.build_plan(brief).tasks
                ],
            )
        except Exception:
            if secret_path is not None:
                delete_job_secret(secret_path)
            if paths.root_dir.exists():
                for path in sorted(paths.root_dir.rglob("*"), reverse=True):
                    if path.is_file():
                        path.unlink(missing_ok=True)
                    elif path.is_dir():
                        path.rmdir()
                paths.root_dir.rmdir()
            raise

    def get_job(self, job_id: str) -> JobDetailResponse | None:
        try:
            return self.job_store.get_job(job_id)
        except KeyError:
            return None

    def list_jobs(
        self,
        *,
        status: str | None = None,
        query: str | None = None,
        sort: str = "updated_desc",
        limit: int = 50,
        offset: int = 0,
    ) -> JobListResponse:
        return self.job_store.list_jobs(
            status=status, query=query, sort=sort, limit=limit, offset=offset
        )

    def list_job_events(self, job_id: str):
        return self.job_store.list_job_events(job_id)

    def get_artifact_content(self, job_id: str, path: str) -> dict[str, object]:
        target_path = self._resolve_registered_artifact_path(job_id, path)

        try:
            content = target_path.read_text(encoding="utf-8")
        except UnicodeDecodeError as exc:
            raise ValueError("artifact is not a utf-8 text file") from exc

        limit = 20000
        truncated = len(content) > limit
        return {
            "path": str(target_path),
            "content": content[:limit],
            "truncated": truncated,
        }

    def get_artifact_download_path(self, job_id: str, path: str) -> Path:
        return self._resolve_registered_artifact_path(job_id, path)

    def open_artifact_in_file_manager(self, job_id: str, path: str) -> dict[str, object]:
        target_path = self._resolve_registered_artifact_path(job_id, path)
        command = self._build_file_manager_command(target_path)
        subprocess.run(command, check=False)
        return {"ok": True, "path": str(target_path)}

    def rerun_job(
        self, source_job_id: str, runtime_config: JobRuntimeConfig
    ) -> JobDetailResponse:
        new_job_id = uuid4().hex[:12]
        self.orchestrator.resolve_effective_agent_configs(runtime_config)
        source = self.job_store.get_job(source_job_id)
        runtime_inputs = {
            "global_base_url": runtime_config.global_config.base_url,
            "global_model": runtime_config.global_config.model,
            "agents_json": self._persisted_runtime_agents_json(runtime_config),
            "api_key_required": True,
        }
        secret_path = write_job_secret(
            self.settings,
            new_job_id,
            JobSecretEnvelope(
                global_api_key=runtime_config.global_config.api_key,
                per_agent_api_keys={
                    role: override.api_key
                    for role, override in runtime_config.agents.items()
                    if override.api_key.strip()
                },
            ),
        )
        return self.job_store.create_rerun_job(
            source_job_id=source.job_id,
            new_job_id=new_job_id,
            secret_file_path=str(secret_path),
            runtime_inputs=runtime_inputs,
            agents=[
                task.role
                for task in self.orchestrator.build_plan(
                    parse_brief(Path(source.input_file_path))
                ).tasks
            ],
        )

    def delete_job(self, job_id: str) -> JobDetailResponse:
        return self.job_store.soft_delete_job(job_id)

    def _write_parsed_brief(self, paths: JobPaths, brief: ParsedBrief) -> None:
        parsed_path = paths.parsed_dir / "brief.json"
        parsed_path.write_text(
            json.dumps(brief.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _validate_persisted_settings(self, persisted: PersistedSettings) -> None:
        try:
            validate_base_url(persisted.global_config.base_url)
            for agent in persisted.agents.values():
                if agent.base_url.strip():
                    validate_base_url(agent.base_url)
        except ValueError as exc:
            raise ConfigurationError(str(exc)) from exc

    def _validate_runtime_config(self, runtime_config: JobRuntimeConfig) -> None:
        try:
            validate_base_url(runtime_config.global_config.base_url)
            for agent in runtime_config.agents.values():
                if agent.base_url.strip():
                    validate_base_url(agent.base_url)
            self.orchestrator.resolve_effective_agent_configs(runtime_config)
        except ValueError as exc:
            raise ConfigurationError(str(exc)) from exc

    def _persisted_runtime_agents_json(self, runtime_config: JobRuntimeConfig) -> str:
        persisted_agents = {}
        for role, override in runtime_config.agents.items():
            persisted_agents[role] = {
                "use_global": override.use_global,
                "base_url": override.base_url,
                "model": override.model,
            }
        return json.dumps(persisted_agents, ensure_ascii=False)

    def _resolve_registered_artifact_path(self, job_id: str, path: str) -> Path:
        detail = self.get_job(job_id)
        if detail is None:
            raise KeyError(job_id)

        registered_paths = {artifact.path for artifact in detail.artifacts}
        if path not in registered_paths:
            raise KeyError(path)

        job_root = Path(detail.workspace_path).parent.resolve()
        target_path = Path(path).resolve()
        if target_path != job_root and job_root not in target_path.parents:
            raise KeyError(path)
        if not target_path.is_file():
            raise KeyError(path)
        return target_path

    def _build_file_manager_command(self, target_path: Path) -> list[str]:
        system = platform.system()
        if system == "Darwin":
            return ["open", str(target_path.parent)]
        if system == "Windows":
            return ["explorer", str(target_path.parent)]
        return ["xdg-open", str(target_path.parent)]
