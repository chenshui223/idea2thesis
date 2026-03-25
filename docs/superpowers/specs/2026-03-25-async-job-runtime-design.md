# Async Job Runtime Design Spec

## Overview

This change upgrades `idea2thesis` from a synchronous request/response execution model to an asynchronous local job system backed by a persistent job database and an independent worker process.

The web application will:

- accept `.docx` briefs and runtime config as it does now
- create a persisted job record immediately
- return a `job_id` without waiting for generation to finish
- expose persisted job state for polling and future history views

The worker process will:

- claim pending jobs from persistent storage
- execute the job lifecycle outside the web server process
- write status, stage, agent progress, artifacts, and events back to persistent storage

Source of truth for v1:

- SQLite is the durable source of truth for job list, job detail, and job progress
- filesystem workspaces remain the source of truth for generated files and uploaded inputs
- in-memory process state is only a short-lived execution cache and must not be required to reconstruct job status after restart

## Goals

- Decouple job execution from the HTTP request lifecycle.
- Support an independent worker process for local single-user deployment.
- Persist job state across server restarts.
- Mark unfinished jobs as `interrupted` after restart instead of silently losing them.
- Preserve the current upload plus polling frontend flow with minimal user-facing breakage.
- Establish durable backend primitives for a later history workspace with search, filter, delete, and rerun.

## Non-Goals

- Hosted distributed queue infrastructure.
- Multi-user authentication or tenancy.
- Real multi-machine worker scaling in v1.
- Full history workbench UI in this change.
- Automatic recovery of unfinished jobs after restart.

## User Experience

### Default Flow

1. User enters runtime settings and uploads a `.docx` brief.
2. Frontend sends `POST /jobs`.
3. Backend validates input, persists the uploaded brief, stores a job record, and returns an initial snapshot immediately.
4. Frontend starts polling `GET /jobs/{job_id}`.
5. Worker process claims the pending job and updates progress over time.
6. Frontend reflects live changes until the job reaches a terminal state.

### Restart Behavior

1. Web server or worker process stops while a job is `pending` or `running`.
2. On next startup, unfinished jobs are marked as `interrupted`.
3. These jobs remain queryable and visible in future history views.
4. User may later rerun the job from persisted input and non-sensitive settings.

## Architecture

### Components

- Web API process
  - validates incoming uploads and runtime config
  - writes durable job records
  - persists uploaded input files and non-sensitive runtime metadata
  - serves job detail and job list endpoints
- Worker process
  - loops over persistent pending jobs
  - atomically claims one job at a time
  - executes the supervisor orchestrator
  - writes progress and terminal state
- SQLite job store
  - stores job metadata, detail snapshots, agent progress, artifacts, and event timeline
- Filesystem workspace
  - stores uploaded source `.docx`, parsed outputs, generated workspace, artifacts, logs

### Why SQLite

SQLite best matches the product constraints:

- local single-user deployment
- open source and easy to run
- persistent list/detail/history foundation
- simpler than external queue infrastructure
- more queryable and durable than an ad hoc file queue

## Durable Data Model

### `jobs`

Core row for each job:

- `id`
- `schema_version`
- `brief_title`
- `status`
  - `pending | running | completed | failed | blocked | interrupted | deleted`
- `stage`
- `created_at`
- `updated_at`
- `started_at`
- `finished_at`
- `worker_id`
- `source_job_id`
- `workspace_path`
- `input_file_path`
- `error_message`
- `validation_state`
- `final_disposition`

### `job_agent_states`

Current materialized status for each role:

- `job_id`
- `role`
- `status`
- `summary`
- `updated_at`

This allows `GET /jobs/{job_id}` to reconstruct the current agent board without replaying all events.

### `job_artifacts`

- `id`
- `job_id`
- `kind`
- `path`
- `label`

### `job_events`

Append-only event stream for audit and future detail UI:

- `id`
- `job_id`
- `timestamp`
- `kind`
- `message`
- `payload_json`

Example kinds:

- `job_created`
- `worker_claimed`
- `brief_parsed`
- `agent_started`
- `agent_finished`
- `artifact_written`
- `validation_finished`
- `job_completed`
- `job_failed`
- `job_blocked`
- `job_interrupted`

### `job_runtime_inputs`

