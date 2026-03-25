# History Workbench Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent history workbench with list filtering, right-side detail inspection, rerun, soft delete, and event timeline on top of the existing async job runtime foundation.

**Architecture:** Extend the SQLite-backed async runtime with richer list/detail queries, event retrieval, rerun creation, and terminal-only soft delete. On the frontend, keep the top upload/settings flow intact while adding a two-pane workbench: a searchable/filterable history list on the left and a fixed job detail panel on the right that can drive rerun back into the shared settings form.

**Tech Stack:** FastAPI, SQLite (`sqlite3`), pytest, React, TypeScript, Vitest

---

## File Structure

- `backend/src/idea2thesis/contracts.py`
  - split list/detail/event contracts, add `deleted` status support, and define rerun preload response shapes
- `backend/src/idea2thesis/db.py`
  - add schema migration support for `deleted_at` on existing SQLite databases
- `backend/src/idea2thesis/job_store.py`
  - add list filtering, search, sort, detail preload fields, event retrieval, rerun creation, and soft delete operations
- `backend/src/idea2thesis/services.py`
  - expose event list, rerun, delete, and richer detail reads
- `backend/src/idea2thesis/api.py`
  - add `GET /jobs/{job_id}/events`, `POST /jobs/{job_id}/rerun`, and `DELETE /jobs/{job_id}`
- `backend/tests/test_job_store.py`
  - add query, rerun, event, and delete coverage
- `backend/tests/test_api.py`
  - add endpoint coverage for events, rerun, delete, and list query params
- `backend/tests/test_end_to_end.py`
  - add rerun and delete integration coverage
- `frontend/src/types.ts`
  - add job list, detail metadata, event timeline, and query state types
- `frontend/src/api.ts`
  - add history list, event list, rerun, and delete helpers
- `frontend/src/App.tsx`
  - own history query state, selected job state, detail loading, rerun bridge, and selected-job polling
- `frontend/src/components/HistoryList.tsx`
  - render search, status filter, sort control, and history rows
- `frontend/src/components/JobDetailPanel.tsx`
  - render selected job metadata, actions, agent state, artifacts, and event timeline
- `frontend/src/components/JobEventTimeline.tsx`
  - render the ordered event stream
- `frontend/src/App.integration.test.tsx`
  - cover workbench selection, rerun, delete, search/filter, and active-job polling behavior
- `README.md`
  - document history workbench, rerun, and soft-delete semantics

## Chunk 1: Backend History Queries And Detail Enrichment

### Task 1: Add contracts, schema migration, and durable store support for list filters, detail preload, and events

**Files:**
- Modify: `backend/src/idea2thesis/contracts.py`
- Modify: `backend/src/idea2thesis/db.py`
- Modify: `backend/src/idea2thesis/job_store.py`
- Modify: `backend/tests/test_job_store.py`
- Test: `backend/tests/test_job_store.py`

- [ ] **Step 1: Write the failing job store tests**

```python
def test_list_jobs_supports_status_and_query_filters(tmp_path: Path) -> None:
    store = seeded_store(tmp_path)
    response = store.list_jobs(status="completed", query="图书")
    assert response.total == 1
    assert response.items[0].brief_title == "图书管理系统"


def test_get_job_detail_includes_rerun_preload_fields(tmp_path: Path) -> None:
    store = seeded_store(tmp_path)
    detail = store.get_job("job-1")
    assert detail.runtime_preset["global"]["base_url"] == "https://example.com/v1"
    assert detail.runtime_preset["global"]["model"] == "gpt-test"
    assert detail.runtime_preset["agents"]["coder"]["use_global"] is False
    assert detail.runtime_preset["agents"]["coder"]["base_url"] == "https://coder.example.com/v1"
    assert detail.runtime_preset["agents"]["coder"]["model"] == "gpt-coder"
    assert "api_key" not in detail.model_dump_json()


def test_get_job_events_returns_ordered_timeline(tmp_path: Path) -> None:
    store = seeded_store(tmp_path)
    events = store.list_job_events("job-1")
    assert [event.kind for event in events] == ["job_created", "worker_claimed", "job_completed"]


def test_initialize_database_adds_deleted_at_column_for_existing_db(tmp_path: Path) -> None:
    legacy_settings = build_legacy_settings_without_deleted_at(tmp_path)
    initialize_database(legacy_settings)
    columns = fetch_job_table_columns(legacy_settings)
    assert "deleted_at" in columns
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_job_store.py -v`
Expected: FAIL because filters, preload fields, and event timeline helpers are missing

- [ ] **Step 3: Implement durable history query and detail primitives**

