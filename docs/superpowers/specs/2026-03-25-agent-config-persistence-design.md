# Agent Config Persistence Design Spec

## Overview

This change upgrades `idea2thesis` so model configuration is no longer a purely local UI placeholder. The frontend will:

- submit runtime model settings to the backend when creating a job
- remember non-sensitive configuration locally across page reloads
- keep `API Key` ephemeral and require it to be re-entered
- support a global default configuration with optional per-agent overrides
- hide per-agent overrides behind an `Advanced Settings` toggle

The backend will:

- expose and persist non-sensitive default configuration
- accept per-request runtime configuration for job creation
- resolve the effective configuration for each agent from global defaults plus optional overrides
- bind the resolved runtime config to the current job execution

Source of truth for v1:

- persisted non-sensitive settings are stored on the backend filesystem and exposed through `GET /settings`
- frontend `localStorage` is only a short-lived cache used to keep the UI responsive before `GET /settings` returns
- when both exist, backend settings win and overwrite frontend cached non-sensitive values

## Goals

- Make frontend model settings actually affect job execution.
- Persist `Base URL` and `Model` across page reloads.
- Never persist `API Key`.
- Support global config by default.
- Support per-agent override config behind `Advanced Settings`.
- Keep the current upload + polling job flow intact.

## Non-Goals

- Encrypting local secrets at rest in v1, because `API Key` will not be stored.
- Supporting multiple saved profiles in v1.
- Adding hosted multi-user auth or server-side user accounts.
- Changing the backend job execution model to async background workers in this change.

## User Experience

### Default Flow

1. User opens the page.
2. Frontend loads persisted non-sensitive settings.
3. Frontend pre-fills:
   - global `Base URL`
   - global `Model`
   - any saved agent override `Base URL` / `Model`
4. Global `API Key` is blank and must be entered again.
5. User may leave `Advanced Settings` collapsed.
6. User uploads a `.docx` brief and clicks `Generate Project`.
7. Frontend sends the current runtime configuration and file to the backend.
8. Job execution uses the effective config for each agent.

### Advanced Flow

1. User expands `Advanced Settings`.
2. Frontend shows agent cards for:
   - `advisor`
   - `coder`
   - `writer`
   - `requirements_reviewer`
   - `engineering_reviewer`
   - `delivery_reviewer`
   - `code_eval`
   - `doc_check`
3. Each card has:
   - `Use global settings` toggle
   - override `API Key`
   - override `Base URL`
   - override `Model`
4. If `Use global settings` is on, the override inputs are disabled or hidden.
5. If it is off, the user may provide per-agent overrides.

## Persistence Rules

Persist locally:

- global `Base URL`
- global `Model`
- per-agent override enabled/disabled flag
- per-agent override `Base URL`
- per-agent override `Model`

Do not persist:

- global `API Key`
- per-agent override `API Key`

After page reload:

- `Base URL` and `Model` values are restored
- `API Key` fields remain empty

## Frontend Data Model

### Global Settings

- `apiKey: string`
- `baseUrl: string`
- `model: string`

### Per-Agent Override

- `useGlobal: boolean`
- `apiKey: string`
- `baseUrl: string`
- `model: string`

### Persisted Frontend Settings

Persisted settings should include only non-sensitive fields:

- `global.baseUrl`
- `global.model`
- `agents[role].useGlobal`
- `agents[role].baseUrl`
- `agents[role].model`

Suggested storage:

- browser `localStorage`

Backend persistence for v1:

- store non-sensitive settings in a local JSON file under the application workspace
- those settings survive server restarts
- frontend should update backend-persisted non-sensitive settings whenever the user changes `Base URL`, `Model`, or agent override non-sensitive fields

## Backend Data Model

The backend should define explicit runtime config models:

- `GlobalRuntimeConfig`
  - `api_key`
  - `base_url`
  - `model`
- `AgentRuntimeOverride`
  - `role`
  - `use_global`
  - optional `api_key`
  - optional `base_url`
  - optional `model`
- `JobRuntimeConfig`
  - `global`
  - `agents`

The backend should also define a non-sensitive persisted settings model for `GET /settings`, excluding any API key values.