Persist rerun-safe runtime metadata only:

- `job_id`
- `global_base_url`
- `global_model`
- `agents_json`
- `api_key_required`

This table must not store any actual `API Key`.

## API Changes

### `POST /jobs`

Still accepts:

- multipart `file`
- multipart text field `config`

Behavior changes:

- validate request
- persist uploaded brief and initial job metadata
- create durable initial snapshot with `pending` status
- return `201` immediately
- do not run the full generation pipeline inline

### `GET /jobs/{job_id}`

Returns durable current job state from SQLite, including:

- `job_id`
- `status`
- `stage`
- current agent statuses
- artifacts
- `validation_state`
- `final_disposition`

Must not return runtime secrets.

### `GET /jobs`

Added in this change for backend completeness.

Supports:

- `status`
- `query`
- `limit`
- `offset`
- `sort`

This endpoint is primarily to support the next history workspace change, but the durable API should be established now.

### Deferred Endpoints

Not implemented in this change:

- `POST /jobs/{job_id}/rerun`
- `DELETE /jobs/{job_id}`
- `GET /jobs/{job_id}/events`

These should be added in the follow-up history workspace change, built on the same durable storage.

## Worker Lifecycle

### Claiming

Worker must atomically claim one pending job:

1. select the next pending job
2. update it to `running`
3. write `worker_id`
4. set `started_at`
5. append `worker_claimed` event

The claim path must prevent two workers from processing the same job concurrently.

### Execution

Worker executes the same high-level generation stages as today:

1. parse uploaded brief
2. initialize git workspace
3. run supervisor orchestration
4. persist artifacts and reports
5. write terminal job state

### Restart Handling

On startup, both API process and worker process should run a reconciliation step:

- find jobs in `pending` or `running`
- mark them `interrupted`
- set `finished_at`
- write `error_message` explaining that the process restarted before completion
- append `job_interrupted` event

This matches the approved product behavior: do not auto-resume unfinished work.

## Frontend Impact

Frontend upload and polling flow should remain mostly unchanged:

- upload still calls `POST /jobs`
- polling still calls `GET /jobs/{job_id}`
- initial snapshot now returns `pending` more often

Minimal UI changes in this spec:

- show `pending` as a normal pre-execution state
- show `interrupted` as a terminal error-like state
- no history table yet

## Validation Rules

Backend must still enforce all existing config validation:

- require valid `.docx` upload
- require runtime config payload
- reject unknown agent roles
- reject missing effective runtime config
- reject invalid or unsafe `base_url`

Additional async validation rules:

- job record must be written before worker can claim it
- uploaded input path must be durable before returning `201`
- job detail endpoints must continue to work after process restart

## Error Handling

### API Process

- invalid upload or invalid runtime config returns clear `4xx`
- database initialization problems return `5xx`
- job creation must fail atomically if durable job state cannot be created

### Worker

- worker exceptions mark job `failed`
- blocked execution marks job `blocked`
- process termination before terminal update is reconciled to `interrupted` on next startup

## File Boundaries

Backend likely needs:

- `backend/src/idea2thesis/db.py`
  - SQLite connection and schema helpers
- `backend/src/idea2thesis/job_store.py`
  - job create, claim, update, list, reconcile operations
- `backend/src/idea2thesis/worker.py`
  - independent worker loop entrypoint
- `backend/src/idea2thesis/services.py`
  - change `create_job` to durable enqueue semantics
- `backend/src/idea2thesis/api.py`
  - add `GET /jobs`
- `backend/src/idea2thesis/orchestrator.py`
  - optionally emit richer progress callbacks

## Testing

### Backend

- `POST /jobs` returns before long-running execution finishes
- worker claims and completes pending job
- `GET /jobs/{job_id}` reflects intermediate and terminal state from durable storage
- unfinished jobs are marked `interrupted` on restart reconciliation
- `GET /jobs` returns filterable durable job list
- runtime secrets never appear in list or detail responses

### Frontend

- current polling flow still works with async initial `pending` state
- `interrupted` state renders correctly
- current page can recover job state by polling durable backend state

## Recommended Scope Split

This spec intentionally stops at the async runtime foundation.

Follow-up spec should build on it for:

- full history workbench
- search and filters UI
- soft delete
- rerun
- event timeline UI
