import subprocess
from pathlib import Path

from idea2thesis.git_ops import create_milestone_commit, initialize_repository


def test_initialize_repository_creates_git_directory(tmp_path: Path) -> None:
    initialize_repository(tmp_path)
    assert (tmp_path / ".git").exists()


def test_create_milestone_commit_records_history(tmp_path: Path) -> None:
    initialize_repository(tmp_path)
    file_path = tmp_path / "README.md"
    file_path.write_text("# demo\n", encoding="utf-8")
    create_milestone_commit(tmp_path, "docs: add readme")
    commit = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=True,
    )
    name = subprocess.run(
        ["git", "config", "user.name"],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=True,
    )
    assert commit.stdout.strip()
    assert name.stdout.strip()
