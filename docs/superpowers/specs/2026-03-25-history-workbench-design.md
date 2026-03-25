# History Workbench Design Spec

## Overview

This change upgrades `idea2thesis` from a single active-job screen to a persistent local workbench for browsing, inspecting, rerunning, and soft-deleting generated jobs.

The frontend will:

- render a persistent history list beside the active job detail view
- support search, status filtering, and sorting across all jobs
- show a fixed right-side detail panel for the selected job
- expose event history, artifacts, agent state, and core metadata
- allow rerunning a prior job with reused input and non-sensitive config
- allow soft deletion of terminal jobs

The backend will:

- expose event-stream, rerun, and soft-delete endpoints
- preserve all job records in SQLite, including deleted ones
- keep rerun behavior secret-safe by requiring fresh runtime API keys

Source of truth for v1:

- SQLite remains the source of truth for job lists, job detail, and event history
- filesystem workspaces remain the source of truth for uploaded briefs and generated artifacts
- runtime API keys remain ephemeral and never enter SQLite

## Goals

- Give local users a durable workbench for all historical jobs.
- Keep all jobs visible by default, including `deleted`.
- Make repeated iteration practical through rerun.
- Preserve detail visibility even after soft delete.
- Keep the main upload and polling experience intact.

## Non-Goals

- Physical deletion of workspaces or artifacts in v1.
- Undo or restore for deleted jobs in v1.
- Multi-user job ownership or permissions.
- Full text search over artifact contents.
- Separate routed pages for each job detail view.

## User Experience

### Layout

The application should present a two-pane workbench:

- left pane: job list, search, filters, sort controls
- right pane: selected job detail panel

On smaller screens the layout may stack vertically, but the interaction model remains:

- choose job from list
- inspect details without navigating away

### Default Behavior

1. Page loads.
2. Frontend fetches the job list from `GET /jobs`.
3. The most relevant row is selected by default:
   - first item in current sorted results
4. Right detail pane loads the selected job and its events.
5. If the selected job is still active, polling continues for that job.

### History Visibility

Default list behavior:

- show all jobs, including `deleted`
- allow filtering by status instead of hiding records by default

### Detail Panel

The right-side panel should display:

- brief title
- job id
- source job id if the job is a rerun
- status
- stage
- created / updated timestamps
- workspace path
- input file path
- agent statuses
- artifact list
- event timeline
- action buttons

### Rerun Flow

1. User selects an existing job.
2. User clicks `Rerun`.
3. Frontend loads the old job’s non-sensitive runtime config into the top settings form.
4. All API key fields remain blank.
5. User enters a fresh global API key and optionally agent-specific API keys.
6. Frontend calls `POST /jobs/{job_id}/rerun`.
7. Backend creates a new queued job linked to the prior one.
8. Frontend selects the new job and begins polling it.

### Delete Flow

1. User selects a terminal job.
2. User clicks `Delete`.
3. Backend marks the job as `deleted`.
4. The record remains visible in the list and in detail view.
5. Files are not physically removed in v1.

Delete eligibility in v1:

- allowed for `completed`
- allowed for `failed`
- allowed for `blocked`
- allowed for `interrupted`
- not allowed for `pending`
- not allowed for `running`

## Backend Data Model Changes

The async runtime foundation already provides the required base tables.

### `jobs`

Existing fields remain, but v1 history workbench needs:

- `status = deleted`
- optional `deleted_at`

The job must still retain:

- `source_job_id`
- `workspace_path`
- `input_file_path`

### `job_events`

Additional event kinds:

- `job_deleted`
- `job_rerun_created`

### `job_runtime_inputs`

This table remains the rerun-safe source for:

- `global_base_url`
- `global_model`
- non-sensitive per-agent settings

It must not store any API key material.

## API Changes

### `GET /jobs`

Expand current durable list behavior to support workbench queries:

- `status`
- `query`
- `limit`
- `offset`
- `sort`

Query should match:

- `brief_title`
- `job_id`

Sort options:

- `updated_desc`
- `created_desc`
- `created_asc`

All statuses, including `deleted`, are included by default.

### `GET /jobs/{job_id}`

Continue returning durable detail state, plus any metadata needed for the workbench detail panel:

- `source_job_id`
- `workspace_path`
- `input_file_path`
- `error_message` if present

Must not return runtime secrets.

### `GET /jobs/{job_id}/events`

Return ordered event timeline items for the selected job.

Each item should include:

- timestamp
- kind
- message
- payload

### `POST /jobs/{job_id}/rerun`

Accept:

- serialized runtime `config`
- no new uploaded file

Behavior:

1. verify source job exists
2. verify source job input file still exists
3. validate incoming runtime config
4. reuse the prior uploaded `.docx`
5. create a new queued job
6. set new job `source_job_id` to the original job id
7. emit `job_rerun_created` event

The new job gets a new `job_id`.

### `DELETE /jobs/{job_id}`

Behavior:

1. verify job exists
2. reject non-terminal jobs with `409`
3. set status to `deleted`
4. set `deleted_at`
5. append `job_deleted` event
6. keep all files intact

This is a soft delete only.

## Frontend Architecture

### `App.tsx`

Continues to own:

- top runtime settings form
- upload form
- active polling flow

Now also owns:

- history list query state
- selected job id
- current list filters and sort
- rerun bridge from selected job into top settings form

### New Components

- `HistoryList.tsx`
  - render search, filter, sort, and job rows
- `JobDetailPanel.tsx`
  - render selected job metadata, actions, artifacts, agent state, and events
- `JobEventTimeline.tsx`
  - render ordered event stream

## Interaction Rules

### Selection

- after list load, auto-select the first row if nothing is selected
- after rerun, auto-select the new job
- after delete, keep the deleted job selected until the user changes selection

### Polling

- only the selected active job is polled
- terminal jobs do not poll
- switching selection should stop polling the old job and, if needed, start polling the new active job

### Settings Integration For Rerun

Rerun should repopulate:

- global `Base URL`
- global `Model`
- per-agent `useGlobal`
- per-agent `Base URL`
- per-agent `Model`

Rerun must not repopulate:

- global `API Key`
- per-agent `API Key`

## Validation Rules

Frontend:

- rerun requires a fresh effective API key path for all required agents
- delete action only appears or is enabled for terminal jobs
- if rerun source config is missing, show a recoverable error

Backend:

- reject rerun if source job does not exist
- reject rerun if source input file is missing
- reject delete for non-terminal jobs with `409`
- never return API keys in any list, detail, event, or rerun preload response

## Error Handling

Frontend should show clear errors for:

- list load failure
- detail load failure
- events load failure
- rerun validation failure
- missing source input for rerun
- delete rejected because job is still active

Backend should return:

- `404` for missing jobs
- `409` for delete attempts on non-terminal jobs
- `422` for invalid rerun config

## Testing

### Backend

- list filtering and searching behave correctly
- events endpoint returns ordered durable events
- rerun creates a new queued job linked by `source_job_id`
- rerun fails when source input file is missing
- delete marks terminal jobs as `deleted`
- delete rejects non-terminal jobs

### Frontend

- list loads and auto-selects a row
- selecting a row updates the detail panel
- rerun repopulates non-sensitive settings only
- rerun starts polling the new job
- delete updates selected job state to `deleted`
- search and filters update the visible list correctly

## Recommended Scope

This spec is the next increment after async runtime foundation and should be implemented as a single history workbench feature set:

- backend endpoints
- frontend workbench UI
- rerun integration
- soft delete integration
