from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path

from idea2thesis.contracts import ExecutionReport
from idea2thesis.execution_policy import CommandRequest, ExecutionPolicy


class LocalCommandExecutor:
    def __init__(
        self,
        workspace_root: Path,
        timeout_seconds: int = 30,
        max_output_bytes: int = 8_192,
    ) -> None:
        self.workspace_root = workspace_root
        self.timeout_seconds = timeout_seconds
        self.max_output_bytes = max_output_bytes
        self.policy = ExecutionPolicy(workspace_root=workspace_root)

    def _log_dir(self, working_directory: Path) -> Path:
        log_dir = working_directory / ".idea2thesis-logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        return log_dir

    def _write_logs(
        self,
        working_directory: Path,
        stdout: str,
        stderr: str,
        prefix: str,
    ) -> tuple[str, str]:
        log_dir = self._log_dir(working_directory)
        stdout_path = log_dir / f"{prefix}.stdout.log"
        stderr_path = log_dir / f"{prefix}.stderr.log"
        stdout_path.write_text(stdout, encoding="utf-8")
        stderr_path.write_text(stderr, encoding="utf-8")
        return str(stdout_path), str(stderr_path)

    def run(self, request: CommandRequest) -> ExecutionReport:
        decision = self.policy.evaluate(request)
        command = [request.executable, *request.arguments]
        if decision.status != "allowed":
            return ExecutionReport(
                command=command,
                working_directory=str(request.working_directory),
                status=decision.status,
                exit_code=None,
                duration_ms=0,
                reason=decision.reason,
                policy_decision=decision.status,
            )

        start = time.perf_counter()
        env = {"PATH": os.environ.get("PATH", "")}
        try:
            completed = subprocess.run(
                command,
                cwd=request.working_directory,
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
                env=env,
                check=False,
            )
        except subprocess.TimeoutExpired:
            duration_ms = int((time.perf_counter() - start) * 1000)
            stdout = ""
            stderr = ""
            stdout_path, stderr_path = self._write_logs(
                request.working_directory,
                stdout,
                stderr,
                "timeout",
            )
            return ExecutionReport(
                command=command,
                working_directory=str(request.working_directory),
                status="runtime_timed_out",
                exit_code=None,
                duration_ms=duration_ms,
                reason="command timed out",
                stdout_path=stdout_path,
                stderr_path=stderr_path,
                policy_decision="allowed",
            )

        duration_ms = int((time.perf_counter() - start) * 1000)
        stdout = completed.stdout or ""
        stderr = completed.stderr or ""
        stdout_path, stderr_path = self._write_logs(
            request.working_directory,
            stdout,
            stderr,
            "command",
        )
        total_output = len(stdout.encode("utf-8")) + len(stderr.encode("utf-8"))
        if total_output > self.max_output_bytes:
            return ExecutionReport(
                command=command,
                working_directory=str(request.working_directory),
                status="runtime_truncated",
                exit_code=completed.returncode,
                duration_ms=duration_ms,
                reason="output exceeded limit",
                stdout_path=stdout_path,
                stderr_path=stderr_path,
                policy_decision="allowed",
            )

        status = "completed" if completed.returncode == 0 else "runtime_failed"
        return ExecutionReport(
            command=command,
            working_directory=str(request.working_directory),
            status=status,
            exit_code=completed.returncode,
            duration_ms=duration_ms,
            reason="completed" if status == "completed" else "command failed",
            stdout_path=stdout_path,
            stderr_path=stderr_path,
            policy_decision="allowed",
        )
