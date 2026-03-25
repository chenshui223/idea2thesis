# Real Multi-Agent Execution Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current placeholder orchestration flow with a real multi-agent execution chain that produces durable advisor, coder, writer, review, and verification artifacts with one bounded repair round.

**Architecture:** Extend the existing backend runtime around versioned execution-artifact contracts, a stage-driven orchestrator, and durable artifact writing under each job workspace. Keep the current async worker and history workbench shell, but make the worker call a real stage executor that persists stage-by-stage outputs, records durable execution events, and determines final disposition using explicit reviewer and verification results.

**Tech Stack:** Python, FastAPI, Pydantic, SQLite, React, TypeScript, pytest, Vitest

---

## File Structure

- `backend/src/idea2thesis/contracts.py`
  - add versioned models for advisor, coder, writer, review, verification, and final-manifest artifacts
- `backend/src/idea2thesis/agents.py`
  - define real stage metadata, role sequencing, artifact path conventions, and role-specific prompt/task builders
- `backend/src/idea2thesis/orchestrator.py`
  - replace placeholder single-pass generation with staged execution, artifact persistence, repair decision logic, doc-check verification, and final disposition rules
- `backend/src/idea2thesis/job_store.py`
  - add durable stage/event persistence helpers so running jobs expose meaningful progress before terminal completion
- `backend/src/idea2thesis/worker.py`
  - invoke the new orchestrator flow, persist intermediate state transitions, and write terminal snapshots without leaking secret-file references
- `backend/src/idea2thesis/storage.py`
  - add helpers for stable artifact directories and manifest paths if current path helpers are insufficient
- `backend/tests/test_contracts.py`
  - add round-trip tests for the new execution artifact contracts
- `backend/tests/test_orchestrator.py`
  - extend focused tests for stage ordering, artifact persistence, repair, doc-check behavior, and final disposition
- `backend/tests/test_job_store.py`
  - add coverage for stage/event persistence helpers used while jobs are running
- `backend/tests/test_worker.py`
  - extend worker coverage for real multi-stage execution, intermediate state persistence, and terminal cleanup
- `backend/tests/test_end_to_end.py`
  - add end-to-end job generation assertions for real artifact outputs and blocked/failed/completed outcomes
- `frontend/src/types.ts`
  - ensure detail models expose richer agent summaries, final disposition, and event data needed by the history workbench
- `frontend/src/App.tsx`
  - wire refreshed job detail polling so running jobs surface stage transitions, review outcomes, and repair state
- `frontend/src/components/JobDetailPanel.tsx`
  - present blocked vs failed outcomes, repair state, and richer job metadata in the right-side detail panel
- `frontend/src/components/AgentBoard.tsx`
  - surface per-agent summaries instead of only role/status labels
- `frontend/src/components/ArtifactList.tsx`
  - group and label durable multi-agent artifacts so the user can inspect generated outputs
- `frontend/src/components/JobEventTimeline.tsx`
  - show meaningful execution milestones such as review requests and repair/verification transitions
- `frontend/src/App.integration.test.tsx`
  - cover the upgraded history/detail workbench rendering for the real execution flow
- `README.md`
  - document the real multi-agent execution chain, artifact set, and UI-visible job states

## Chunk 1: Contracts And Artifact Layout

### Task 1: Add versioned execution-artifact contracts

**Files:**
- Modify: `backend/src/idea2thesis/contracts.py`
- Modify: `backend/tests/test_contracts.py`
- Test: `backend/tests/test_contracts.py`

- [ ] **Step 1: Write the failing contract tests**

```python
def test_advisor_plan_contract_round_trip() -> None:
    artifact = AdvisorPlanArtifact(
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
    assert AdvisorPlanArtifact.model_validate_json(artifact.model_dump_json()) == artifact


def test_delivery_review_contract_allows_must_fix() -> None:
    artifact = DeliveryReviewArtifact(
        schema_version="v1alpha1",
        job_id="job-1",
        agent_role="delivery_reviewer",
        created_at="2026-03-25T10:10:00Z",
        status="must_fix",
        summary="missing thesis draft",
        missing_deliverables=["thesis_draft.md"],
        submission_risks=["deliverable set incomplete"],
        final_recommendation="block delivery",
    )
    assert DeliveryReviewArtifact.model_validate_json(artifact.model_dump_json()) == artifact
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_contracts.py -v`
Expected: FAIL because the new artifact contracts do not exist yet

