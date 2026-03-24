from idea2thesis.contracts import ParsedBrief
from idea2thesis.orchestrator import SupervisorOrchestrator


def test_supervisor_builds_plan_with_review_criteria_and_tasks() -> None:
    orchestrator = SupervisorOrchestrator()
    brief = ParsedBrief(
        title="学生成绩分析系统",
        requirements=["用户登录", "统计分析"],
        constraints=["本地部署"],
        tech_hints=["Python"],
        thesis_cues=["摘要"],
        raw_text="学生成绩分析系统",
        extraction_snapshot={"paragraphs": ["学生成绩分析系统"]},
    )
    plan = orchestrator.build_plan(brief)
    assert plan.project_category == "data_analysis_project"
    assert plan.stack_policy == "python-data"
    assert plan.review_criteria == [
        "requirements_alignment",
        "engineering_quality",
        "delivery_readiness",
    ]
    assert plan.retries["code_eval"] == 1
    assert [task.role for task in plan.tasks] == [
        "advisor",
        "coder",
        "writer",
        "requirements_reviewer",
        "engineering_reviewer",
        "delivery_reviewer",
        "code_eval",
        "doc_check",
    ]
