from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from pydantic import ValidationError

from idea2thesis.config import Settings, atomic_write_text, validate_base_url
from idea2thesis.contracts import (
    JobRuntimeConfig,
    JobSnapshot,
    ParsedBrief,
    PersistedSettings,
    SettingsResponse,
    SchemaCompatibilityError,
)
from idea2thesis.executor import LocalCommandExecutor
from idea2thesis.git_ops import create_milestone_commit, initialize_repository
from idea2thesis.orchestrator import SupervisorOrchestrator
from idea2thesis.parser import parse_brief
from idea2thesis.storage import JobPaths, JobStorage


class ConfigurationError(ValueError):
    """Raised when runtime or persisted configuration is invalid."""


class ApplicationService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.storage = JobStorage(settings.jobs_dir)
        self.orchestrator = SupervisorOrchestrator()

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
        self.orchestrator.resolve_effective_agent_configs(runtime_config)
        job_id = uuid4().hex[:12]
        paths = self.storage.create_job_workspace(job_id)
        safe_name = Path(file_name).name or "brief.docx"
        input_path = paths.input_dir / safe_name
        input_path.write_bytes(file_bytes)

        brief = parse_brief(input_path)
        self._write_parsed_brief(paths, brief)

        initialize_repository(paths.workspace_dir)
        executor = LocalCommandExecutor(paths.workspace_dir)
        snapshot = self.orchestrator.run_job(job_id, brief, paths, executor)
        self._write_snapshot(paths, snapshot)
        create_milestone_commit(paths.workspace_dir, "feat: initialize generated workspace")
        return snapshot

    def get_job(self, job_id: str) -> JobSnapshot | None:
        snapshot_path = self._snapshot_path(job_id)
        if not snapshot_path.exists():
            return None
        return JobSnapshot.model_validate_json(snapshot_path.read_text(encoding="utf-8"))

    def _write_parsed_brief(self, paths: JobPaths, brief: ParsedBrief) -> None:
        parsed_path = paths.parsed_dir / "brief.json"
        parsed_path.write_text(
            json.dumps(brief.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _write_snapshot(self, paths: JobPaths, snapshot: JobSnapshot) -> None:
        self._snapshot_path(paths.root_dir.name).write_text(
            snapshot.model_dump_json(indent=2),
            encoding="utf-8",
        )

    def _snapshot_path(self, job_id: str) -> Path:
        safe_job_id = self.storage.normalize_job_id(job_id)
        return self.settings.jobs_dir / safe_job_id / "parsed" / "snapshot.json"

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