- [ ] **Step 3: Implement minimal execution-artifact models**

Implementation requirements:
- add versioned Pydantic models for:
  - advisor artifact
  - coder code summary artifact
  - writer thesis/design artifacts
  - requirements, engineering, and delivery review artifacts
  - code-eval artifact
  - doc-check artifact
  - final job manifest artifact
- keep all persistent artifacts free of runtime API keys
- use explicit verdict enums where the spec requires them

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_contracts.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/idea2thesis/contracts.py backend/tests/test_contracts.py
git commit -m "feat: add multi-agent execution contracts"
```

### Task 2: Add stable artifact path helpers

**Files:**
- Modify: `backend/src/idea2thesis/storage.py`
- Modify: `backend/tests/test_storage.py`
- Test: `backend/tests/test_storage.py`

- [ ] **Step 1: Write the failing storage tests**

```python
def test_job_paths_exposes_agent_and_manifest_artifact_locations(tmp_path: Path) -> None:
    storage = JobStorage(tmp_path / "jobs")
    paths = storage.create_job_workspace("job-1")
    artifact_paths = build_execution_artifact_paths(paths)
    assert artifact_paths.advisor_plan == paths.artifacts_dir / "agent" / "advisor" / "advisor_plan.json"
    assert artifact_paths.final_manifest == paths.artifacts_dir / "final" / "job_manifest.json"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_storage.py -v`
Expected: FAIL because execution artifact path helpers do not exist

- [ ] **Step 3: Implement minimal artifact path helpers**

Implementation requirements:
- add a focused helper structure for stable artifact locations under `artifacts/`
- do not break existing job workspace layout
- create parent directories lazily or at workspace creation time

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_storage.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/idea2thesis/storage.py backend/tests/test_storage.py
git commit -m "feat: add execution artifact paths"
```

## Chunk 2: Staged Orchestration

### Task 3: Replace placeholder orchestrator flow with real staged artifact generation

**Files:**
- Modify: `backend/src/idea2thesis/agents.py`
- Modify: `backend/src/idea2thesis/orchestrator.py`
- Modify: `backend/tests/test_orchestrator.py`
- Test: `backend/tests/test_orchestrator.py`

- [ ] **Step 1: Write the failing orchestrator tests for happy path**

```python
def test_run_job_persists_real_stage_artifacts_and_manifest(tmp_path: Path) -> None:
    orchestrator = SupervisorOrchestrator()
    brief = sample_brief(title="图书管理系统")
    paths = seeded_job_paths(tmp_path, "job-1")
    executor = fake_executor_success()

    snapshot = orchestrator.run_job("job-1", brief, paths, executor)

    assert snapshot.status == "completed"
    assert snapshot.stage == "completed"
    assert artifact_json(paths.artifacts_dir / "agent" / "advisor" / "advisor_plan.json")["agent_role"] == "advisor"
    assert artifact_json(paths.artifacts_dir / "agent" / "coder" / "code_summary.json")["agent_role"] == "coder"
    assert artifact_markdown(paths.artifacts_dir / "agent" / "writer" / "thesis_draft.md").startswith("#")
    assert artifact_json(paths.artifacts_dir / "final" / "job_manifest.json")["final_disposition"] == "completed"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_orchestrator.py -v`
Expected: FAIL because the orchestrator still writes placeholder files only

- [ ] **Step 3: Implement minimal staged execution**

Implementation requirements:
- keep the v1 pipeline sequential:
  - advisor
  - coder
  - writer
  - review bundle
  - code_eval
  - doc_check
  - final decision
