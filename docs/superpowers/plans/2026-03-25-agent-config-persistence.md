# Agent Config Persistence Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make frontend model settings actually drive job execution by persisting non-sensitive settings, accepting runtime config during job creation, and resolving effective per-agent configuration on the backend.

**Architecture:** Keep backend persistence file-based and non-sensitive. Add explicit runtime config models and settings endpoints in FastAPI. On the frontend, keep global settings visible by default, gate per-agent overrides behind an advanced toggle, and persist only non-sensitive fields while keeping API keys ephemeral.

**Tech Stack:** FastAPI, Pydantic, React, TypeScript, Vitest, pytest

---

## File Structure

- `backend/src/idea2thesis/contracts.py`
  - add runtime config and persisted settings models
- `backend/src/idea2thesis/config.py`
  - add backend settings file path and URL validation helpers
- `backend/src/idea2thesis/services.py`
  - read and write persisted non-sensitive settings, parse runtime config for job creation
- `backend/src/idea2thesis/api.py`
  - add `PUT /settings`, extend `POST /jobs` to accept `config`
- `backend/src/idea2thesis/orchestrator.py`
  - resolve effective per-agent config
- `backend/tests/test_api.py`
  - settings read/write tests
- `backend/tests/test_end_to_end.py`
  - runtime config submission tests
- `frontend/src/types.ts`
  - add frontend config types
- `frontend/src/api.ts`
  - add `saveSettings` and config-aware `uploadBrief`
- `frontend/src/App.tsx`
  - own global settings, advanced settings, persistence, upload config payload
- `frontend/src/components/SettingsForm.tsx`
  - render global settings fields
- `frontend/src/components/AgentConfigPanel.tsx`
  - render advanced per-agent override controls
- `frontend/src/App.integration.test.tsx`
  - test local restore, upload config payload, and advanced overrides

## Chunk 1: Backend Runtime Config And Settings Persistence

### Task 1: Add runtime config models and persisted settings models

**Files:**
- Modify: `backend/src/idea2thesis/contracts.py`
- Create: `backend/tests/test_runtime_config_contracts.py`
- Test: `backend/tests/test_runtime_config_contracts.py`

- [ ] **Step 1: Write failing contract tests**

```python
from idea2thesis.contracts import JobRuntimeConfig, PersistedSettings


def test_runtime_config_round_trip() -> None:
    config = JobRuntimeConfig(
        schema_version="v1alpha1",
        global={
            "api_key": "runtime",
            "base_url": "https://example.com/v1",
            "model": "gpt-test",
        },
        agents={},
    )
    restored = JobRuntimeConfig.model_validate_json(config.model_dump_json())
    assert restored == config


def test_persisted_settings_excludes_api_key() -> None:
    settings = PersistedSettings(
        schema_version="v1alpha1",
        global={
            "base_url": "https://example.com/v1",
            "model": "gpt-test",
        },
        agents={},
    )
    assert "api_key" not in settings.model_dump_json()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_runtime_config_contracts.py -v`
Expected: FAIL because models are missing

- [ ] **Step 3: Implement runtime config and persisted settings models**

