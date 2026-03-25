# Async Job Runtime Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace synchronous inline job execution with a durable SQLite-backed async job runtime driven by an independent worker process, while keeping the current upload and polling UX working.

**Architecture:** The backend API will validate uploads and runtime config, persist the job plus uploaded brief and encrypted runtime secret handoff, and return an initial `pending` snapshot immediately. A separate worker process will claim pending jobs from SQLite, execute the existing orchestration flow, write durable progress back to the database, and reconcile stale `running` jobs from older worker sessions to `interrupted` on startup.

**Tech Stack:** FastAPI, SQLite (`sqlite3`), Python filesystem crypto helpers, pytest, React, TypeScript, Vitest, shell scripts

---

## File Structure

- `backend/src/idea2thesis/config.py`
  - add SQLite database path, worker heartbeat settings, secret key path, and secret directory defaults
- `backend/src/idea2thesis/contracts.py`
  - extend durable API response contracts for async job listing and detail
- `backend/src/idea2thesis/db.py`
  - create SQLite connection helpers and schema bootstrap
- `backend/src/idea2thesis/job_store.py`
  - own all durable job CRUD, claim, heartbeat, event, artifact, list, and reconciliation operations
- `backend/src/idea2thesis/secrets.py`
  - own machine-local encryption key generation plus per-job secret handoff write/read/delete helpers
- `backend/src/idea2thesis/services.py`
  - change `create_job` to enqueue semantics and route job detail/list through the durable store
- `backend/src/idea2thesis/orchestrator.py`
  - optionally emit progress callbacks and return data needed by the worker to persist durable state
- `backend/src/idea2thesis/worker.py`
  - add independent worker loop, worker session registration, claim cycle, reconciliation, and execution entrypoint
- `backend/src/idea2thesis/api.py`
  - add `GET /jobs`, keep `POST /jobs` async, and serve durable `GET /jobs/{job_id}`
- `backend/src/idea2thesis/main.py`
  - initialize shared services against the durable store without running jobs inline
- `backend/tests/test_db.py`
  - schema bootstrap and connection tests
- `backend/tests/test_job_store.py`
  - durable create/list/claim/reconcile tests
- `backend/tests/test_secrets.py`
  - encrypted secret handoff tests
- `backend/tests/test_worker.py`
  - worker claim/complete/interrupted reconciliation tests
- `backend/tests/test_api.py`
  - async job creation and job list API tests
- `backend/tests/test_end_to_end.py`
  - API + worker integration tests using durable state
- `frontend/src/types.ts`
  - add async status-safe shapes if needed
- `frontend/src/api.ts`
  - ensure polling works with durable async snapshots
- `frontend/src/App.tsx`
  - keep existing polling flow working with initial `pending` snapshots
- `frontend/src/App.integration.test.tsx`
  - verify pending-first async job behavior still renders correctly
- `scripts/dev.sh`
  - start backend API, worker, and frontend together
- `README.md`
  - document async worker startup and local encrypted secret handoff behavior

## Chunk 1: Durable Backend Foundations

### Task 1: Add SQLite bootstrap and encrypted secret handoff helpers

**Files:**
- Modify: `backend/src/idea2thesis/config.py`
- Create: `backend/src/idea2thesis/db.py`
- Create: `backend/src/idea2thesis/secrets.py`
- Create: `backend/tests/test_db.py`
- Create: `backend/tests/test_secrets.py`
- Test: `backend/tests/test_db.py`
- Test: `backend/tests/test_secrets.py`

- [ ] **Step 1: Write the failing database and secret tests**

```python
from pathlib import Path

from idea2thesis.config import Settings
from idea2thesis.db import initialize_database, open_connection
from idea2thesis.secrets import JobSecretEnvelope, read_job_secret, write_job_secret


def test_initialize_database_creates_required_tables(tmp_path: Path) -> None:
    settings = Settings(
        jobs_dir=tmp_path / "jobs",
        database_path=tmp_path / ".idea2thesis" / "jobs.db",
        settings_file=tmp_path / ".idea2thesis" / "settings.json",
        secret_key_path=tmp_path / ".idea2thesis" / "secret.key",
        secret_dir=tmp_path / ".idea2thesis" / "job-secrets",
    )
    initialize_database(settings)
    with open_connection(settings) as connection:
        rows = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
    assert {"jobs", "job_agent_states", "job_artifacts", "job_events", "job_runtime_inputs", "workers"} <= rows


def test_job_secret_round_trip_uses_machine_local_key(tmp_path: Path) -> None:
    settings = Settings(
        jobs_dir=tmp_path / "jobs",
        database_path=tmp_path / ".idea2thesis" / "jobs.db",
        settings_file=tmp_path / ".idea2thesis" / "settings.json",
        secret_key_path=tmp_path / ".idea2thesis" / "secret.key",
        secret_dir=tmp_path / ".idea2thesis" / "job-secrets",
    )
    envelope = JobSecretEnvelope(
        global_api_key="global-key",
        per_agent_api_keys={"coder": "coder-key"},
    )
    secret_path = write_job_secret(settings, "job-1", envelope)
    restored = read_job_secret(settings, secret_path)
    assert restored == envelope
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_db.py tests/test_secrets.py -v`
Expected: FAIL because database and secret modules do not exist yet

