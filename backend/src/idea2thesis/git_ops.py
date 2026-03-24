from __future__ import annotations

import subprocess
from pathlib import Path


def _run_git(workspace_dir: Path, args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=workspace_dir,
        capture_output=True,
        text=True,
        check=True,
    )


def initialize_repository(workspace_dir: Path) -> None:
    workspace_dir.mkdir(parents=True, exist_ok=True)
    _run_git(workspace_dir, ["init"])
    _run_git(workspace_dir, ["config", "user.name", "idea2thesis"])
    _run_git(workspace_dir, ["config", "user.email", "idea2thesis@local"])


def create_milestone_commit(workspace_dir: Path, message: str) -> None:
    _run_git(workspace_dir, ["add", "."])
    status = _run_git(workspace_dir, ["status", "--short"])
    if not status.stdout.strip():
        return
    _run_git(workspace_dir, ["commit", "-m", message])
