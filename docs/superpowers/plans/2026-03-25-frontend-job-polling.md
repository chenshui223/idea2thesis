# Frontend Job Polling Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the frontend `Generate Project` button upload a `.docx` brief to the backend, show loading and error states, and poll job status until a terminal disposition is reached.

**Architecture:** Keep the change local to the existing frontend shell. `api.ts` owns HTTP helpers, `App.tsx` owns upload and polling lifecycle, and presentational components remain prop-driven. Tests mock `fetch` and verify upload, loading, polling, terminal stop, and error handling.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, browser `fetch`

---

## File Structure

- `frontend/src/api.ts`
  - add `fetchJob(jobId)` helper beside existing upload helper
- `frontend/src/App.tsx`
  - own `selectedFile`, `snapshot`, loading state, polling timer lifecycle, and error state
- `frontend/src/components/UploadForm.tsx`
  - accept disabled and loading-label props
- `frontend/src/App.test.tsx`
  - verify top-level shell still renders and upload state text appears
- `frontend/src/App.integration.test.tsx`
  - mock `fetch`, verify upload and polling lifecycle

## Chunk 1: Upload And Polling Flow

### Task 1: Add job-fetch API helper and upload contract coverage

**Files:**
- Modify: `frontend/src/api.ts`
- Create: `frontend/src/api.test.ts`
- Test: `frontend/src/api.test.ts`

- [ ] **Step 1: Write the failing API helper tests**

```tsx
import { fetchJob, uploadBrief } from "./api";

test("uploadBrief posts multipart form data with file field", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ job_id: "job-1" })
  });
  vi.stubGlobal("fetch", fetchMock);
  const file = new File(["demo"], "brief.docx");

  await uploadBrief(file);

  expect(fetchMock).toHaveBeenCalledWith(
    "/jobs",
    expect.objectContaining({ method: "POST" })
  );
});

test("fetchJob requests the matching job id", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ job_id: "job-1" })
  });
  vi.stubGlobal("fetch", fetchMock);

  await fetchJob("job-1");

  expect(fetchMock).toHaveBeenCalledWith("/jobs/job-1");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- src/api.test.ts`
Expected: FAIL because `fetchJob` test file or helper does not exist

- [ ] **Step 3: Implement minimal API helpers**

Implementation requirements:
- keep `uploadBrief(file)` using `multipart/form-data`
- append the file with the exact key `file`
- make `uploadBrief(file)` parse and return the initial `JobSnapshot` from `POST /jobs`
- add `fetchJob(jobId)` returning parsed `JobSnapshot`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- src/api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts frontend/src/api.test.ts
git commit -m "feat: add frontend job api helpers"
```

### Task 2: Implement upload state, polling lifecycle, and terminal stop behavior

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/UploadForm.tsx`
- Modify: `frontend/src/App.integration.test.tsx`
- Modify: `frontend/src/App.test.tsx`
- Test: `frontend/src/App.integration.test.tsx`
- Test: `frontend/src/App.test.tsx`

- [ ] **Step 1: Write the failing integration tests**

```tsx
test("shows validation error when no file is selected", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Generate Project" }));
  expect(screen.getByText("Please select a .docx brief first.")).toBeInTheDocument();
});

test("uploads file, shows generating state, and renders returned snapshot", async () => {
  vi.useFakeTimers();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        schema_version: "v1alpha1",
        job_id: "job-1",
        stage: "running",
        status: "running",
        agents: [{ role: "coder", status: "running", summary: "generating code" }],
        artifacts: [],
        validation_state: "running",
        final_disposition: "pending"
      })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        schema_version: "v1alpha1",
        job_id: "job-1",
        stage: "completed",
        status: "completed",
        agents: [{ role: "coder", status: "done", summary: "generated code" }],
        artifacts: [{ kind: "verification_report", path: "/tmp/report.json" }],
        validation_state: "completed",
        final_disposition: "completed"
      })
    });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  const file = new File(["demo"], "brief.docx");
  await userEvent.upload(screen.getByLabelText("Design Brief (.docx)"), file);
  await userEvent.click(screen.getByRole("button", { name: "Generate Project" }));

  expect(screen.getByText("Generating...")).toBeInTheDocument();

  await vi.advanceTimersByTimeAsync(2000);

  expect(screen.getByText("Current stage: completed")).toBeInTheDocument();
  expect(screen.getByText(/coder: done/i)).toBeInTheDocument();
  expect(screen.getByText(/verification_report: \/tmp\/report.json/i)).toBeInTheDocument();
  expect(screen.getByText("Validation state: completed")).toBeInTheDocument();
  expect(screen.getByText("Final disposition: completed")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- src/App.test.tsx src/App.integration.test.tsx`
Expected: FAIL because loading, error, and polling behavior are missing

- [ ] **Step 3: Implement frontend upload and polling**

Implementation requirements:
- validate file presence before request
- add `isSubmitting`, `isPolling`, and `errorMessage` state
- disable the button while active
- show `Generating...` while submitting or polling
- call `POST /jobs`
- render the initial `JobSnapshot` returned by `POST /jobs` immediately
- if returned `final_disposition` is terminal, render and stop
- otherwise start one polling interval using `GET /jobs/{job_id}`
- clear the interval on unmount
- stop polling on `completed`, `failed`, or `blocked`
- preserve the last known snapshot on poll failure and show an error
- ensure polling updates all live dashboard sections: timeline, agent board, artifact list, and validation report

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- src/App.test.tsx src/App.integration.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/UploadForm.tsx frontend/src/App.test.tsx frontend/src/App.integration.test.tsx
git commit -m "feat: add frontend upload polling flow"
```

### Task 3: Run frontend verification and update docs if needed

**Files:**
- Modify: `README.md`
- Test: `frontend/src`

- [ ] **Step 1: Run the full frontend suite**

Run: `cd frontend && npm run test`
Expected: PASS

- [ ] **Step 2: Run the frontend production build**

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 3: Update README if the user-facing flow changed materially**

Add a short note that selecting a `.docx` and clicking `Generate Project` now triggers a real backend request and auto-refreshes the job result.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: describe frontend upload flow"
```

Plan complete and saved to `docs/superpowers/plans/2026-03-25-frontend-job-polling.md`. Ready to execute?
