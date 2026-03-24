from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal


@dataclass(frozen=True)
class CommandRequest:
    executable: str
    arguments: list[str]
    working_directory: Path
    purpose: str
    requires_network: bool


@dataclass(frozen=True)
class PolicyOutcome:
    status: Literal["allowed", "policy_denied", "policy_unclassified"]
    reason: str


class ExecutionPolicy:
    ALLOWLIST = {
        "python",
        "pip",
        "pytest",
        "node",
        "npm",
        "pnpm",
        "yarn",
        "npx",
        "uv",
        "bash",
        "sh",
    }
    NETWORK_INSTALLERS = {"pip", "npm", "pnpm", "yarn", "uv"}

    def __init__(self, workspace_root: Path) -> None:
        self.workspace_root = workspace_root.resolve()

    def _is_within_workspace(self, path: Path) -> bool:
        resolved = path.resolve()
        return resolved == self.workspace_root or self.workspace_root in resolved.parents

    def _validate_argument_paths(self, request: CommandRequest) -> PolicyOutcome | None:
        for argument in request.arguments:
            if argument.startswith("-"):
                continue
            candidate = Path(argument)
            if not candidate.is_absolute() and len(candidate.parts) <= 1:
                continue
            target = candidate if candidate.is_absolute() else request.working_directory / candidate
            try:
                resolved = target.resolve()
            except FileNotFoundError:
                resolved = target.parent.resolve() / target.name
            if not self._is_within_workspace(resolved):
                return PolicyOutcome("policy_denied", "argument path escapes workspace")
        return None

    def evaluate(self, request: CommandRequest) -> PolicyOutcome:
        if not self._is_within_workspace(request.working_directory):
            return PolicyOutcome("policy_denied", "working directory escapes workspace")

        if request.executable not in self.ALLOWLIST:
            return PolicyOutcome("policy_denied", "executable not allowed")

        joined_args = " ".join(request.arguments)
        if "curl " in joined_args and "|" in joined_args:
            return PolicyOutcome("policy_denied", "remote shell pipeline denied")
        if "wget " in joined_args and "|" in joined_args:
            return PolicyOutcome("policy_denied", "remote shell pipeline denied")
        if any(flag in joined_args for flag in ("--ignore-scripts=false", "postinstall")):
            return PolicyOutcome("policy_denied", "install scripts not allowed")

        path_outcome = self._validate_argument_paths(request)
        if path_outcome is not None:
            return path_outcome

        if request.executable in {"bash", "sh"} and request.requires_network:
            return PolicyOutcome("policy_unclassified", "shell command requires manual review")

        if request.requires_network and request.executable not in self.NETWORK_INSTALLERS:
            return PolicyOutcome("policy_denied", "network not allowed for executable")

        if request.executable in {"npm", "pnpm", "yarn"} and "install" in request.arguments:
            if "--ignore-scripts" not in request.arguments:
                return PolicyOutcome("policy_denied", "install scripts must be disabled")

        return PolicyOutcome("allowed", "request allowed")
