# Real Multi-Agent Execution Design Spec

## Overview

This change upgrades `idea2thesis` from a mostly infrastructural local generation runner into a real multi-agent execution system that produces substantive graduation-project outputs.

The target v1 execution chain is:

- `advisor`
- `coder`
- `writer`
- `requirements_reviewer`
- `engineering_reviewer`
- `delivery_reviewer`
- `code_eval`
- `doc_check`

The system should consume one uploaded `.docx` graduation design brief and produce:

- a runnable local project workspace
- repository-level delivery documentation
- a thesis first draft in Markdown
- structured review and verification artifacts

The existing local single-user web app, async job runtime, settings persistence, and history workbench remain the outer shell. This spec focuses on the execution core: how agents consume inputs, hand off outputs, decide pass/fail, and surface results back to the user.

## Goals

- Make the existing multi-agent model real rather than placeholder orchestration.
- Produce code, documentation, and thesis-draft outputs from the same job.
- Use explicit machine-readable handoff artifacts between agents.
- Keep the system deterministic enough to debug through stored artifacts and history.
- Add a bounded repair loop so review failures can trigger one useful retry.

## Non-Goals

- Infinite autonomous self-improvement loops.
- Fully parallel agent scheduling in v1.
- Direct `.docx` thesis export in this increment.
- Human-like academic quality guarantees suitable for unreviewed submission.
- Reviewer agents directly editing files in v1.

## User Experience

### Expected Result

After the user uploads a brief and starts generation, the job should proceed through visible multi-agent stages and end in one of:

- `completed`
- `failed`
- `blocked`

For a successful job, the user should be able to inspect:

- advisor planning output
- generated code and project files
- generated thesis-draft and design-writeup Markdown
- review conclusions from multiple review agents
- local verification results

### History Workbench Impact

The existing history workbench detail panel should gain meaningful artifacts and agent summaries rather than only infrastructure state.

The detail view should make it clear:

- which stage is currently running
- which artifact each agent produced
- which reviewer requested fixes
- whether a repair round happened
- why the final state is `completed`, `failed`, or `blocked`

## Execution Architecture

### Sequential Stage Model

v1 should run a bounded sequential pipeline:

1. `advisor`
2. `coder`
3. `writer`
4. review bundle
5. optional one-time repair bundle
6. `code_eval`
7. `doc_check`
8. final delivery decision

The review bundle consists of:

- `requirements_reviewer`
- `engineering_reviewer`
- `delivery_reviewer`

These may execute sequentially in v1 even if the long-term design later parallelizes them.

### Repair Policy

The system may enter exactly one `repair_running` phase if:

- `requirements_reviewer` returns `must_fix`
- or `engineering_reviewer` returns `must_fix`

Repair behavior in v1:

- `coder` may be re-invoked once for code or structure fixes
- `writer` may be re-invoked once for content alignment or missing sections
- reviewers are then run once more

If the second review still returns `must_fix`, the job ends as `blocked`.

`doc_check` and `delivery_reviewer` do not trigger a new repair phase in this increment. They run after the single optional repair round has already been consumed or skipped, and may only contribute to the final `completed`, `failed`, or `blocked` decision.

## Agent Contracts

All persistent execution artifacts must include:

- `schema_version`
- `job_id`
- `agent_role`
- `created_at`
- `status`
- `summary`

Each artifact should be readable without opening logs.

### Advisor

Input:

- parsed brief
- inferred project category
- persisted runtime settings metadata if needed for stack selection

Output artifact:

- `artifacts/agent/advisor/advisor_plan.json`

Required fields:

- project title restatement
- brief objective summary
- recommended stack
- module breakdown
- implementation priorities
- writing priorities
- risk list
- agent directives for coder and writer

Required effect:

- the advisor output becomes the source of truth for downstream generation scope

### Coder

Input:

- parsed brief
- advisor plan

Output artifacts:

- generated repository files under `workspace/`
- `artifacts/agent/coder/implementation_plan.md`
- `artifacts/agent/coder/code_summary.json`

Required fields in `code_summary.json`:

- generated files list
- chosen stack
- run commands
- test commands
- known limitations

Minimum acceptable result:

- a local project scaffold exists
- core files for the chosen stack exist
- README exists
- at least one local validation command can be attempted

### Writer

Input:

- parsed brief
- advisor plan
- coder code summary

Output artifacts:

- `artifacts/agent/writer/thesis_draft.md`
- `artifacts/agent/writer/design_report.md`

Minimum acceptable sections in thesis draft:

- abstract
- requirements analysis
- system design
- implementation overview
- testing or verification summary
- conclusion

Writer output must align with the generated code summary and must not be only a bullet outline.

### Requirements Reviewer

Input:

- parsed brief
- advisor plan
- coder and writer outputs

Output artifact:

- `artifacts/agent/review/requirements_review.json`

Allowed conclusions:

- `pass`
- `pass_with_notes`
- `must_fix`

Required fields:

- alignment verdict
- missing requirement list
- overbuild list
- fix directives

### Engineering Reviewer

Input:

- generated code workspace
- code summary
- verification results when available

Output artifact:

- `artifacts/agent/review/engineering_review.json`

Required checks:

- repository structure sanity
- implementation plausibility
- validation readiness
- obvious engineering risks

Allowed conclusions:

- `pass`
- `pass_with_notes`
- `must_fix`

### Delivery Reviewer

Input:

- all prior generation and review artifacts

Output artifact:

