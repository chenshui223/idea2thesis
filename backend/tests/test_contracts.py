from idea2thesis.contracts import (
    AdvisorPlanArtifact,
    AgentResult,
    AgentTask,
    CodeEvalArtifact,
    CodeSummaryArtifact,
    DeliveryReviewArtifact,
    DocCheckArtifact,
    EventListResponse,
    ExecutionReport,
    FinalJobManifestArtifact,
    EngineeringReviewArtifact,
    JobDetailResponse,
    JobListItem,
    JobListResponse,
    JobPlan,
    JobSnapshot,
    ParsedBrief,
    RerunPreload,
    RequirementsReviewArtifact,
    RuntimePreset,
    RuntimePresetAgent,
    SchemaCompatibilityError,
    ThesisDraftArtifact,
    DesignReportArtifact,
)


def test_versioned_models_round_trip() -> None:
    brief = ParsedBrief(
        schema_version="v1alpha1",
        title="学生成绩分析系统",
        requirements=["用户登录", "统计分析"],
        constraints=["本地部署"],
        tech_hints=["Python"],
        thesis_cues=["摘要", "系统设计"],
        raw_text="学生成绩分析系统...",
        extraction_snapshot={"paragraphs": ["学生成绩分析系统"]},
    )
    restored = ParsedBrief.model_validate_json(brief.model_dump_json())
    assert restored == brief


def test_job_plan_round_trip() -> None:
    plan = JobPlan(
        schema_version="v1alpha1",
        project_category="data_analysis_project",
        stack_policy="python-data",
        review_criteria=["需求一致性", "可运行性"],
        retries={"code_eval": 1},
        tasks=[],
    )
    restored = JobPlan.model_validate_json(plan.model_dump_json())
    assert restored == plan


def test_agent_task_and_result_round_trip() -> None:
    task = AgentTask(
        schema_version="v1alpha1",
        role="coder",
        objective="generate project scaffold",
        workspace_path="/tmp/job/workspace",
        context={"title": "学生成绩分析系统"},
        expected_outputs=["README.md", "main.py"],
    )
    restored_task = AgentTask.model_validate_json(task.model_dump_json())
    assert restored_task == task

    result = AgentResult(
        schema_version="v1alpha1",
        role="coder",
        status="done",
        summary="generated scaffold",
        changed_files=["README.md", "main.py"],
        review_notes=["ok"],
    )
    restored_result = AgentResult.model_validate_json(result.model_dump_json())
    assert restored_result == result


def test_execution_report_round_trip() -> None:
    report = ExecutionReport(
        schema_version="v1alpha1",
        command=["pytest", "-v"],
        working_directory="/tmp/job/workspace",
        status="completed",
        exit_code=0,
        duration_ms=120,
        reason="completed",
        stdout_path="/tmp/job/logs/pytest.stdout.log",
        stderr_path="/tmp/job/logs/pytest.stderr.log",
        policy_decision="allowed",
    )
    restored = ExecutionReport.model_validate_json(report.model_dump_json())
    assert restored == report


def test_job_snapshot_round_trip() -> None:
    snapshot = JobSnapshot(
        schema_version="v1alpha1",
        job_id="job-1",
        stage="code_eval",
        status="running",
        agents=[],
        artifacts=[],
        validation_state="running",
        final_disposition="pending",
    )
    restored = JobSnapshot.model_validate_json(snapshot.model_dump_json())
    assert restored == snapshot


def test_snapshot_rejects_unsupported_version() -> None:
    payload = {
        "schema_version": "v9",
        "job_id": "job-1",
        "stage": "failed",
        "status": "blocked",
        "agents": [],
        "artifacts": [],
        "validation_state": "blocked",
        "final_disposition": "failed",
    }
    try:
        JobSnapshot.model_validate(payload)
    except SchemaCompatibilityError as exc:
        assert "unsupported schema_version" in str(exc)
    else:
        raise AssertionError("expected schema error")