- persist each stage artifact at its stable path
- produce a final manifest listing artifacts and stage outcomes
- generate real artifact content even if the first implementation is deterministic/template-driven
- return a `JobSnapshot` with meaningful agent summaries and artifact refs
- keep runtime API keys out of written artifacts and workspace files

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_orchestrator.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/idea2thesis/agents.py backend/src/idea2thesis/orchestrator.py backend/tests/test_orchestrator.py
git commit -m "feat: add staged multi-agent orchestration"
```

### Task 4: Persist intermediate job stages and execution events while work is running

**Files:**
- Modify: `backend/src/idea2thesis/job_store.py`
- Modify: `backend/src/idea2thesis/worker.py`
- Modify: `backend/tests/test_job_store.py`
- Modify: `backend/tests/test_worker.py`
- Test: `backend/tests/test_job_store.py`
- Test: `backend/tests/test_worker.py`

- [ ] **Step 1: Write the failing stage/event persistence tests**

```python
def test_job_store_records_running_stage_event_sequence(tmp_path: Path) -> None:
    store = build_store(tmp_path)
    store.record_job_progress(
        job_id="job-1",
        stage="advisor_running",
        agent_statuses=[AgentStatus(role="advisor", status="running", summary="planning scope")],
        event_kind="advisor_started",
        event_message="advisor started",
    )
    detail = store.get_job("job-1")
    events = store.list_job_events("job-1")
    assert detail.stage == "advisor_running"
    assert detail.status == "running"
    assert events.items[-1].kind == "advisor_started"


def test_worker_persists_repair_and_verification_events_before_completion(tmp_path: Path) -> None:
    settings, store = seed_pending_job(tmp_path, job_id="job-1")
    worker = AsyncJobWorker(settings, orchestrator=scripted_orchestrator_with_repair())
    worker.run_once()
    events = store.list_job_events("job-1")
    assert any(item.kind == "repair_started" for item in events.items)
    assert any(item.kind == "verification_completed" for item in events.items)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_job_store.py tests/test_worker.py -v`
Expected: FAIL because intermediate stage/event persistence helpers do not exist yet

- [ ] **Step 3: Implement minimal progress-persistence flow**

Implementation requirements:
- add a focused `job_store` helper for recording running-stage snapshots plus one event append
- update worker/orchestrator integration so durable state can move through:
  - `advisor_running`
  - `coder_running`
  - `writer_running`
  - `review_running`
  - `repair_running`
  - `verification_running`
- persist meaningful events such as:
  - `advisor_started`
  - `advisor_completed`
  - `review_requested_changes`
  - `repair_started`
  - `repair_completed`
  - `verification_started`
  - `verification_completed`
- keep terminal completion in the existing terminal-write path
- keep secret-file cleanup behavior unchanged

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_job_store.py tests/test_worker.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/idea2thesis/job_store.py backend/src/idea2thesis/worker.py backend/tests/test_job_store.py backend/tests/test_worker.py
git commit -m "feat: persist multi-agent stage events"
```

### Task 5: Add bounded repair loop and final-disposition rules

**Files:**
- Modify: `backend/src/idea2thesis/orchestrator.py`
- Modify: `backend/tests/test_orchestrator.py`
- Test: `backend/tests/test_orchestrator.py`

- [ ] **Step 1: Write the failing repair-path tests**

```python
def test_requirements_must_fix_triggers_single_repair_round(tmp_path: Path) -> None:
    orchestrator = orchestrator_with_one_repair_then_pass()
    snapshot = orchestrator.run_job("job-1", sample_brief(), seeded_job_paths(tmp_path, "job-1"), fake_executor_success())
    manifest = artifact_json(tmp_path / "jobs" / "job-1" / "artifacts" / "final" / "job_manifest.json")
    assert manifest["repair_performed"] is True
    assert snapshot.final_disposition == "completed"


def test_delivery_must_fix_blocks_without_new_repair_round(tmp_path: Path) -> None:
    orchestrator = orchestrator_with_delivery_must_fix()
    snapshot = orchestrator.run_job("job-1", sample_brief(), seeded_job_paths(tmp_path, "job-1"), fake_executor_success())
    assert snapshot.status == "blocked"
    assert snapshot.final_disposition == "blocked"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_orchestrator.py -v`
Expected: FAIL because repair and final-disposition rules are not implemented yet

- [ ] **Step 3: Implement minimal repair and disposition logic**

