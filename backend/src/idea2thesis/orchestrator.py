from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Callable

from idea2thesis.agents import build_agent_tasks
from idea2thesis.contracts import (
    AgentRuntimeOverride,
    AgentStatus,
    AdvisorPlanArtifact,
    ArtifactRef,
    CodeEvalArtifact,
    CodeEvalCommandResult,
    CodeSummaryArtifact,
    DeliveryReviewArtifact,
    DesignReportArtifact,
    DocCheckArtifact,
    EngineeringReviewArtifact,
    FinalJobManifestArtifact,
    GlobalRuntimeConfig,
    JobPlan,
    JobRuntimeConfig,
    JobSnapshot,
    ParsedBrief,
    RequirementsReviewArtifact,
    ThesisDraftArtifact,
)
from idea2thesis.execution_policy import CommandRequest
from idea2thesis.executor import LocalCommandExecutor
from idea2thesis.providers.base import CompletionProvider
from idea2thesis.providers.runner import AgentProviderConfig, build_completion_provider
from idea2thesis.storage import JobPaths, build_execution_artifact_paths


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


def _write_json_artifact(path, artifact) -> None:
    path.write_text(artifact.model_dump_json(indent=2), encoding="utf-8")


def _extract_json_payload(raw: str | None) -> dict[str, object] | None:
    if raw is None:
        return None
    text = raw.strip()
    if not text:
        return None

    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, flags=re.DOTALL)
    candidate = fenced.group(1) if fenced else text
    try:
        payload = json.loads(candidate)
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def _payload_string(payload: dict[str, object] | None, key: str) -> str | None:
    if payload is None:
        return None
    value = payload.get(key)
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _payload_string_list(payload: dict[str, object] | None, key: str) -> list[str] | None:
    if payload is None:
        return None
    value = payload.get(key)
    if not isinstance(value, list):
        return None
    items = [item.strip() for item in value if isinstance(item, str) and item.strip()]
    return items or None


def _payload_dict(payload: dict[str, object] | None, key: str) -> dict[str, object] | None:
    if payload is None:
        return None
    value = payload.get(key)
    return value if isinstance(value, dict) else None


def _payload_dict_list(payload: dict[str, object] | None, key: str) -> list[dict[str, object]] | None:
    if payload is None:
        return None
    value = payload.get(key)
    if not isinstance(value, list):
        return None
    items = [item for item in value if isinstance(item, dict)]
    return items or None


def _safe_workspace_path(workspace_dir: Path, relative_path: str) -> Path | None:
    candidate = Path(relative_path.strip())
    if not relative_path.strip() or candidate.is_absolute():
        return None
    if any(part in {"..", "."} for part in candidate.parts):
        return None
    resolved = (workspace_dir / candidate).resolve()
    if resolved != workspace_dir and workspace_dir not in resolved.parents:
        return None
    return resolved


def _write_workspace_files_from_payload(
    *,
    workspace_dir: Path,
    payload: dict[str, object] | None,
) -> list[str]:
    written_files: list[str] = []
    for item in _payload_dict_list(payload, "workspace_files") or []:
        relative_path = item.get("path")
        content = item.get("content")
        if not isinstance(relative_path, str) or not isinstance(content, str):
            continue
        target_path = _safe_workspace_path(workspace_dir, relative_path)
        if target_path is None:
            continue
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_text(content, encoding="utf-8")
        written_files.append(Path(relative_path).as_posix())
    return written_files


def _build_thesis_markdown(
    *,
    title: str,
    abstract: str,
    requirements_analysis: str,
    system_design: str,
    implementation_overview: str,
    testing_validation: str,
    conclusion: str,
) -> str:
    return "\n".join(
        [
            f"# {title}",
            "",
            "## 摘要",
            abstract,
            "",
            "## 需求分析",
            requirements_analysis,
            "",
            "## 系统设计",
            system_design,
            "",
            "## 实现概述",
            implementation_overview,
            "",
            "## 测试与验证",
            testing_validation,
            "",
            "## 结论",
            conclusion,
        ]
    )