def test_history_contracts_round_trip() -> None:
    list_item = JobListItem(
        schema_version="v1alpha1",
        job_id="job-1",
        brief_title="图书管理系统",
        status="deleted",
        stage="completed",
        updated_at="2026-03-25T10:00:00Z",
        created_at="2026-03-25T09:00:00Z",
        final_disposition="completed",
    )
    assert JobListItem.model_validate_json(list_item.model_dump_json()) == list_item

    response = JobListResponse(schema_version="v1alpha1", items=[list_item], total=1)
    assert JobListResponse.model_validate_json(response.model_dump_json()) == response

    preload = RerunPreload(
        schema_version="v1alpha1",
        global_config={"base_url": "https://example.com/v1", "model": "gpt-test"},
        agents={
            "coder": RuntimePresetAgent(
                use_global=False,
                base_url="https://coder.example.com/v1",
                model="gpt-coder",
            )
        },
    )
    assert RerunPreload.model_validate_json(preload.model_dump_json()) == preload

    detail = JobDetailResponse(
        schema_version="v1alpha1",
        job_id="job-1",
        brief_title="图书管理系统",
        source_job_id="job-0",
        workspace_path="/tmp/job-1/workspace",
        input_file_path="/tmp/job-1/input/brief.docx",
        error_message="",
        deleted_at=None,
        status="pending",
        stage="queued",
        created_at="2026-03-25T09:00:00Z",
        updated_at="2026-03-25T10:00:00Z",
        started_at=None,
        finished_at=None,
        validation_state="pending",
        final_disposition="pending",
        agents=[],
        artifacts=[],
        runtime_preset=RuntimePreset(
            schema_version="v1alpha1",
            global_config={"base_url": "https://example.com/v1", "model": "gpt-test"},
            agents={},
        ),
        rerun_preload=preload,
    )
    assert JobDetailResponse.model_validate_json(detail.model_dump_json()) == detail

    events = EventListResponse(schema_version="v1alpha1", items=[])
    assert EventListResponse.model_validate_json(events.model_dump_json()) == events