Implementation requirements:
- allow at most one repair round
- repair may only be triggered by:
  - requirements reviewer `must_fix`
  - engineering reviewer `must_fix`
- delivery reviewer and doc check must not trigger a new repair round
- final disposition must follow the spec rules exactly
- persist repair occurrence in the final manifest

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_orchestrator.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/idea2thesis/orchestrator.py backend/tests/test_orchestrator.py
git commit -m "feat: add repair loop and delivery decisions"
```

## Chunk 3: Worker And Verification Integration

### Task 6: Integrate the real orchestrator flow into the async worker

**Files:**
- Modify: `backend/src/idea2thesis/worker.py`
- Modify: `backend/tests/test_worker.py`
- Test: `backend/tests/test_worker.py`

- [ ] **Step 1: Write the failing worker tests**

```python
def test_worker_run_once_persists_multi_agent_artifacts_and_manifest(tmp_path: Path) -> None:
    settings, store = seed_pending_job(tmp_path)
    worker = AsyncJobWorker(settings)
    worker.run_once()
    snapshot = store.get_job("job-1")
    assert any(item.kind == "job_manifest" for item in snapshot.artifacts)
    assert snapshot.final_disposition in {"completed", "failed", "blocked"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_worker.py -v`
Expected: FAIL because worker still depends on placeholder orchestrator outputs

- [ ] **Step 3: Implement minimal worker integration**

Implementation requirements:
- keep existing secret-file lifecycle behavior
- let the worker invoke the staged orchestrator flow
- persist the richer final snapshot and artifacts
- ensure completion still clears runtime secret file references

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_worker.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/idea2thesis/worker.py backend/tests/test_worker.py
git commit -m "feat: run real multi-agent flow in worker"
```

### Task 7: Wire real code-eval and doc-check reporting into verification artifacts

**Files:**
- Modify: `backend/src/idea2thesis/orchestrator.py`
- Modify: `backend/tests/test_orchestrator.py`
- Test: `backend/tests/test_orchestrator.py`

- [ ] **Step 1: Write the failing verification tests**

```python
def test_code_eval_artifact_records_attempted_commands_and_results(tmp_path: Path) -> None:
    orchestrator = SupervisorOrchestrator()
    snapshot = orchestrator.run_job("job-1", sample_brief(), seeded_job_paths(tmp_path, "job-1"), fake_executor_success())
    artifact = artifact_json(tmp_path / "jobs" / "job-1" / "artifacts" / "verification" / "code_eval.json")
    assert artifact["commands"]
    assert artifact["status"] in {"completed", "failed"}


def test_doc_check_artifact_records_section_and_placeholder_findings(tmp_path: Path) -> None:
    orchestrator = SupervisorOrchestrator()
    snapshot = orchestrator.run_job("job-1", sample_brief(), seeded_job_paths(tmp_path, "job-1"), fake_executor_success())
    artifact = artifact_json(tmp_path / "jobs" / "job-1" / "artifacts" / "verification" / "doc_check.json")
    assert "section_completeness" in artifact
    assert artifact["status"] in {"pass", "pass_with_notes", "must_fix"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_orchestrator.py -v`
Expected: FAIL because verification output is not yet persisted as the new artifact contracts

- [ ] **Step 3: Implement minimal verification artifact writing**

Implementation requirements:
- keep using the existing local execution policy
- persist attempted verification commands into `code_eval.json`
- include stdout/stderr log references and summarized result
- persist `doc_check.json` with:
  - section completeness
  - placeholder text detection
  - project-title and scope consistency
  - consistency with generated code summary
- enforce spec behavior where `doc_check` `must_fix` blocks final delivery but does not trigger a new repair round
- map unrecovered execution failure to final `failed`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_orchestrator.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/idea2thesis/orchestrator.py backend/tests/test_orchestrator.py
git commit -m "feat: persist verification artifacts"
```

## Chunk 4: End-To-End, Frontend, And Docs

### Task 8: Add end-to-end coverage for completed and blocked execution results

**Files:**
- Modify: `backend/tests/test_end_to_end.py`
- Test: `backend/tests/test_end_to_end.py`

- [ ] **Step 1: Write the failing end-to-end tests**

```python
def test_create_job_generates_real_multi_agent_artifacts(tmp_path: Path) -> None:
    client = build_real_client(tmp_path)
    response = submit_brief(client, title="图书管理系统")
    assert response.status_code == 201
    # drive worker once, then inspect durable artifacts
    manifest = load_job_manifest(tmp_path, response.json()["job_id"])
    assert manifest["artifacts"]["advisor_plan"]
    assert manifest["artifacts"]["thesis_draft"]


def test_real_execution_can_end_blocked_when_delivery_fails(tmp_path: Path) -> None:
    client = build_delivery_blocked_client(tmp_path)
    response = submit_brief(client, title="图书管理系统")
    assert response.status_code == 201
    manifest = load_job_manifest(tmp_path, response.json()["job_id"])
    assert manifest["final_disposition"] == "blocked"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_end_to_end.py -v`
Expected: FAIL because end-to-end coverage does not yet assert real multi-agent outputs

- [ ] **Step 3: Implement minimal end-to-end fixtures and support**

Implementation requirements:
- keep tests local and deterministic
- verify durable artifacts, final manifest, and final disposition
- assert no runtime secrets are present in stored artifacts

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_end_to_end.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_end_to_end.py
git commit -m "test: cover real multi-agent execution outcomes"
```

### Task 9: Expose richer multi-agent detail in the frontend history workbench

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/JobDetailPanel.tsx`
- Modify: `frontend/src/components/AgentBoard.tsx`
- Modify: `frontend/src/components/ArtifactList.tsx`
- Modify: `frontend/src/components/JobEventTimeline.tsx`
- Modify: `frontend/src/App.integration.test.tsx`
- Test: `frontend/src/App.integration.test.tsx`

- [ ] **Step 1: Write the failing frontend integration test**

```tsx
test("detail workbench shows repair, review, and verification progress for a selected job", async () => {
  mockRunningJobDetailWithArtifactsAndReviews();
  render(<App />);
  expect(await screen.findByText(/repair/i)).toBeInTheDocument();
  expect(screen.getByText(/delivery_reviewer/i)).toBeInTheDocument();
  expect(screen.getByText(/job_manifest/i)).toBeInTheDocument();
  expect(screen.getByText(/verification_completed/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- --run frontend/src/App.integration.test.tsx`
Expected: FAIL because the detail workbench does not yet render the richer execution information

- [ ] **Step 3: Implement minimal detail-panel and timeline upgrades**

Implementation requirements:
- keep the existing single-page layout and local polling model
- surface richer agent summaries in `AgentBoard`
- show artifact kinds and paths in a more scannable way in `ArtifactList`
- show blocked vs failed outcome, repair occurrence, and runtime preset summary in `JobDetailPanel`
- show meaningful milestone events in `JobEventTimeline`
- keep API-key values absent from rendered persisted settings and job detail data

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- --run frontend/src/App.integration.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types.ts frontend/src/App.tsx frontend/src/components/JobDetailPanel.tsx frontend/src/components/AgentBoard.tsx frontend/src/components/ArtifactList.tsx frontend/src/components/JobEventTimeline.tsx frontend/src/App.integration.test.tsx
git commit -m "feat: show real multi-agent execution details"
```

### Task 10: Update docs and run full verification

**Files:**
- Modify: `README.md`
- Test: `backend/tests`
- Test: `frontend`

- [ ] **Step 1: Update README for the real execution chain**

Document:
- advisor/coder/writer/reviewer pipeline
- structured artifact locations
- single repair-round behavior
- completed vs failed vs blocked outcomes
- history workbench details for events, artifacts, and repair visibility

- [ ] **Step 2: Run full backend suite**

Run: `cd backend && . .venv/bin/activate && pytest -v`
Expected: PASS

- [ ] **Step 3: Run full frontend suite**

Run: `cd frontend && npm run test`
Expected: PASS

- [ ] **Step 4: Run frontend production build**

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 5: Run startup environment check**

Run: `bash scripts/dev.sh --check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: describe real multi-agent execution"
```

Plan complete and saved to `docs/superpowers/plans/2026-03-25-real-multi-agent-execution.md`. Ready to execute?
