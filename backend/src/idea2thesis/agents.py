from __future__ import annotations

from idea2thesis.contracts import AgentResult, AgentTask


ROLE_SEQUENCE = [
    "advisor",
    "coder",
    "writer",
    "requirements_reviewer",
    "engineering_reviewer",
    "delivery_reviewer",
    "code_eval",
    "doc_check",
]


def build_agent_tasks(workspace_path: str, title: str) -> list[AgentTask]:
    objectives = {
        "advisor": "analyze the brief and define the delivery target",
        "coder": "generate a runnable project scaffold",
        "writer": "generate repository docs and thesis draft artifacts",
        "requirements_reviewer": "check alignment with the original brief",
        "engineering_reviewer": "check code quality and project structure",
        "delivery_reviewer": "check graduation delivery readiness",
        "code_eval": "run local verification commands",
        "doc_check": "check generated thesis draft structure",
    }
    return [
        AgentTask(
            role=role,
            objective=objectives[role],
            workspace_path=workspace_path,
            context={"title": title},
            expected_outputs=[],
        )
        for role in ROLE_SEQUENCE
    ]


def passing_reviewer_results() -> list[AgentResult]:
    reviewer_roles = [
        "requirements_reviewer",
        "engineering_reviewer",
        "delivery_reviewer",
        "doc_check",
    ]
    return [
        AgentResult(
            role=role,
            status="done",
            summary="passed deterministic review",
            changed_files=[],
            review_notes=["ok"],
        )
        for role in reviewer_roles
    ]