Implementation requirements:
- add schema-versioned runtime config models
- separate persisted non-sensitive settings from runtime config
- match the runtime payload contract exactly: `schema_version`, `global`, `agents`
- keep API keys out of persisted settings models

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_runtime_config_contracts.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/idea2thesis/contracts.py backend/tests/test_runtime_config_contracts.py
git commit -m "feat: add runtime config models"
```

### Task 2: Add backend persisted settings read and write path

**Files:**
- Modify: `backend/src/idea2thesis/config.py`
- Modify: `backend/src/idea2thesis/services.py`
- Modify: `backend/src/idea2thesis/api.py`
- Modify: `backend/tests/test_api.py`
- Test: `backend/tests/test_api.py`

- [ ] **Step 1: Write failing API tests for settings persistence**

```python
def test_put_settings_persists_non_sensitive_values(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.put(
        "/settings",
        json={
            "schema_version": "v1alpha1",
            "global": {
                "base_url": "https://example.com/v1",
                "model": "gpt-test"
            },
            "agents": {}
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["global"]["base_url"] == "https://example.com/v1"


def test_get_settings_reports_api_key_configured_without_returning_secret(tmp_path: Path) -> None:
    client = build_client(tmp_path, api_key="server-key")
    response = client.get("/settings")
    assert response.status_code == 200
    body = response.json()
    assert body["api_key_configured"] is True
    assert "api_key" not in response.text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_api.py -v`
Expected: FAIL because `PUT /settings` is missing

- [ ] **Step 3: Implement persisted settings storage**

Implementation requirements:
- store non-sensitive settings in a JSON file under the backend workspace
- add a dedicated settings path in backend config
- implement atomic overwrite for `PUT /settings` so saved settings survive restarts
- add `PUT /settings`
- make `GET /settings` read persisted values and expose `api_key_configured`
- reject invalid base URLs using the v1 safety rules:
  - only `http` / `https`
  - non-empty hostname
  - reject loopback or private-network hosts
- keep actual API keys out of persisted storage and API responses

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/idea2thesis/config.py backend/src/idea2thesis/services.py backend/src/idea2thesis/api.py backend/tests/test_api.py
git commit -m "feat: add persisted settings api"
```

### Task 3: Accept runtime config on job creation and resolve effective per-agent config

**Files:**
- Modify: `backend/src/idea2thesis/services.py`
- Modify: `backend/src/idea2thesis/orchestrator.py`
- Modify: `backend/tests/test_end_to_end.py`
- Test: `backend/tests/test_end_to_end.py`

- [ ] **Step 1: Write failing end-to-end test for config-aware job creation**

```python
def test_job_creation_accepts_runtime_config(tmp_path: Path) -> None:
    settings = Settings(
        jobs_dir=tmp_path / "jobs",
        api_key="",
        base_url="https://example.com/v1",
        model="gpt-test",
    )
    client = TestClient(create_app(settings))
    config = {
        "schema_version": "v1alpha1",
        "global": {
            "api_key": "runtime-key",
            "base_url": "https://example.com/v1",
            "model": "gpt-test"
        },
        "agents": {
            "coder": {
                "use_global": False,
                "api_key": "",
                "base_url": "https://override.example/v1",
                "model": "gpt-coder"
            }
        }
    }
    # multipart request omitted here in plan text
    # assert 201 and job snapshot returned
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_end_to_end.py -v`
Expected: FAIL because `POST /jobs` does not parse runtime config

- [ ] **Step 3: Implement runtime config parsing and effective resolution**

Implementation requirements:
- parse `config` JSON field from multipart request
- validate `schema_version`
- resolve effective per-agent settings from global plus overrides
- reject unknown agent roles
- reject missing effective API key/base URL/model for required agents
- allow blank override `api_key` / `base_url` / `model` values to fall back to global values
- do not return runtime secrets in polling payloads

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && . .venv/bin/activate && pytest tests/test_end_to_end.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/idea2thesis/services.py backend/src/idea2thesis/orchestrator.py backend/tests/test_end_to_end.py
git commit -m "feat: add runtime config job resolution"
```

## Chunk 2: Frontend Config Persistence And Advanced Overrides

### Task 4: Add frontend config models, settings save/load, and advanced panel

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api.ts`
- Create: `frontend/src/components/AgentConfigPanel.tsx`
- Create: `frontend/src/settings.test.tsx`
- Test: `frontend/src/settings.test.tsx`

- [ ] **Step 1: Write failing frontend config tests**

```tsx
test("saveSettings sends non-sensitive payload to backend", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ schema_version: "v1alpha1", global: {}, agents: {}, api_key_configured: false })
  });
  vi.stubGlobal("fetch", fetchMock);
  await saveSettings({
    schema_version: "v1alpha1",
    global: { base_url: "https://example.com/v1", model: "gpt-test" },
    agents: {}
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "/settings",
    expect.objectContaining({ method: "PUT" })
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- src/settings.test.tsx`
Expected: FAIL because helper or component is missing

- [ ] **Step 3: Implement settings helpers and advanced config panel**

Implementation requirements:
- add persisted settings types
- add `saveSettings` helper
- add presentational advanced agent config panel
- preserve the backend contract shape for non-sensitive settings: `schema_version`, `global`, `agents`
- keep API keys out of persisted settings payloads

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- src/settings.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types.ts frontend/src/api.ts frontend/src/components/AgentConfigPanel.tsx frontend/src/settings.test.tsx
git commit -m "feat: add frontend settings helpers"
```

### Task 5: Wire App state for persisted settings and runtime config submission

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/SettingsForm.tsx`
- Modify: `frontend/src/components/UploadForm.tsx`
- Modify: `frontend/src/App.integration.test.tsx`
- Test: `frontend/src/App.integration.test.tsx`

- [ ] **Step 1: Write failing integration tests**

```tsx
test("restores non-sensitive settings but not api key", async () => {
  localStorage.setItem("idea2thesis.settings.cache", JSON.stringify({
    schema_version: "v1alpha1",
    global: { base_url: "https://example.com/v1", model: "gpt-test" },
    agents: {}
  }));
  render(<App />);
  expect(screen.getByLabelText("Base URL")).toHaveValue("https://example.com/v1");
  expect(screen.getByLabelText("Model")).toHaveValue("gpt-test");
  expect(screen.getByLabelText("API Key")).toHaveValue("");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- src/App.integration.test.tsx`
Expected: FAIL because persisted settings restore is missing

- [ ] **Step 3: Implement App settings lifecycle**

Implementation requirements:
- load non-sensitive settings from backend, falling back to localStorage cache until fetch completes
- when backend settings arrive, treat them as source of truth and overwrite the local cache
- persist non-sensitive changes to localStorage and `PUT /settings`
- add `Advanced Settings` toggle
- render per-agent config panel
- require `.docx` upload before submit
- require global `Base URL` and `Model` before submit
- build runtime config under `config` with the exact shape `schema_version`, `global`, `agents`
- include runtime config JSON in `POST /jobs`
- when an override is enabled, blank per-agent `API Key`, `Base URL`, and `Model` fields must fall back to the global values for effective resolution checks and payload construction
- never persist API keys

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- src/App.integration.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/SettingsForm.tsx frontend/src/components/UploadForm.tsx frontend/src/App.integration.test.tsx
git commit -m "feat: persist frontend agent config settings"
```

### Task 6: Run full verification and update docs

**Files:**
- Modify: `README.md`
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

- [ ] **Step 4: Update README**

Document:
- global settings behavior
- advanced agent override mode
- `API Key` is not persisted
- `Base URL / Model` are remembered

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: describe agent config persistence"
```

Plan complete and saved to `docs/superpowers/plans/2026-03-25-agent-config-persistence.md`. Ready to execute?