Implementation requirements:
- add response models for event timeline items, detail metadata, and rerun preload payloads
- explicitly evolve `get_job()` backing data from the current `JobSnapshot` contract to a richer durable detail contract used by `GET /jobs/{job_id}`
- keep `JobListItem`, terminal snapshots, and detail responses aligned on status literals, including `deleted`
- add SQLite initialization/migration logic so existing databases gain a nullable `deleted_at` column
- extend `GET /jobs/{job_id}` backing data to include:
  - `source_job_id`
  - `workspace_path`
  - `input_file_path`
  - `error_message`
  - `deleted_at`
  - rerun preload fields from `job_runtime_inputs`
- extend `list_jobs` to support status/query/sort/limit/offset
- add ordered event retrieval from `job_events`
- keep all returned rerun preload data non-sensitive

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_job_store.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/idea2thesis/contracts.py backend/src/idea2thesis/job_store.py backend/tests/test_job_store.py
git commit -m "feat: add history query and detail models"
```

## Chunk 2: Backend Events, Rerun, And Soft Delete Endpoints

### Task 2: Add event, rerun, and delete service/store logic

**Files:**
- Modify: `backend/src/idea2thesis/services.py`
- Modify: `backend/src/idea2thesis/db.py`
- Modify: `backend/src/idea2thesis/job_store.py`
- Modify: `backend/tests/test_job_store.py`
- Modify: `backend/tests/test_end_to_end.py`
- Test: `backend/tests/test_job_store.py`
- Test: `backend/tests/test_end_to_end.py`

- [ ] **Step 1: Write the failing store and integration tests**

```python
def test_rerun_creates_new_pending_job_with_source_link(tmp_path: Path) -> None:
    store = seeded_store(tmp_path)
    snapshot = store.create_rerun_job(
        source_job_id="job-1",
        new_job_id="job-2",
        secret_file_path="/tmp/job-2.bin",
    )
    assert snapshot.status == "pending"
    assert store.get_job("job-2").source_job_id == "job-1"


def test_delete_terminal_job_marks_status_deleted(tmp_path: Path) -> None:
    store = completed_store(tmp_path)
    store.soft_delete_job("job-1")
    detail = store.get_job("job-1")
    assert detail.status == "deleted"
    assert detail.deleted_at is not None


def test_delete_running_job_is_rejected(tmp_path: Path) -> None:
    store = running_store(tmp_path)
    with pytest.raises(ValueError):
        store.soft_delete_job("job-1")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_job_store.py tests/test_end_to_end.py -v`
Expected: FAIL because rerun and delete flows do not exist yet

- [ ] **Step 3: Implement rerun and soft delete primitives**

Implementation requirements:
- create rerun jobs by reusing the prior job’s input file and persisted non-sensitive runtime inputs
- require fresh runtime config input for rerun
- set `source_job_id` on rerun jobs
- append `job_rerun_created` event for the source or new job, consistently documented in tests
- persist `deleted_at` on soft delete and surface it through detail reads
- allow delete only for terminal jobs
- append `job_deleted` event
- keep files intact
- reject rerun if source input file is missing

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_job_store.py tests/test_end_to_end.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/idea2thesis/services.py backend/src/idea2thesis/job_store.py backend/tests/test_job_store.py backend/tests/test_end_to_end.py
git commit -m "feat: add rerun and soft delete flows"
```

### Task 3: Expose history workbench endpoints through the API

**Files:**
- Modify: `backend/src/idea2thesis/api.py`
- Modify: `backend/tests/test_api.py`
- Test: `backend/tests/test_api.py`

- [ ] **Step 1: Write the failing API tests**

```python
def test_get_job_events_returns_timeline(tmp_path: Path) -> None:
    client = build_client_with_seeded_job(tmp_path)
    response = client.get("/jobs/job-1/events")
    assert response.status_code == 200
    assert response.json()["items"]


def test_get_job_detail_returns_rerun_preload_without_secrets(tmp_path: Path) -> None:
    client = build_client_with_seeded_job(tmp_path)
    response = client.get("/jobs/job-1")
    assert response.status_code == 200
    body = response.json()
    assert body["runtime_preset"]["global"]["base_url"] == "https://example.com/v1"
    assert body["runtime_preset"]["global"]["model"] == "gpt-test"
    assert body["runtime_preset"]["agents"]["coder"]["use_global"] is False
    assert body["runtime_preset"]["agents"]["coder"]["base_url"] == "https://coder.example.com/v1"
    assert body["runtime_preset"]["agents"]["coder"]["model"] == "gpt-coder"
    assert "api_key" not in response.text


def test_rerun_endpoint_returns_new_pending_job(tmp_path: Path) -> None:
    client = build_client_with_seeded_job(tmp_path)
    response = client.post("/jobs/job-1/rerun", data={"config": valid_runtime_config_json()})
    assert response.status_code == 201
    assert response.json()["status"] == "pending"


def test_delete_non_terminal_job_returns_conflict(tmp_path: Path) -> None:
    client = build_client_with_running_job(tmp_path)
    response = client.delete("/jobs/job-1")
    assert response.status_code == 409
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_api.py -v`
Expected: FAIL because the history endpoints are missing

