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
        self.base_dir = base_dir.resolve()

    def _validate_job_id(self, job_id: str) -> str:
        candidate = Path(job_id)
        if candidate.is_absolute():
            raise ValueError("job_id must be relative")
        if any(part in {"..", "."} for part in candidate.parts):
            raise ValueError("job_id must not contain path traversal")
        normalized = candidate.as_posix()
        if not normalized or normalized == ".":
            raise ValueError("job_id must not be empty")
        return normalized

    def create_job_workspace(self, job_id: str) -> JobPaths:
        safe_job_id = self._validate_job_id(job_id)
        root_dir = (self.base_dir / safe_job_id).resolve()
        if root_dir != self.base_dir and self.base_dir not in root_dir.parents:
            raise ValueError("job workspace escapes base_dir")
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