## API Changes

### `GET /settings`

Should return non-sensitive persisted settings:

- global `base_url`
- global `model`
- per-agent override metadata and non-sensitive values
- `api_key_configured` remains informational only

Should not return any actual API key.

### `PUT /settings`

Must accept a non-sensitive settings payload containing:

- global `base_url`
- global `model`
- per-agent override metadata and non-sensitive values

This endpoint is the write path for persisted non-sensitive settings and must:

- overwrite the backend settings file atomically
- return the saved non-sensitive settings payload
- survive server restarts

### `POST /jobs`

Must accept:

- `multipart/form-data`
- file field `file`
- runtime config payload as serialized JSON field named `config`

The runtime config payload should include:

- `schema_version`
- global `API Key / Base URL / Model`
- per-agent override values

Suggested payload shape:

```json
{
  "schema_version": "v1alpha1",
  "global": {
    "api_key": "runtime only",
    "base_url": "https://api.openai.com/v1",
    "model": "gpt-4.1-mini"
  },
  "agents": {
    "advisor": {
      "use_global": true,
      "api_key": "",
      "base_url": "",
      "model": ""
    }
  }
}
```

The backend should parse the config, validate it, and use it for that job only.
The runtime config is part of job creation only and must not be returned from polling endpoints.

## Effective Config Resolution

For each agent:

1. Start from global config.
2. If agent override is disabled, use global config unchanged.
3. If agent override is enabled:
   - override `API Key` if provided
   - override `Base URL` if provided
   - override `Model` if provided
4. If required fields are missing after resolution, reject job creation with a validation error.

## Validation Rules

Frontend:

- require uploaded `.docx`
- require global `Base URL`
- require global `Model`
- require that at least one effective `API Key` path exists for every required agent
- if an agent override is enabled and override `API Key` is blank, fallback to global `API Key`
- if override `Base URL` or `Model` is blank, fallback to global values

Backend:

- reject malformed runtime config JSON
- reject unknown agent roles
- reject job creation if effective config for any required agent lacks `API Key`, `Base URL`, or `Model`
- validate `schema_version` for runtime config payload
- reject invalid `base_url` values

## Base URL Safety

Because the backend will send requests to user-provided `Base URL` values, v1 must validate them conservatively.

Rules:

- allow only `http` and `https`
- default recommendation is `https`
- reject empty hostnames
- reject local file schemes or non-HTTP schemes
- reject loopback and private-network hosts unless the user explicitly enables a future unsafe-development mode

This means v1 favors public reachable API endpoints and does not silently allow arbitrary local-network targets.

## Component Boundaries

Frontend:

- `App.tsx`
  - owns runtime config state, persistence, upload, polling
- `SettingsForm.tsx`
  - renders global settings
- new `AgentConfigPanel.tsx`
  - renders advanced per-agent override controls
- `api.ts`
  - serializes runtime config into `POST /jobs`

Backend:

- `config.py`
  - persistent non-sensitive settings storage helpers
- `contracts.py`
  - runtime config request/response models
- `services.py`
  - parse request config and persist non-sensitive defaults
- `orchestrator.py`
  - resolve effective per-agent config for execution
- `api.py`
  - accept and validate `config` field in `POST /jobs`

## Error Handling

Frontend should show:

- missing required config
- malformed config submission errors
- backend validation errors

Backend should return clear 4xx responses for:

- invalid runtime config JSON
- unknown agent roles
- missing effective config for a required agent

## Testing

### Frontend

- localStorage restores saved `Base URL` and `Model`
- localStorage does not restore `API Key`
- advanced settings toggle shows agent override controls
- `POST /jobs` includes serialized runtime config
- enabled agent override changes request payload

### Backend

- persisted settings response excludes API keys
- `POST /jobs` parses config JSON correctly
- effective agent config resolves in the right priority order
- unknown role override is rejected
- missing effective config is rejected

## Acceptance Criteria

- page reload restores non-sensitive global settings
- page reload does not restore any API key
- advanced settings allow per-agent override editing
- `POST /jobs` includes both file and runtime config
- backend uses effective per-agent config resolution
- frontend and backend tests pass