- [ ] **Step 3: Implement minimal database bootstrap and secret handoff**

Implementation requirements:
- add config fields for SQLite path, secret key path, secret directory, and worker heartbeat interval
- create schema bootstrap for `jobs`, `job_agent_states`, `job_artifacts`, `job_events`, `job_runtime_inputs`, and `workers`
- create machine-local key file helper under the application workspace
- write encrypted per-job secret handoff files outside SQLite
- support read and delete helpers for worker consumption
- do not introduce any git-tracked secret artifacts

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_db.py tests/test_secrets.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/idea2thesis/config.py backend/src/idea2thesis/db.py backend/src/idea2thesis/secrets.py backend/tests/test_db.py backend/tests/test_secrets.py
git commit -m "feat: add durable job database and secret handoff"
```

### Task 2: Add durable job store create, list, claim, and reconciliation operations

**Files:**
- Create: `backend/src/idea2thesis/job_store.py`
- Modify: `backend/src/idea2thesis/contracts.py`
- Create: `backend/tests/test_job_store.py`
- Test: `backend/tests/test_job_store.py`

- [ ] **Step 1: Write the failing durable job store tests**

```python
from pathlib import Path

from idea2thesis.config import Settings
from idea2thesis.db import initialize_database
from idea2thesis.job_store import JobStore


def test_create_job_returns_pending_snapshot(tmp_path: Path) -> None:
    settings = Settings(
        jobs_dir=tmp_path / "jobs",
        database_path=tmp_path / ".idea2thesis" / "jobs.db",
        settings_file=tmp_path / ".idea2thesis" / "settings.json",
        secret_key_path=tmp_path / ".idea2thesis" / "secret.key",
        secret_dir=tmp_path / ".idea2thesis" / "job-secrets",
    )
    initialize_database(settings)
    store = JobStore(settings)
    snapshot = store.create_job(
        job_id="job-1",
        brief_title="学生成绩分析系统",
        input_file_path=str(tmp_path / "jobs" / "job-1" / "input" / "brief.docx"),
        workspace_path=str(tmp_path / "jobs" / "job-1" / "workspace"),
        secret_file_path=str(tmp_path / ".idea2thesis" / "job-secrets" / "job-1.bin"),
        runtime_inputs={"global_base_url": "https://example.com/v1", "global_model": "gpt-test", "agents_json": "{}", "api_key_required": True},
        agents=["advisor", "coder"],
    )
    assert snapshot.status == "pending"
    assert [agent.status for agent in snapshot.agents] == ["pending", "pending"]


def test_reconcile_stale_running_jobs_marks_only_prior_running_jobs_interrupted(tmp_path: Path) -> None:
    settings = Settings(
        jobs_dir=tmp_path / "jobs",
        database_path=tmp_path / ".idea2thesis" / "jobs.db",
        settings_file=tmp_path / ".idea2thesis" / "settings.json",
        secret_key_path=tmp_path / ".idea2thesis" / "secret.key",
        secret_dir=tmp_path / ".idea2thesis" / "job-secrets",
    )
    initialize_database(settings)
    store = JobStore(settings)
    store.create_job(...)
    # move one job to running on stale worker, keep another pending
    interrupted_count = store.reconcile_stale_running_jobs(active_worker_ids={"worker-current"})
    assert interrupted_count == 1
    assert store.get_job("running-job").status == "interrupted"
    assert store.get_job("pending-job").status == "pending"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_job_store.py -v`
Expected: FAIL because `JobStore` and durable contracts do not exist yet

- [ ] **Step 3: Implement durable job store primitives**

Implementation requirements:
- add job list response contracts as needed for `GET /jobs`
- persist initial agent states, artifacts, and events
- support atomic claim from `pending` to `running`
- support worker session registration and heartbeat
- reconcile only stale `running` jobs, never normal `pending` jobs
- include secret file path reference in storage only, not secret contents

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_job_store.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/idea2thesis/job_store.py backend/src/idea2thesis/contracts.py backend/tests/test_job_store.py
git commit -m "feat: add durable async job store"
```