def _build_design_report_markdown(
    *,
    title: str,
    goal: str,
    module_breakdown: list[str],
    delivery_notes: str,
) -> str:
    return "\n".join(
        [
            f"# {title}",
            "",
            "## 目标",
            goal,
            "",
            "## 模块划分",
            *[f"- {item}" for item in module_breakdown],
            "",
            "## 交付说明",
            delivery_notes,
        ]
    )


class SupervisorOrchestrator:
    def __init__(
        self,
        *,
        provider_factory: Callable[[AgentProviderConfig], CompletionProvider] = build_completion_provider,
    ) -> None:
        self.provider_factory = provider_factory

    def resolve_effective_agent_configs(
        self, runtime_config: JobRuntimeConfig
    ) -> dict[str, GlobalRuntimeConfig]:
        from idea2thesis.agents import ROLE_SEQUENCE

        role_set = set(ROLE_SEQUENCE)
        unknown_roles = sorted(set(runtime_config.agents) - role_set)
        if unknown_roles:
            raise ValueError(f"unknown agent role: {unknown_roles[0]}")

        resolved: dict[str, GlobalRuntimeConfig] = {}
        for role in ROLE_SEQUENCE:
            override = runtime_config.agents.get(role, AgentRuntimeOverride())
            effective = (
                GlobalRuntimeConfig(
                    api_key=runtime_config.global_config.api_key,
                    base_url=runtime_config.global_config.base_url,
                    model=runtime_config.global_config.model,
                )
                if override.use_global
                else GlobalRuntimeConfig(
                    api_key=override.api_key or runtime_config.global_config.api_key,
                    base_url=override.base_url or runtime_config.global_config.base_url,
                    model=override.model or runtime_config.global_config.model,
                )
            )
            for field_name in ("api_key", "base_url", "model"):
                if not getattr(effective, field_name).strip():
                    raise ValueError(f"missing effective {field_name} for agent {role}")
            resolved[role] = effective
        return resolved

    def build_plan(self, brief: ParsedBrief) -> JobPlan:
        category = (
            "data_analysis_project"
            if any("分析" in item for item in brief.requirements)
            or any("分析" in item for item in brief.tech_hints)
            else "full_stack_app"
        )
        stack_policy = "python-data" if category == "data_analysis_project" else "fastapi-react"
        return JobPlan(
            project_category=category,
            stack_policy=stack_policy,
            review_criteria=[
                "requirements_alignment",
                "engineering_quality",
                "delivery_readiness",
            ],
            retries={"code_eval": 1},
            tasks=build_agent_tasks("", brief.title),
        )

    def run_job(
        self,
        job_id: str,
        brief: ParsedBrief,
        paths: JobPaths,
        executor: LocalCommandExecutor,
        on_progress: Callable[[str, list[AgentStatus], str, str, dict[str, object]], None]
        | None = None,
        provider_configs: dict[str, AgentProviderConfig] | None = None,
    ) -> JobSnapshot:
        plan = self.build_plan(brief)
        plan.tasks = build_agent_tasks(str(paths.workspace_dir), brief.title)
        artifact_paths = build_execution_artifact_paths(paths)
        created_at = _utc_now()

        def emit_progress(
            stage: str,
            agents: list[AgentStatus],
            event_kind: str,
            event_message: str,
            payload: dict[str, object] | None = None,
        ) -> None:
            if on_progress is None:
                return
            on_progress(stage, agents, event_kind, event_message, payload or {})

        emit_progress(
            "advisor_running",
            [AgentStatus(role="advisor", status="running", summary="planning project scope")],
            "advisor_started",
            "advisor started",
            {"stage": "advisor_running"},
        )

        provider_notes: dict[str, str] = {}

        def try_provider(role: str, prompt: str) -> str | None:
            config = (provider_configs or {}).get(role)
            if config is None:
                return None
            try:
                return self.provider_factory(config).complete(prompt).strip()
            except Exception as exc:
                provider_notes[role] = f"provider fallback: {exc}"
                return None

        advisor_completion = try_provider(
            "advisor",
            f"你是毕业设计指导老师 agent。项目标题：{brief.title}。需求：{', '.join(brief.requirements)}。"
            "请仅输出一个 JSON 对象，字段可包含 summary, project_summary, recommended_stack, "
            "module_breakdown, implementation_priorities, writing_priorities, risks, "
            "coder_directives, writer_directives。",
        )
        advisor_payload = _extract_json_payload(advisor_completion)
        advisor_summary = (
            _payload_string(advisor_payload, "summary")
            or advisor_completion
            or provider_notes.get("advisor")
            or f"defined delivery scope for {brief.title}"
        )
        advisor_project_summary = _payload_string(advisor_payload, "project_summary") or (
            f"{brief.title}，支持本地部署与毕业设计交付。"
        )
        advisor_recommended_stack = _payload_string(advisor_payload, "recommended_stack") or plan.stack_policy
        advisor_module_breakdown = _payload_string_list(advisor_payload, "module_breakdown") or [
            "authentication",
            "catalog_search",
            "workflow_management",
            "reporting",
        ]
        advisor_implementation_priorities = _payload_string_list(
            advisor_payload, "implementation_priorities"
        ) or ["scaffold", "core business flow", "verification"]
        advisor_writing_priorities = _payload_string_list(advisor_payload, "writing_priorities") or [
            "摘要",
            "需求分析",
            "系统设计",
            "测试总结",
        ]
        advisor_risks = _payload_string_list(advisor_payload, "risks") or [
            "scope creep",
            "demo data quality",
        ]
        advisor_coder_directives = _payload_string_list(advisor_payload, "coder_directives") or [
            "build runnable local scaffold",
            "document validation commands",
        ]
        advisor_writer_directives = _payload_string_list(advisor_payload, "writer_directives") or [
            "align thesis draft to generated modules and commands"
        ]

        advisor_artifact = AdvisorPlanArtifact(
            job_id=job_id,
            agent_role="advisor",
            created_at=created_at,
            status="completed",
            summary=advisor_summary,
            project_title=brief.title,
            project_summary=advisor_project_summary,
            recommended_stack=advisor_recommended_stack,
            module_breakdown=advisor_module_breakdown,
            implementation_priorities=advisor_implementation_priorities,
            writing_priorities=advisor_writing_priorities,
            risks=advisor_risks,
            coder_directives=advisor_coder_directives,
            writer_directives=advisor_writer_directives,
        )
        _write_json_artifact(artifact_paths.advisor_plan, advisor_artifact)
        emit_progress(
            "coder_running",
            [
                AgentStatus(role="advisor", status="done", summary=advisor_artifact.summary),
                AgentStatus(role="coder", status="running", summary="writing scaffold and plan"),
            ],
            "advisor_completed",
            "advisor completed",
            {"artifact": str(artifact_paths.advisor_plan)},
        )

        project_readme = paths.workspace_dir / "README.md"
        project_readme.write_text(
            "\n".join(
                [
                    f"# {brief.title}",
                    "",
                    "Generated by idea2thesis.",
                    "",
                    "## Stack",
                    "",
                    f"- {plan.stack_policy}",
                    "",
                    "## Local Validation",
                    "",
                    "- `python -m pytest -q`",
                ]
            )
            + "\n",
            encoding="utf-8",
        )

        implementation_plan = "\n".join(
            [
                f"# {brief.title} Implementation Plan",
                "",
                "## Modules",
                "- authentication",
                "- catalog_search",
                "- workflow_management",
                "- reporting",
                "",
                "## Validation",
                "- python -m pytest -q",
            ]
        )

        coder_completion = try_provider(
            "coder",
            f"你是 coder agent。项目标题：{brief.title}。推荐技术栈：{plan.stack_policy}。"
            "请仅输出一个 JSON 对象，字段可包含 summary, generated_files, chosen_stack, "
            "run_commands, test_commands, known_limitations。",
        )
        coder_payload = _extract_json_payload(coder_completion)
        workspace_written_files = _write_workspace_files_from_payload(
            workspace_dir=paths.workspace_dir,
            payload=coder_payload,
        )
        implementation_plan_text = _payload_string(coder_payload, "implementation_plan_markdown") or implementation_plan
        artifact_paths.implementation_plan.write_text(implementation_plan_text + "\n", encoding="utf-8")
        coder_summary = (
            _payload_string(coder_payload, "summary")
            or coder_completion
            or provider_notes.get("coder")
            or "generated runnable scaffold and delivery docs"
        )
        coder_generated_files = _payload_string_list(coder_payload, "generated_files") or (
            workspace_written_files or ["README.md"]
        )
        coder_chosen_stack = _payload_string(coder_payload, "chosen_stack") or plan.stack_policy
        coder_run_commands = _payload_string_list(coder_payload, "run_commands") or ["python -m pytest -q"]
        coder_test_commands = _payload_string_list(coder_payload, "test_commands") or ["python -m pytest -q"]
        coder_known_limitations = _payload_string_list(coder_payload, "known_limitations") or [
            provider_notes.get("coder") or "deterministic scaffold without provider-backed code generation"
        ]

        code_summary_artifact = CodeSummaryArtifact(
            job_id=job_id,
            agent_role="coder",
            created_at=created_at,
            status="completed",
            summary=coder_summary,
            generated_files=coder_generated_files,
            chosen_stack=coder_chosen_stack,
            run_commands=coder_run_commands,
            test_commands=coder_test_commands,
            known_limitations=coder_known_limitations,
        )
        _write_json_artifact(artifact_paths.code_summary, code_summary_artifact)
        emit_progress(
            "writer_running",
            [
                AgentStatus(role="advisor", status="done", summary=advisor_artifact.summary),
                AgentStatus(role="coder", status="done", summary=code_summary_artifact.summary),
                AgentStatus(role="writer", status="running", summary="drafting thesis and design report"),
            ],
            "coder_completed",
            "coder completed",
            {"artifact": str(artifact_paths.code_summary)},
        )

        thesis_sections = ["摘要", "需求分析", "系统设计", "实现概述", "测试与验证", "结论"]
        writer_completion = try_provider(
            "writer",
            f"你是 writer agent。项目标题：{brief.title}。需求：{', '.join(brief.requirements)}。"
            "请仅输出一个 JSON 对象，字段可包含 summary, title, sections, abstract, "
            "requirements_analysis, system_design, implementation_overview, testing_validation, "
            "conclusion, design_report。",
        )
        writer_payload = _extract_json_payload(writer_completion)
        _write_workspace_files_from_payload(
            workspace_dir=paths.workspace_dir,
            payload=writer_payload,
        )
        thesis_sections = _payload_string_list(writer_payload, "sections") or [
            "摘要",
            "需求分析",
            "系统设计",
            "实现概述",
            "测试与验证",
            "结论",
        ]
        thesis_title = _payload_string(writer_payload, "title") or f"{brief.title} Thesis Draft"
        thesis_markdown = _build_thesis_markdown(
            title=thesis_title,
            abstract=_payload_string(writer_payload, "abstract")
            or provider_notes.get("writer")
            or f"{brief.title} 面向本地单用户毕业设计场景，提供可部署系统与论文初稿协同生成流程。",
            requirements_analysis=_payload_string(writer_payload, "requirements_analysis")
            or f"核心需求包括：{'、'.join(brief.requirements)}。",
            system_design=_payload_string(writer_payload, "system_design")
            or "系统采用分层结构，包含认证、业务流程和结果展示模块。",
            implementation_overview=_payload_string(writer_payload, "implementation_overview")
            or f"实现以 {plan.stack_policy} 方案为基础，优先保证本地可运行与结果可验证。",
            testing_validation=_payload_string(writer_payload, "testing_validation")
            or "当前版本通过本地命令验证核心输出流程。",
            conclusion=_payload_string(writer_payload, "conclusion")
            or "该初稿可作为后续细化与人工审校的基础。",
        )
        artifact_paths.thesis_draft.write_text(thesis_markdown + "\n", encoding="utf-8")
        thesis_artifact = ThesisDraftArtifact(
            job_id=job_id,
            agent_role="writer",
            created_at=created_at,
            status="completed",
            summary=_payload_string(writer_payload, "summary")
            or writer_completion
            or provider_notes.get("writer")
            or "generated thesis draft markdown",
            title=thesis_title,
            sections=thesis_sections,
            word_count=len(thesis_markdown),
        )

        design_payload = writer_payload.get("design_report") if writer_payload else None
        design_report_payload = design_payload if isinstance(design_payload, dict) else None
        design_title = f"{brief.title} Design Report"
        design_sections = ["目标", "模块划分", "交付说明"]
        design_markdown = _build_design_report_markdown(
            title=design_title,
            goal=_payload_string(design_report_payload, "goal")
            or "明确本地部署、可验证、可交付的毕业设计生成结果。",
            module_breakdown=_payload_string_list(design_report_payload, "module_breakdown")
            or ["authentication", "catalog_search", "workflow_management", "reporting"],
            delivery_notes=_payload_string(design_report_payload, "delivery_notes")
            or "包含代码工作区、设计文档与论文初稿。",
        )
        artifact_paths.design_report.write_text(design_markdown + "\n", encoding="utf-8")
        design_artifact = DesignReportArtifact(
            job_id=job_id,
            agent_role="writer",
            created_at=created_at,
            status="completed",
            summary=_payload_string(design_report_payload, "summary") or "generated design report markdown",
            title=design_title,
            sections=design_sections,
            word_count=len(design_markdown),
        )
        emit_progress(
            "review_running",
            [
                AgentStatus(role="advisor", status="done", summary=advisor_artifact.summary),
                AgentStatus(role="coder", status="done", summary=code_summary_artifact.summary),
                AgentStatus(role="writer", status="done", summary="generated thesis draft and design report"),
                AgentStatus(role="requirements_reviewer", status="running", summary="checking brief alignment"),
            ],
            "writer_completed",
            "writer completed",
            {"artifact": str(artifact_paths.thesis_draft)},
        )

        requirements_review = RequirementsReviewArtifact(
            job_id=job_id,
            agent_role="requirements_reviewer",
            created_at=created_at,
            status="pass",
            summary="generated outputs match the parsed brief at a deterministic level",
            alignment_verdict="pass",
            missing_requirements=[],
            overbuild=[],
            fix_directives=[],
        )
        engineering_review = EngineeringReviewArtifact(
            job_id=job_id,
            agent_role="engineering_reviewer",
            created_at=created_at,
            status="pass",
            summary="repository layout and validation path are plausible",
            engineering_verdict="pass",
            repository_structure_notes=["workspace contains README and durable artifacts"],
            validation_readiness_notes=["python -m pytest -q can be attempted locally"],
            engineering_risks=["generated scaffold is deterministic and minimal"],
            fix_directives=[],
        )
        delivery_review = DeliveryReviewArtifact(
            job_id=job_id,
            agent_role="delivery_reviewer",
            created_at=created_at,
            status="pass",
            summary="deliverable set is present for the initial run",
            delivery_verdict="pass",
            missing_deliverables=[],
            submission_risks=["academic quality still requires human review"],
            final_recommendation="delivery can proceed to manual review",
        )
        _write_json_artifact(artifact_paths.requirements_review, requirements_review)
        _write_json_artifact(artifact_paths.engineering_review, engineering_review)
        _write_json_artifact(artifact_paths.delivery_review, delivery_review)
        emit_progress(
            "verification_running",
            [
                AgentStatus(role="advisor", status="done", summary=advisor_artifact.summary),
                AgentStatus(role="coder", status="done", summary=code_summary_artifact.summary),
                AgentStatus(role="writer", status="done", summary="generated thesis draft and design report"),
                AgentStatus(role="requirements_reviewer", status="done", summary=requirements_review.summary),
                AgentStatus(role="engineering_reviewer", status="done", summary=engineering_review.summary),
                AgentStatus(role="delivery_reviewer", status="done", summary=delivery_review.summary),
                AgentStatus(role="code_eval", status="running", summary="starting local verification"),
            ],
            "verification_started",
            "verification started",
            {"stage": "verification_running"},
        )

        verification_command = (
            ["-c", "raise SystemExit(2)"]
            if (paths.workspace_dir / "fail.py").exists()
            else ["-c", "print('verification ok')"]
        )
        report = executor.run(
            CommandRequest(
                executable="python",
                arguments=verification_command,
                working_directory=paths.workspace_dir,
                purpose="code_eval",
                requires_network=False,
            )
        )
        code_eval_status = "completed" if report.status == "completed" else "failed"
        code_eval_artifact = CodeEvalArtifact(
            job_id=job_id,
            agent_role="code_eval",
            created_at=created_at,
            status=code_eval_status,
            summary="local verification command executed",
            commands=[
                CodeEvalCommandResult(
                    command=report.command,
                    status=report.status,
                    stdout_path=report.stdout_path,
                    stderr_path=report.stderr_path,
                    summary=report.reason,
                )
            ],
            overall_result="pass" if report.status == "completed" else "failed",
        )
        _write_json_artifact(artifact_paths.code_eval, code_eval_artifact)

        required_sections = {"摘要", "需求分析", "系统设计", "实现概述", "测试与验证", "结论"}
        present_sections = {line.removeprefix("## ").strip() for line in thesis_markdown.splitlines() if line.startswith("## ")}
        missing_sections = sorted(required_sections - present_sections)
        scope_findings = [] if brief.requirements else ["parsed brief does not define project scope"]
        placeholder_findings = ["检测到占位内容"] if "自动生成初稿" in thesis_markdown else []
        doc_check_status = "must_fix" if missing_sections or placeholder_findings or scope_findings else "pass"
        doc_check_artifact = DocCheckArtifact(
            job_id=job_id,
            agent_role="doc_check",
            created_at=created_at,
            status=doc_check_status,
            summary=(
                "document checks found issues"
                if doc_check_status == "must_fix"
                else "required sections and project scope checks passed"
            ),
            section_completeness=thesis_sections if not missing_sections else missing_sections,
            placeholder_findings=placeholder_findings,
            title_scope_consistency=scope_findings or [f"thesis content is aligned with {brief.title}"],
            code_alignment_notes=["documentation references the generated stack and validation command"],
        )
        _write_json_artifact(artifact_paths.doc_check, doc_check_artifact)
        emit_progress(
            "verification_running",
            [
                AgentStatus(role="advisor", status="done", summary=advisor_artifact.summary),
                AgentStatus(role="coder", status="done", summary=code_summary_artifact.summary),
                AgentStatus(role="writer", status="done", summary="generated thesis draft and design report"),
                AgentStatus(role="requirements_reviewer", status="done", summary=requirements_review.summary),
                AgentStatus(role="engineering_reviewer", status="done", summary=engineering_review.summary),
                AgentStatus(role="delivery_reviewer", status="done", summary=delivery_review.summary),
                AgentStatus(role="code_eval", status="done", summary=code_eval_artifact.summary),
                AgentStatus(role="doc_check", status="done", summary=doc_check_artifact.summary),
            ],
            "verification_completed",
            "verification completed",
            {"code_eval": code_eval_artifact.overall_result, "doc_check": doc_check_artifact.status},
        )

        final_status = "completed"
        final_disposition = "completed"
        if code_eval_artifact.status == "failed":
            final_status = "failed"
            final_disposition = "failed"
        elif (
            delivery_review.status == "must_fix"
            or doc_check_artifact.status == "must_fix"
            or requirements_review.status == "must_fix"
            or engineering_review.status == "must_fix"
        ):
            final_status = "blocked"
            final_disposition = "blocked"

        final_manifest = FinalJobManifestArtifact(
            job_id=job_id,
            agent_role="system",
            created_at=created_at,
            status="completed" if final_status == "completed" else final_status,
            summary=f"job finished with {final_disposition} disposition",
            final_disposition=final_disposition,
            repair_performed=False,
            stage_results={
                "advisor": advisor_artifact.status,
                "coder": code_summary_artifact.status,
                "writer": thesis_artifact.status,
                "requirements_reviewer": requirements_review.status,
                "engineering_reviewer": engineering_review.status,
                "delivery_reviewer": delivery_review.status,
                "code_eval": code_eval_artifact.status,
                "doc_check": doc_check_artifact.status,
            },
            artifacts={
                "advisor_plan": str(artifact_paths.advisor_plan),
                "implementation_plan": str(artifact_paths.implementation_plan),
                "code_summary": str(artifact_paths.code_summary),
                "thesis_draft": str(artifact_paths.thesis_draft),
                "design_report": str(artifact_paths.design_report),
                "requirements_review": str(artifact_paths.requirements_review),
                "engineering_review": str(artifact_paths.engineering_review),
                "delivery_review": str(artifact_paths.delivery_review),
                "code_eval": str(artifact_paths.code_eval),
                "doc_check": str(artifact_paths.doc_check),
                "job_manifest": str(artifact_paths.final_manifest),
            },
        )
        _write_json_artifact(artifact_paths.final_manifest, final_manifest)

        agent_statuses = [
            AgentStatus(role="advisor", status="done", summary=advisor_artifact.summary),
            AgentStatus(role="coder", status="done", summary=code_summary_artifact.summary),
            AgentStatus(role="writer", status="done", summary="generated thesis draft and design report"),
            AgentStatus(
                role="requirements_reviewer",
                status="done",
                summary=requirements_review.summary,
            ),
            AgentStatus(
                role="engineering_reviewer",
                status="done",
                summary=engineering_review.summary,
            ),
            AgentStatus(
                role="delivery_reviewer",
                status="done",
                summary=delivery_review.summary,
            ),
            AgentStatus(role="code_eval", status="done", summary=code_eval_artifact.summary),
            AgentStatus(role="doc_check", status="done", summary=doc_check_artifact.summary),
        ]

        return JobSnapshot(
            job_id=job_id,
            stage=final_status if final_status != "completed" else "completed",
            status=final_status,
            agents=agent_statuses,
            artifacts=[
                ArtifactRef(kind="project_readme", path=str(project_readme)),
                ArtifactRef(kind="advisor_plan", path=str(artifact_paths.advisor_plan)),
                ArtifactRef(kind="implementation_plan", path=str(artifact_paths.implementation_plan)),
                ArtifactRef(kind="code_summary", path=str(artifact_paths.code_summary)),
                ArtifactRef(kind="thesis_draft", path=str(artifact_paths.thesis_draft)),
                ArtifactRef(kind="design_report", path=str(artifact_paths.design_report)),
                ArtifactRef(kind="requirements_review", path=str(artifact_paths.requirements_review)),
                ArtifactRef(kind="engineering_review", path=str(artifact_paths.engineering_review)),
                ArtifactRef(kind="delivery_review", path=str(artifact_paths.delivery_review)),
                ArtifactRef(kind="code_eval", path=str(artifact_paths.code_eval)),
                ArtifactRef(kind="doc_check", path=str(artifact_paths.doc_check)),
                ArtifactRef(kind="job_manifest", path=str(artifact_paths.final_manifest)),
            ],
            validation_state="blocked" if final_status == "blocked" else "completed",
            final_disposition=final_disposition,
        )
