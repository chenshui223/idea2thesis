from pydantic import ValidationError

from idea2thesis.contracts import (
    AgentResult,
    AgentTask,
    ExecutionReport,
    JobPlan,
    JobSnapshot,
    ParsedBrief,
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
    except ValidationError as exc:
        assert "unsupported schema_version" in str(exc)
    else:
        raise AssertionError("expected schema error")