def test_execution_artifact_contracts_round_trip() -> None:
    advisor = AdvisorPlanArtifact(
        schema_version="v1alpha1",
        job_id="job-1",
        agent_role="advisor",
        created_at="2026-03-25T10:00:00Z",
        status="completed",
        summary="defined stack and module plan",
        project_title="图书管理系统",
        project_summary="本地部署图书管理系统",
        recommended_stack="fastapi-react",
        module_breakdown=["auth", "catalog", "borrowing"],
        implementation_priorities=["scaffold", "core flow"],
        writing_priorities=["摘要", "系统设计"],
        risks=["scope creep"],
        coder_directives=["build runnable scaffold"],
        writer_directives=["align thesis draft to code plan"],
    )
    assert AdvisorPlanArtifact.model_validate_json(advisor.model_dump_json()) == advisor

    code_summary = CodeSummaryArtifact(
        schema_version="v1alpha1",
        job_id="job-1",
        agent_role="coder",
        created_at="2026-03-25T10:05:00Z",
        status="completed",
        summary="generated scaffold",
        generated_files=["README.md", "backend/app.py"],
        chosen_stack="fastapi-react",
        run_commands=["uvicorn backend.app:app --reload"],
        test_commands=["pytest -q"],
        known_limitations=["demo auth only"],
    )
    assert CodeSummaryArtifact.model_validate_json(code_summary.model_dump_json()) == code_summary

    thesis_draft = ThesisDraftArtifact(
        schema_version="v1alpha1",
        job_id="job-1",
        agent_role="writer",
        created_at="2026-03-25T10:10:00Z",
        status="completed",
        summary="generated thesis draft",
        title="图书管理系统论文初稿",
        sections=["摘要", "需求分析", "系统设计", "实现", "测试", "结论"],
        word_count=3200,
    )
    assert ThesisDraftArtifact.model_validate_json(thesis_draft.model_dump_json()) == thesis_draft

    design_report = DesignReportArtifact(
        schema_version="v1alpha1",
        job_id="job-1",
        agent_role="writer",
        created_at="2026-03-25T10:11:00Z",
        status="completed",
        summary="generated design report",
        title="图书管理系统设计说明",
        sections=["目标", "模块划分", "数据库设计"],
        word_count=1800,
    )
    assert DesignReportArtifact.model_validate_json(design_report.model_dump_json()) == design_report

    requirements_review = RequirementsReviewArtifact(
        schema_version="v1alpha1",
        job_id="job-1",
        agent_role="requirements_reviewer",
        created_at="2026-03-25T10:15:00Z",
        status="pass_with_notes",
        summary="mostly aligned",
        alignment_verdict="pass_with_notes",
        missing_requirements=["高级检索"],
        overbuild=[],
        fix_directives=["补充检索说明"],
    )
    assert (
        RequirementsReviewArtifact.model_validate_json(requirements_review.model_dump_json())
        == requirements_review
    )

    engineering_review = EngineeringReviewArtifact(
        schema_version="v1alpha1",
        job_id="job-1",
        agent_role="engineering_reviewer",
        created_at="2026-03-25T10:16:00Z",
        status="pass",
        summary="repository structure is plausible",
        engineering_verdict="pass",
        repository_structure_notes=["api and ui split clearly"],
        validation_readiness_notes=["pytest command available"],
        engineering_risks=["tests are shallow"],
        fix_directives=[],
    )
    assert (
        EngineeringReviewArtifact.model_validate_json(engineering_review.model_dump_json())
        == engineering_review
    )

    delivery_review = DeliveryReviewArtifact(
        schema_version="v1alpha1",
        job_id="job-1",
        agent_role="delivery_reviewer",
        created_at="2026-03-25T10:17:00Z",
        status="must_fix",
        summary="missing thesis draft",
        delivery_verdict="must_fix",
        missing_deliverables=["thesis_draft.md"],
        submission_risks=["deliverable set incomplete"],
        final_recommendation="block delivery",
    )
    assert DeliveryReviewArtifact.model_validate_json(delivery_review.model_dump_json()) == delivery_review

    code_eval = CodeEvalArtifact(
        schema_version="v1alpha1",
        job_id="job-1",
        agent_role="code_eval",
        created_at="2026-03-25T10:20:00Z",
        status="completed",
        summary="verification finished",
        commands=[
            {
                "command": ["pytest", "-q"],
                "status": "completed",
                "stdout_path": "/tmp/stdout.log",
                "stderr_path": "/tmp/stderr.log",
                "summary": "tests passed",
            }
        ],
        overall_result="pass",
    )
    assert CodeEvalArtifact.model_validate_json(code_eval.model_dump_json()) == code_eval

    doc_check = DocCheckArtifact(
        schema_version="v1alpha1",
        job_id="job-1",
        agent_role="doc_check",
        created_at="2026-03-25T10:25:00Z",
        status="pass",
        summary="document checks passed",
        section_completeness=["all required sections present"],
        placeholder_findings=[],
        title_scope_consistency=["title matches generated system"],
        code_alignment_notes=["module names match code summary"],
    )
    assert DocCheckArtifact.model_validate_json(doc_check.model_dump_json()) == doc_check

    manifest = FinalJobManifestArtifact(
        schema_version="v1alpha1",
        job_id="job-1",
        agent_role="system",
        created_at="2026-03-25T10:30:00Z",
        status="completed",
        summary="job finished",
        final_disposition="completed",
        repair_performed=False,
        stage_results={"advisor": "completed", "coder": "completed"},
        artifacts={
            "advisor_plan": "artifacts/agent/advisor/advisor_plan.json",
            "job_manifest": "artifacts/final/job_manifest.json",
        },
    )
    assert FinalJobManifestArtifact.model_validate_json(manifest.model_dump_json()) == manifest
