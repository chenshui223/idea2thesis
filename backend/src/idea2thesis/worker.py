from __future__ import annotations

from pathlib import Path
import time
from uuid import uuid4

from idea2thesis.config import Settings
from idea2thesis.contracts import AgentRuntimeOverride, GlobalRuntimeConfig
from idea2thesis.executor import LocalCommandExecutor
from idea2thesis.git_ops import create_milestone_commit, initialize_repository
from idea2thesis.job_store import JobStore
from idea2thesis.orchestrator import SupervisorOrchestrator
from idea2thesis.parser import parse_brief
from idea2thesis.providers.runner import build_agent_provider_configs
from idea2thesis.secrets import delete_job_secret, read_job_secret
from idea2thesis.services import ApplicationService
from idea2thesis.storage import JobPaths


class AsyncJobWorker:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.job_store = JobStore(settings)
        self.orchestrator = SupervisorOrchestrator()
        self.application_service = ApplicationService(settings)
        self.worker_id = f"worker-{uuid4().hex[:8]}"

    def reconcile_startup_state(self) -> int:
        self.job_store.register_worker_session(self.worker_id)
        interrupted = self.job_store.reconcile_stale_running_jobs(
            active_worker_ids={self.worker_id}
        )
        for item in self.job_store.list_jobs().items:
            if item.status != "interrupted":
                continue
            record = self.job_store.get_job_record(item.job_id)
            if record.secret_file_path:
                delete_job_secret(Path(record.secret_file_path))
                self.job_store.clear_secret_file_reference(item.job_id)
        return interrupted

    def run_once(self) -> bool:
        self.job_store.register_worker_session(self.worker_id)
        claimed = self.job_store.claim_next_job(self.worker_id)
        if claimed is None:
            return False

        record = self.job_store.get_job_record(claimed.job_id)
        secret_path = Path(record.secret_file_path) if record.secret_file_path else None
        secret_envelope = None
        if secret_path is not None:
            secret_envelope = read_job_secret(self.settings, secret_path)

        workspace_path = Path(record.workspace_path)
        paths = JobPaths(
            root_dir=workspace_path.parent,
            input_dir=workspace_path.parent / "input",
            parsed_dir=workspace_path.parent / "parsed",
            workspace_dir=workspace_path,
            artifacts_dir=workspace_path.parent / "artifacts",
            logs_dir=workspace_path.parent / "logs",
        )
        brief = parse_brief(Path(record.input_file_path))
        initialize_repository(paths.workspace_dir)
        executor = LocalCommandExecutor(paths.workspace_dir)
        provider_configs = None
        if secret_envelope is not None:
            resolved_configs: dict[str, GlobalRuntimeConfig] = {}
            overrides: dict[str, AgentRuntimeOverride] = {}
            for role in [agent.role for agent in claimed.agents]:
                preset = claimed.runtime_preset.agents.get(role)
                if preset is None or preset.use_global:
                    resolved_configs[role] = GlobalRuntimeConfig(
                        api_key=secret_envelope.global_api_key,
                        base_url=claimed.runtime_preset.global_config.base_url,
                        model=claimed.runtime_preset.global_config.model,
                    )
                    overrides[role] = AgentRuntimeOverride(use_global=True)
                else:
                    resolved_configs[role] = GlobalRuntimeConfig(
                        api_key=secret_envelope.per_agent_api_keys.get(role, secret_envelope.global_api_key),
                        base_url=preset.base_url or claimed.runtime_preset.global_config.base_url,
                        model=preset.model or claimed.runtime_preset.global_config.model,
                    )
                    overrides[role] = AgentRuntimeOverride(
                        use_global=False,
                        base_url=preset.base_url,
                        model=preset.model,
                    )
            provider_configs = build_agent_provider_configs(
                resolved_configs=resolved_configs,
                overrides=overrides,
                per_agent_api_keys=secret_envelope.per_agent_api_keys,
            )
        snapshot = self.orchestrator.run_job(
            claimed.job_id,
            brief,
            paths,
            executor,
            on_progress=lambda stage, agents, event_kind, event_message, payload: self.job_store.record_job_progress(
                job_id=claimed.job_id,
                stage=stage,
                agent_statuses=agents,
                event_kind=event_kind,
                event_message=event_message,
                payload=payload,
            ),
            thesis_cover=self.application_service.get_persisted_settings().global_config.thesis_cover,
            provider_configs=provider_configs,
        )
        self.job_store.mark_job_completed(snapshot, clear_secret_file=True)
        create_milestone_commit(
            paths.workspace_dir, "feat: initialize generated workspace"
        )
        if secret_path is not None:
            delete_job_secret(secret_path)
        return True


def main() -> None:
    settings = Settings()
    worker = AsyncJobWorker(settings)
    worker.reconcile_startup_state()
    while True:
        did_work = worker.run_once()
        if not did_work:
            time.sleep(settings.worker_poll_interval_ms / 1000)


if __name__ == "__main__":
    main()