## Chunk 2: API Enqueue Flow And Worker Execution

### Task 3: Convert API job creation and job reads to durable async semantics

**Files:**
- Modify: `backend/src/idea2thesis/services.py`
- Modify: `backend/src/idea2thesis/api.py`
- Modify: `backend/src/idea2thesis/main.py`
- Modify: `backend/tests/test_api.py`
- Modify: `backend/tests/test_end_to_end.py`
- Test: `backend/tests/test_api.py`
- Test: `backend/tests/test_end_to_end.py`

- [ ] **Step 1: Write the failing API tests for async enqueue and list behavior**

```python
def test_create_job_returns_pending_snapshot_without_inline_execution(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.post(
        "/jobs",
        files={"file": ("brief.docx", build_brief_bytes(), DOCX_MIME)},
        data={"config": valid_runtime_config_json()},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["final_disposition"] == "pending"
    assert not any(item["kind"] == "verification_report" for item in body["artifacts"])


def test_get_jobs_lists_durable_jobs(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    client.post("/jobs", files={"file": ("brief.docx", build_brief_bytes(), DOCX_MIME)}, data={"config": valid_runtime_config_json()})
    response = client.get("/jobs")
    assert response.status_code == 200
    assert response.json()["items"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_api.py tests/test_end_to_end.py -v`
Expected: FAIL because `POST /jobs` still runs inline and `GET /jobs` is missing

- [ ] **Step 3: Implement async enqueue API flow**

Implementation requirements:
- initialize the database on app startup
- `create_job` must validate config, persist uploaded file, write encrypted secret handoff, create durable job row, and return a `pending` snapshot
- `GET /jobs/{job_id}` must read from the durable store instead of filesystem snapshot files
- add `GET /jobs` with status/query/pagination/sort support
- preserve existing runtime config validation and keep secrets out of responses
- do not execute orchestration inline in the API process
- if durable enqueue creation fails midway, roll back or clean up orphaned input files and encrypted secret handoff files before returning an error

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_api.py tests/test_end_to_end.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/idea2thesis/services.py backend/src/idea2thesis/api.py backend/src/idea2thesis/main.py backend/tests/test_api.py backend/tests/test_end_to_end.py
git commit -m "feat: enqueue async jobs from api"
```

### Task 4: Add independent worker process and durable completion updates

**Files:**
- Create: `backend/src/idea2thesis/worker.py`
- Modify: `backend/src/idea2thesis/orchestrator.py`
- Create: `backend/tests/test_worker.py`
- Modify: `backend/tests/test_end_to_end.py`
- Test: `backend/tests/test_worker.py`
- Test: `backend/tests/test_end_to_end.py`

- [ ] **Step 1: Write the failing worker tests**

```python
from pathlib import Path

from idea2thesis.config import Settings
from idea2thesis.db import initialize_database
from idea2thesis.job_store import JobStore
from idea2thesis.worker import AsyncJobWorker


def test_worker_claims_pending_job_and_persists_completion(tmp_path: Path) -> None:
    settings = Settings(
        jobs_dir=tmp_path / "jobs",
        database_path=tmp_path / ".idea2thesis" / "jobs.db",
        settings_file=tmp_path / ".idea2thesis" / "settings.json",
        secret_key_path=tmp_path / ".idea2thesis" / "secret.key",
        secret_dir=tmp_path / ".idea2thesis" / "job-secrets",
    )
    initialize_database(settings)
    store = JobStore(settings)
    store.create_job(...)
    worker = AsyncJobWorker(settings)
    worker.run_once()
    snapshot = store.get_job("job-1")
    assert snapshot.status == "completed"
    assert any(item.kind == "verification_report" for item in snapshot.artifacts)
    assert not store.get_job_record("job-1").secret_file_path


