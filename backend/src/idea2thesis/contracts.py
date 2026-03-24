from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

SCHEMA_VERSION = "v1alpha1"


class SchemaCompatibilityError(ValueError):
    """Raised when persisted runtime data uses an unsupported schema version."""


class VersionedModel(BaseModel):
    schema_version: str = Field(default=SCHEMA_VERSION)

    @classmethod
    def _check_schema_version(cls, value: Any) -> None:
        if isinstance(value, dict):
            schema_version = value.get("schema_version", SCHEMA_VERSION)
            if schema_version != SCHEMA_VERSION:
                raise SchemaCompatibilityError(
                    f"unsupported schema_version: {schema_version}"
                )

    @classmethod
    def model_validate(cls, obj: Any, *args: Any, **kwargs: Any) -> "VersionedModel":
        cls._check_schema_version(obj)
        return super().model_validate(obj, *args, **kwargs)

    @classmethod
    def model_validate_json(
        cls, json_data: str | bytes | bytearray, *args: Any, **kwargs: Any
    ) -> "VersionedModel":
        try:
            payload = json.loads(json_data)
        except (TypeError, json.JSONDecodeError):
            payload = None
        cls._check_schema_version(payload)
        return super().model_validate_json(json_data, *args, **kwargs)

    @model_validator(mode="after")
    def validate_schema_version(self) -> "VersionedModel":
        if self.schema_version != SCHEMA_VERSION:
            raise SchemaCompatibilityError(
                f"unsupported schema_version: {self.schema_version}"
            )
        return self


class ParsedBrief(VersionedModel):
    title: str
    requirements: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    tech_hints: list[str] = Field(default_factory=list)
    thesis_cues: list[str] = Field(default_factory=list)
    raw_text: str = ""
    extraction_snapshot: dict[str, Any] = Field(default_factory=dict)


class AgentTask(VersionedModel):
    role: str
    objective: str
    workspace_path: str
    context: dict[str, Any] = Field(default_factory=dict)
    expected_outputs: list[str] = Field(default_factory=list)


class AgentResult(VersionedModel):
    role: str
    status: Literal["done", "failed", "blocked", "pending", "running"]
    summary: str
    changed_files: list[str] = Field(default_factory=list)
    review_notes: list[str] = Field(default_factory=list)


class JobPlan(VersionedModel):
    project_category: str
    stack_policy: str
    review_criteria: list[str] = Field(default_factory=list)
    retries: dict[str, int] = Field(default_factory=dict)
    tasks: list[AgentTask] = Field(default_factory=list)


class ExecutionReport(VersionedModel):
    command: list[str]
    working_directory: str
    status: Literal[
        "completed",
        "policy_denied",
        "policy_unclassified",
        "runtime_failed",
        "runtime_timed_out",
        "runtime_truncated",
    ]
    exit_code: int | None = None
    duration_ms: int
    reason: str
    stdout_path: str = ""
    stderr_path: str = ""
    policy_decision: str = ""


class AgentStatus(BaseModel):
    role: str
    status: Literal["pending", "running", "done", "failed", "blocked"]
    summary: str = ""


class ArtifactRef(BaseModel):
    kind: str
    path: str


class JobSnapshot(VersionedModel):
    job_id: str
    stage: str
    status: Literal["pending", "running", "completed", "failed", "blocked"]
    agents: list[AgentStatus] = Field(default_factory=list)
    artifacts: list[ArtifactRef] = Field(default_factory=list)
    validation_state: Literal["pending", "running", "completed", "blocked"]
    final_disposition: Literal["pending", "completed", "failed", "blocked"]