- `artifacts/agent/review/delivery_review.json`

Required fields:

- delivery completeness verdict
- missing deliverables
- submission-risk notes
- final recommendation

Allowed conclusions:

- `pass`
- `pass_with_notes`
- `must_fix`

This reviewer does not trigger a new repair round in v1. It only contributes to the final delivery decision after generation, review, optional repair, and verification have finished.

### Code Eval

Input:

- generated workspace
- run/test command metadata from coder output

Output artifact:

- `artifacts/verification/code_eval.json`

Required fields:

- commands attempted
- execution status per command
- stdout/stderr log references
- summarized result

Code evaluation remains subject to the existing local execution policy.

### Doc Check

Input:

- thesis draft
- design report
- parsed brief
- coder summary

Output artifact:

- `artifacts/verification/doc_check.json`

Required checks:

- section completeness
- placeholder text detection
- consistency with project title and system scope
- consistency with generated code summary

Allowed conclusions:

- `pass`
- `pass_with_notes`
- `must_fix`

## Artifact Layout

The job workspace should preserve stable machine-readable handoff files:

- `artifacts/agent/advisor/advisor_plan.json`
- `artifacts/agent/coder/implementation_plan.md`
- `artifacts/agent/coder/code_summary.json`
- `artifacts/agent/writer/thesis_draft.md`
- `artifacts/agent/writer/design_report.md`
- `artifacts/agent/review/requirements_review.json`
- `artifacts/agent/review/engineering_review.json`
- `artifacts/agent/review/delivery_review.json`
- `artifacts/verification/code_eval.json`
- `artifacts/verification/doc_check.json`
- `artifacts/final/job_manifest.json`

`job_manifest.json` should summarize:

- all generated artifacts
- all stage results
- whether repair occurred
- final disposition

## Backend Changes

### Orchestrator

The supervisor/orchestrator layer must evolve from planning-only behavior to real stage execution.

It should:

- assemble structured inputs for each agent
- call the configured model provider for each agent role
- parse and validate structured outputs
- write durable artifacts after each stage
- update job stage and agent summaries
- decide whether to continue, repair, fail, or block

### Agent Runner Abstraction

The backend should introduce a clearer agent-execution boundary:

- input: structured agent task payload
- output: structured agent result plus produced artifact references

This keeps prompting logic separate from orchestration flow control.

### Job State

The durable job state should now reflect real multi-step execution.

Expected stage labels may include:

- `advisor_running`
- `coder_running`
- `writer_running`
- `review_running`
- `repair_running`
- `verification_running`
- `completed`
- `failed`
- `blocked`

Existing UI-facing `JobSnapshot` and detail models should continue to expose concise current stage plus per-agent statuses.

### Job Events

The event stream should record meaningful execution milestones such as:

- `advisor_started`
- `advisor_completed`
- `coder_started`
- `coder_completed`
- `writer_started`
- `writer_completed`
- `review_requested_changes`
- `repair_started`
- `repair_completed`
- `verification_started`
- `verification_completed`
- `job_blocked`
- `job_failed`
- `job_completed`

## Frontend Changes

This increment does not require a large new frontend surface, but existing screens should become more informative.

The active job view and history detail should show:

- richer agent summaries
- newly generated artifact references
- review conclusions
- whether repair occurred

The user should not need to inspect raw log files to understand what happened.

## Failure Semantics

### `blocked`

Use `blocked` when:

- the brief cannot be turned into a usable plan
- review repeatedly identifies requirement-level or content-level defects
- generated outputs are too incomplete for safe continuation

### `failed`

Use `failed` when:

- model execution crashes or parsing fails irrecoverably
- code generation or verification fails and repair does not recover it
- filesystem or execution-layer errors terminate the pipeline

### Completion Rule

The job should become `completed` only when:

- advisor artifact exists
- coder artifact and runnable workspace exist
- writer artifact exists
- review artifacts exist
- verification artifacts exist
- final manifest exists

Final disposition rules in v1:

- if `requirements_reviewer` or `engineering_reviewer` still returns `must_fix` after the single allowed repair round, the job ends as `blocked`
- if `delivery_reviewer` returns `must_fix`, the job ends as `blocked`
- if `doc_check` returns `must_fix`, the job ends as `blocked`
- if `code_eval` ends in unrecovered execution failure, the job ends as `failed`
- otherwise the job ends as `completed`

## Validation Rules

- no agent artifact may contain runtime API keys
- structured artifacts must validate against versioned contracts
- reviewer outputs must use the allowed verdict enum
- repair may happen at most once in v1
- code evaluation may only execute approved commands under existing policy

## Testing

### Backend

Required coverage:

- orchestrator runs the real stage chain in order
- advisor output is persisted and consumed by coder/writer
- writer output uses coder summary as context
- reviewer `must_fix` triggers one repair round
- repeated `must_fix` leads to `blocked`
- code_eval and doc_check artifacts are persisted
- final manifest is produced on success
- no runtime secrets appear in any stored execution artifact

### Frontend

Required coverage:

- active job and history detail show new artifact/review summaries
- rerun preserves the new execution chain behavior
- blocked vs failed outcomes remain distinguishable in the UI

## Recommended Scope

This increment should be implemented as one execution-core feature set:

- real advisor/coder/writer/reviewer execution
- durable structured artifact writing
- one-pass repair loop
- richer stage and event reporting

It is the recommended next milestone after the async runtime and history workbench foundation because it turns the product into a real generation system rather than only a job container.