- [ ] **Step 3: Implement history workbench API routes**

Implementation requirements:
- `GET /jobs` must accept query params for status/query/limit/offset/sort
- `GET /jobs/{job_id}` must return the enriched detail payload rather than the old bare `JobSnapshot`
- add `GET /jobs/{job_id}/events`
- add `POST /jobs/{job_id}/rerun`
- add `DELETE /jobs/{job_id}`
- map delete-on-active to `409`
- keep responses free of runtime secrets

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/idea2thesis/api.py backend/tests/test_api.py
git commit -m "feat: expose history workbench api"
```

## Chunk 3: Frontend Workbench UI

### Task 4: Add history list and detail panel components

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api.ts`
- Create: `frontend/src/components/HistoryList.tsx`
- Create: `frontend/src/components/JobDetailPanel.tsx`
- Create: `frontend/src/components/JobEventTimeline.tsx`
- Modify: `frontend/src/App.integration.test.tsx`
- Test: `frontend/src/App.integration.test.tsx`

- [ ] **Step 1: Write the failing frontend integration tests for list and selection**

```tsx
test("loads history list and selects the first job by default", async () => {
  vi.stubGlobal("fetch", historyWorkbenchFetchMock());
  render(<App />);
  expect(await screen.findByText("图书管理系统")).toBeInTheDocument();
  expect(await screen.findByText(/workspace path/i)).toBeInTheDocument();
});


test("selecting a history row updates the right-side detail panel", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", historyWorkbenchFetchMock());
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /学生成绩分析系统/i }));
  expect(await screen.findByText(/学生成绩分析系统/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- src/App.integration.test.tsx`
Expected: FAIL because workbench components and state do not exist yet

- [ ] **Step 3: Implement workbench list and detail UI**

Implementation requirements:
- add typed history list and event response models
- add API helpers for list, detail events, rerun, and delete
- render two-pane workbench in `App.tsx`
- auto-select the first list row after load if no selection exists
- fetch detail events for the selected job
- keep current active-job panels usable during the transition

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- src/App.integration.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types.ts frontend/src/api.ts frontend/src/components/HistoryList.tsx frontend/src/components/JobDetailPanel.tsx frontend/src/components/JobEventTimeline.tsx frontend/src/App.integration.test.tsx
git commit -m "feat: add history workbench ui"
```

### Task 5: Wire rerun, delete, search, filter, sort, and selected-job polling

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.integration.test.tsx`
- Test: `frontend/src/App.integration.test.tsx`

- [ ] **Step 1: Write the failing frontend interaction tests**

```tsx
test("rerun repopulates non-sensitive settings and selects the new job", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", rerunFetchMock());
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /rerun/i }));
  expect(screen.getByLabelText("Base URL")).toHaveValue("https://example.com/v1");
  expect(screen.getByLabelText("API Key")).toHaveValue("");
  expect(await screen.findByText(/job-2/i)).toBeInTheDocument();
});


test("delete marks a terminal job as deleted and keeps it selected", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", deleteFetchMock());
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /delete/i }));
  expect(await screen.findByText(/status: deleted/i)).toBeInTheDocument();
});


test("search and status filters narrow the visible job list", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", historyWorkbenchFetchMock());
  render(<App />);
  await user.type(screen.getByLabelText("Search Jobs"), "图书");
  expect(screen.getByText("图书管理系统")).toBeInTheDocument();
  expect(screen.queryByText("学生成绩分析系统")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- src/App.integration.test.tsx`
Expected: FAIL because rerun/delete/query interactions are not wired yet

- [ ] **Step 3: Implement workbench interactions**

Implementation requirements:
- keep list query state in `App.tsx`
- add status filter, query field, and sort selection
- load selected job detail and events on selection change
- only poll the currently selected active job
- rerun must repopulate non-sensitive settings into the top form and leave API keys blank
- rerun must select the new queued job and start polling it
- delete must update the selected job state to `deleted`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- src/App.integration.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.integration.test.tsx
git commit -m "feat: wire history workbench interactions"
```

## Chunk 4: Docs And Verification

### Task 6: Update docs and run full verification

**Files:**
- Modify: `README.md`
- Test: `backend/tests`
- Test: `frontend/src`

- [ ] **Step 1: Update README for history workbench semantics**

Document:
- history list behavior
- rerun requires a new API key
- delete is soft delete only
- all jobs, including deleted jobs, remain visible by default

- [ ] **Step 2: Run full backend suite**

Run: `cd backend && . .venv/bin/activate && pytest -v`
Expected: PASS

- [ ] **Step 3: Run full frontend suite**

Run: `cd frontend && npm run test`
Expected: PASS

- [ ] **Step 4: Run frontend production build**

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: describe history workbench"
```

Plan complete and saved to `docs/superpowers/plans/2026-03-25-history-workbench.md`. Ready to execute?
