from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

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


class GlobalRuntimeConfig(BaseModel):
    api_key: str = ""
    base_url: str = ""
    model: str = ""


class AgentRuntimeOverride(BaseModel):
    use_global: bool = True
    api_key: str = ""
    base_url: str = ""
    model: str = ""


class JobRuntimeConfig(VersionedModel):
    model_config = ConfigDict(populate_by_name=True)

    global_config: GlobalRuntimeConfig = Field(alias="global")
    agents: dict[str, AgentRuntimeOverride] = Field(default_factory=dict)


class PersistedGlobalSettings(BaseModel):
    base_url: str = ""
    model: str = ""


class PersistedAgentSettings(BaseModel):
    use_global: bool = True
    base_url: str = ""
    model: str = ""


class PersistedSettings(VersionedModel):
    model_config = ConfigDict(populate_by_name=True)

    global_config: PersistedGlobalSettings = Field(alias="global")
    agents: dict[str, PersistedAgentSettings] = Field(default_factory=dict)


class SettingsResponse(PersistedSettings):
    api_key_configured: bool = False


class AgentStatus(BaseModel):
    role: str
    status: Literal["pending", "running", "done", "failed", "blocked"]
    summary: str = ""


class ArtifactRef(BaseModel):
    kind: str
    path: str


class JobListItem(VersionedModel):
    job_id: str
    brief_title: str
    status: Literal[
        "pending",
        "running",
        "completed",
        "failed",
        "blocked",
        "interrupted",
        "deleted",
    ]
    stage: str
    updated_at: str
    created_at: str
    final_disposition: Literal[
        "pending",
        "completed",
        "failed",
        "blocked",
        "interrupted",
        "deleted",
    ]


class JobListResponse(VersionedModel):
    items: list[JobListItem] = Field(default_factory=list)
    total: int = 0


class JobSnapshot(VersionedModel):
    job_id: str
    stage: str
    status: Literal[
        "pending",
        "running",
        "completed",
        "failed",
        "blocked",
        "interrupted",
        "deleted",
    ]
    agents: list[AgentStatus] = Field(default_factory=list)
    artifacts: list[ArtifactRef] = Field(default_factory=list)
    validation_state: Literal["pending", "running", "completed", "blocked"]
    final_disposition: Literal[
        "pending",
        "completed",
        "failed",
        "blocked",
        "interrupted",
        "deleted",
    ]


class RuntimePresetGlobal(BaseModel):
    base_url: str = ""
    model: str = ""


class RuntimePresetAgent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    use_global: bool = Field(default=True, alias="useGlobal")
    base_url: str = ""
    model: str = ""

    def model_dump(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        kwargs.setdefault("by_alias", True)
        return super().model_dump(*args, **kwargs)


class RuntimePreset(VersionedModel):
    model_config = ConfigDict(populate_by_name=True)

    global_config: RuntimePresetGlobal = Field(alias="global")
    agents: dict[str, RuntimePresetAgent] = Field(default_factory=dict)


class RerunPreload(RuntimePreset):
    pass


class JobDetailResponse(VersionedModel):
    job_id: str
    brief_title: str
    source_job_id: str | None = None
    workspace_path: str
    input_file_path: str
    error_message: str = ""
    deleted_at: str | None = None
    status: Literal[
        "pending",
        "running",
        "completed",
        "failed",
        "blocked",
        "interrupted",
        "deleted",
    ]
    stage: str
    created_at: str
    updated_at: str
    started_at: str | None = None
    finished_at: str | None = None
    validation_state: Literal["pending", "running", "completed", "blocked"]
    final_disposition: Literal[
        "pending",
        "completed",
        "failed",
        "blocked",
        "interrupted",
        "deleted",
    ]
    agents: list[AgentStatus] = Field(default_factory=list)
    artifacts: list[ArtifactRef] = Field(default_factory=list)
    runtime_preset: RuntimePreset


class JobEventItem(VersionedModel):
    id: int
    timestamp: str
    kind: str
    message: str
    payload: dict[str, Any] = Field(default_factory=dict)


class EventListResponse(VersionedModel):
    items: list[JobEventItem] = Field(default_factory=list)
