from pathlib import Path

from idea2thesis.execution_policy import CommandRequest
from idea2thesis.executor import LocalCommandExecutor


def test_executor_returns_policy_denied_report(tmp_path: Path) -> None:
    executor = LocalCommandExecutor(workspace_root=tmp_path)
    report = executor.run(
        CommandRequest(
            executable="git",
            arguments=["status"],
            working_directory=tmp_path,
            purpose="unsupported",
            requires_network=False,
        )
    )
    assert report.status == "policy_denied"


def test_executor_runs_allowed_command_and_captures_output(tmp_path: Path) -> None:
    script = tmp_path / "hello.py"
    script.write_text("print('ok')\n", encoding="utf-8")
    executor = LocalCommandExecutor(workspace_root=tmp_path, timeout_seconds=5)
    report = executor.run(
        CommandRequest(
            executable="python",
            arguments=[str(script)],
            working_directory=tmp_path,
            purpose="smoke",
            requires_network=False,
        )
    )
    assert report.status == "completed"
    assert report.exit_code == 0


def test_executor_returns_runtime_failed_for_nonzero_exit(tmp_path: Path) -> None:
    script = tmp_path / "fail.py"
    script.write_text("raise SystemExit(2)\n", encoding="utf-8")
    executor = LocalCommandExecutor(workspace_root=tmp_path, timeout_seconds=5)
    report = executor.run(
        CommandRequest(
            executable="python",
            arguments=[str(script)],
            working_directory=tmp_path,
            purpose="smoke",
            requires_network=False,
        )
    )
    assert report.status == "runtime_failed"
    assert report.exit_code == 2


def test_executor_returns_runtime_timed_out(tmp_path: Path) -> None:
    script = tmp_path / "sleep.py"
    script.write_text("import time; time.sleep(2)\n", encoding="utf-8")
    executor = LocalCommandExecutor(workspace_root=tmp_path, timeout_seconds=1)
    report = executor.run(
        CommandRequest(
            executable="python",
            arguments=[str(script)],
            working_directory=tmp_path,
            purpose="timeout",
            requires_network=False,
        )
    )
    assert report.status == "runtime_timed_out"


def test_executor_returns_runtime_truncated_for_large_output(tmp_path: Path) -> None:
    script = tmp_path / "spam.py"
    script.write_text("print('x' * 5000)\n", encoding="utf-8")
    executor = LocalCommandExecutor(
        workspace_root=tmp_path,
        timeout_seconds=5,
        max_output_bytes=512,
    )
    report = executor.run(
        CommandRequest(
            executable="python",
            arguments=[str(script)],
            working_directory=tmp_path,
            purpose="output",
            requires_network=False,
        )
    )
    assert report.status == "runtime_truncated"
