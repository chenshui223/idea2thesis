from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class JobPaths:
    root_dir: Path
    input_dir: Path
    parsed_dir: Path
    workspace_dir: Path
    artifacts_dir: Path
    logs_dir: Path


class JobStorage:
    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir

    def create_job_workspace(self, job_id: str) -> JobPaths:
        root_dir = self.base_dir / job_id
        paths = JobPaths(
            root_dir=root_dir,
            input_dir=root_dir / "input",
            parsed_dir=root_dir / "parsed",
            workspace_dir=root_dir / "workspace",
            artifacts_dir=root_dir / "artifacts",
            logs_dir=root_dir / "logs",
        )
        for path in (
            paths.root_dir,
            paths.input_dir,
            paths.parsed_dir,
            paths.workspace_dir,
            paths.artifacts_dir,
            paths.logs_dir,
        ):
            path.mkdir(parents=True, exist_ok=True)
        return paths
