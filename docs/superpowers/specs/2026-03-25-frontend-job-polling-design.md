# Frontend Job Polling Design Spec

## Overview

This change upgrades the existing `idea2thesis` frontend shell so the `Generate Project` button actually uploads a selected `.docx` brief to the backend, shows an in-progress generation state, and automatically refreshes job data until the backend reports a terminal outcome.

The goal is to keep the frontend lightweight while matching the current backend contract:

- `POST /jobs` returns a `JobSnapshot`
- `GET /jobs/{job_id}` returns the latest `JobSnapshot`

This feature does not yet send the model configuration fields to the backend. Those inputs remain present in the UI, but backend persistence of `API key`, `base URL`, and `model` is deferred to a later change.

## Goals

- Make the `Generate Project` button functional.
- Show clear `generating` UI state while work is in progress.
- Poll `GET /jobs/{job_id}` after job creation.
- Stop polling automatically once the job reaches a terminal state.
- Update all existing dashboard sections from live `JobSnapshot` data:
  - timeline
  - agent board
  - artifact list
  - validation report

## Non-Goals

- Persisting or submitting model settings to the backend.
- Introducing routing or a dedicated job details page.
- Converting the backend to a true async background job runner.
- Adding websocket or SSE transport.

## UX Flow

1. User selects a `.docx` file.
2. User clicks `Generate Project`.
3. Frontend validates that a file is present.
4. Button becomes disabled and the page enters `generating` state.
5. Frontend calls `POST /jobs`.
6. On success:
   - store returned `JobSnapshot`
   - extract `job_id`
   - start polling `GET /jobs/{job_id}`
7. Polling updates the dashboard sections from the latest snapshot.
8. Polling stops when `final_disposition` is one of:
   - `completed`
   - `failed`
   - `blocked`
9. If upload or polling fails, frontend shows an error message and exits loading state.

Request contract for v1:

- endpoint: `POST /jobs`
- content type: `multipart/form-data`
- file field name: `file`
- file value: selected `.docx` brief

## Frontend State Model

The frontend should keep a small explicit state model in `App.tsx`:

- `apiKey`, `baseUrl`, `model`
  - existing local input state
- `selectedFile`
  - current file input
- `snapshot`
  - latest `JobSnapshot`
- `isSubmitting`
  - true during initial upload
- `isPolling`
  - true while auto-refresh is active
- `errorMessage`
  - current request or validation error

Derived UI behavior:

- disable `Generate Project` while `isSubmitting` or `isPolling`
- show `generating...` or equivalent status text while active
- show error text when `errorMessage` is non-empty

## Polling Strategy

Use simple interval polling from the frontend.

Recommended v1 behavior:

- interval: 1500 ms to 2000 ms
- start polling only after a successful `POST /jobs`
- stop polling when:
  - terminal `final_disposition` is reached
  - request fails
  - component unmounts

Implementation should avoid duplicate timers. A single polling loop per active job is required.

If the initial `POST /jobs` response already has terminal `final_disposition` (`completed`, `failed`, or `blocked`), the frontend should render that snapshot immediately and skip creating the polling interval.

## Component Boundaries

Keep the change small and local:

- `frontend/src/api.ts`
  - add `fetchJob(jobId)`
- `frontend/src/App.tsx`
  - own upload action, polling lifecycle, and error/loading state
- `frontend/src/components/UploadForm.tsx`
  - accept disabled/loading props
  - render a button label that reflects active generation state
- existing display components
  - remain presentational and read from props only

No new routing layer is needed.

## Error Handling

The frontend must handle:

- no file selected
  - prevent request
  - show inline error
- failed upload request
  - stop loading
  - show upload error
- failed poll request
  - stop polling
  - show refresh error

Errors should not wipe the last known good `snapshot`.

## Testing

Required test coverage:

- clicking generate without a file shows validation error
- successful upload sets loading state and renders returned snapshot data
- polling fetches updated job snapshots
- polling stops once a terminal `final_disposition` is reached
- error state is shown when upload fails

Tests can mock `fetch` directly in the frontend suite.

## Acceptance Criteria

- `Generate Project` triggers a real `POST /jobs` request
- frontend renders returned job data
- frontend performs follow-up `GET /jobs/{job_id}` polling
- polling stops on terminal disposition
- frontend tests pass
- frontend production build still passes
