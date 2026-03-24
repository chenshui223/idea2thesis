from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from idea2thesis.config import Settings
from idea2thesis.contracts import JobSnapshot, ParsedBrief
from idea2thesis.executor import LocalCommandExecutor
from idea2thesis.git_ops import create_milestone_commit, initialize_repository
from idea2thesis.orchestrator import SupervisorOrchestrator
from idea2thesis.parser import parse_brief
from idea2thesis.storage import JobPaths, JobStorage


class ApplicationService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.storage = JobStorage(settings.jobs_dir)
        self.orchestrator = SupervisorOrchestrator()

    def get_settings_summary(self) -> dict[str, object]:
        return {
            "base_url": self.settings.base_url,
            "model": self.settings.model,
            "api_key_configured": bool(self.settings.api_key),
            "organization": self.settings.organization,
        }

    def create_job(self, file_name: str, file_bytes: bytes) -> JobSnapshot:
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