def test_worker_startup_reconciles_stale_running_jobs_only(tmp_path: Path) -> None:
    settings = Settings(...)
    initialize_database(settings)
    store = JobStore(settings)
    # seed stale running job and pending job
    worker = AsyncJobWorker(settings)
    worker.reconcile_startup_state()
    assert store.get_job("stale-running").status == "interrupted"
    assert store.get_job("still-pending").status == "pending"
    assert not store.get_job_record("stale-running").secret_file_path
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_worker.py tests/test_end_to_end.py -v`
Expected: FAIL because worker module and durable completion flow do not exist yet

- [ ] **Step 3: Implement worker claim and execution loop**

Implementation requirements:
- register worker sessions and heartbeat updates
- reconcile stale `running` jobs on worker startup
- claim one pending job atomically
- decrypt the per-job secret handoff file at execution time
- run the existing orchestration flow and map results back into durable tables
- persist agent progress, artifacts, validation state, and terminal disposition
- delete the per-job secret handoff file on terminal completion, failure, block, or interruption reconciliation
- cover secret handoff deletion explicitly in worker tests for successful completion and stale-running reconciliation

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_worker.py tests/test_end_to_end.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/idea2thesis/worker.py backend/src/idea2thesis/orchestrator.py backend/tests/test_worker.py backend/tests/test_end_to_end.py
git commit -m "feat: add async job worker"
```

## Chunk 3: Frontend Compatibility And Dev Workflow

### Task 5: Keep frontend polling flow working with async `pending` jobs

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.integration.test.tsx`
- Test: `frontend/src/App.integration.test.tsx`

- [ ] **Step 1: Write the failing frontend integration test for async pending flow**

```tsx
test("handles pending-first async jobs and later completion", async () => {
  const intervalCallbacks: Array<() => void | Promise<void>> = [];
  vi.spyOn(window, "setInterval").mockImplementation((handler) => {
    intervalCallbacks.push(handler as () => void | Promise<void>);
    return 1;
  });
  vi.spyOn(window, "clearInterval").mockImplementation(() => {});
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(okSettingsResponse())
    .mockResolvedValueOnce(okPendingJobResponse())
    .mockResolvedValueOnce(okRunningJobResponse())
    .mockResolvedValueOnce(okCompletedJobResponse());
  vi.stubGlobal("fetch", fetchMock);

  render(<App />);
  // upload file and submit...
  expect(screen.getByText("Current stage: queued")).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- src/App.integration.test.tsx`
Expected: FAIL because frontend assumptions are still tuned to inline completion semantics

- [ ] **Step 3: Implement minimal frontend async compatibility**

Implementation requirements:
- accept initial `pending` snapshot and continue polling
- keep existing upload flow and settings flow intact
- support any small durable contract changes needed by `GET /jobs`
- do not add any history workspace UI or history-specific frontend API helper in this change

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- src/App.integration.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types.ts frontend/src/api.ts frontend/src/App.tsx frontend/src/App.integration.test.tsx
git commit -m "feat: support async job polling flow"
```

### Task 6: Update local dev workflow and docs for worker-based runtime

**Files:**
- Modify: `scripts/dev.sh`
- Modify: `README.md`
- Modify: `backend/tests/test_dev_script.py`
- Test: `backend/tests/test_dev_script.py`

- [ ] **Step 1: Write the failing dev-script test for worker startup**

```python
def test_dev_script_check_mode_mentions_worker_requirements(tmp_path: Path) -> None:
    result = run_dev_script_check(tmp_path)
    assert "Environment check passed." in result.stdout
    assert result.returncode == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_dev_script.py -v`
Expected: FAIL because `scripts/dev.sh` does not start the worker yet

- [ ] **Step 3: Implement worker-aware dev startup and docs**

Implementation requirements:
- make `scripts/dev.sh` start backend API, worker process, and frontend process together
- update cleanup handling for the third process
- document worker startup, SQLite runtime database, and encrypted secret handoff behavior in `README.md`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_dev_script.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/dev.sh README.md backend/tests/test_dev_script.py
git commit -m "docs: update local async worker workflow"
```

## Chunk 4: Full Verification

### Task 7: Run full verification before completion

**Files:**
- Test: `backend/tests`
- Test: `frontend/src`

- [ ] **Step 1: Run full backend suite**

Run: `cd backend && . .venv/bin/activate && pytest -v`
Expected: PASS

- [ ] **Step 2: Run full frontend suite**

Run: `cd frontend && npm run test`
Expected: PASS

- [ ] **Step 3: Run frontend production build**

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 4: Run a focused manual async smoke path**

Run:

```bash
cd /Users/culcul/Desktop/code/github/idea2thesis
bash scripts/dev.sh --check
```

Expected:
- environment check passes
- worker startup path is wired into the script and documented

- [ ] **Step 5: Commit final verification or doc touch-ups if needed**

```bash
git status --short
```

Expected:
- no unexpected leftover changes before final push

Plan complete and saved to `docs/superpowers/plans/2026-03-25-async-job-runtime.md`. Ready to execute?
