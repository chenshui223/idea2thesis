# idea2thesis

`idea2thesis` is a local single-user web application that turns a `.docx` graduation thesis design brief into:

- a generated project workspace
- repository documents
- a thesis first draft
- local verification evidence

## Requirements

- Python 3.12+
- Node.js 20+
- an OpenAI-compatible endpoint

## Environment Variables

Backend configuration uses:

- `IDEA2THESIS_API_KEY`
- `IDEA2THESIS_BASE_URL`
- `IDEA2THESIS_MODEL`
- `IDEA2THESIS_ORGANIZATION` (optional)

The web app now supports two configuration layers:

- global `API Key`, `Base URL`, and `Model`
- optional per-agent overrides behind `Advanced Settings`

Persistence rules:

- `API Key` is runtime-only and is never persisted
- `Base URL` and `Model` are persisted
- per-agent override `use_global`, `Base URL`, and `Model` are persisted
- persisted non-sensitive settings are written by the backend to a local JSON file and restored on reload

## Backend Setup

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
pytest -v
uvicorn idea2thesis.main:app --reload
```

## Frontend Setup

```bash
cd frontend
npm install
npm run test
npm run build
npm run dev
```

## One-Command Bootstrap

To install both backend and frontend dependencies in one step:

```bash
bash scripts/bootstrap.sh
```

To preview the commands without installing anything:

```bash
bash scripts/bootstrap.sh --dry-run
```

## Start Both Services

After backend and frontend dependencies are installed, start both services with one command:

```bash
bash scripts/dev.sh
```

This starts:

- the FastAPI backend
- the local async worker process
- the Vite frontend

Optional environment check:

```bash
bash scripts/dev.sh --check
```

## Local Jobs

Generated jobs are stored under `jobs/<job-id>/`.

Local runtime state is stored under `.idea2thesis/`.

This includes:

- `jobs.db` for the async job store
- machine-local secret material used to hand runtime API keys to the worker

These files are local-only and should not be committed.

Each job includes:

- uploaded input under `input/`
- parsed brief snapshots under `parsed/`
- generated workspace under `workspace/`
- generated artifacts under `artifacts/`
- logs under `logs/`

## Frontend Upload Flow

In the current frontend:

- optionally click `Download Sample Brief` to get a ready-to-run `.docx` example
- enter a global `API Key`
- confirm or edit global `Base URL` and `Model`
- optionally open `Advanced Settings` and configure per-agent overrides
- select a `.docx` brief
- click `Generate Project`
- the UI sends a real `POST /jobs` request with the uploaded file plus runtime config JSON
- the backend returns a durable `pending` job immediately
- a separate local worker process claims and executes the job
- the dashboard then polls `GET /jobs/{job_id}` until the job reaches a terminal result

## Execution Pipeline

Each accepted brief runs through a fixed local multi-agent execution chain:

- `advisor` analyzes the brief and writes the delivery plan
- `coder` generates the runnable scaffold and implementation notes
- `writer` generates repository docs, a thesis draft markdown file, and a thesis draft `.docx`
- `requirements_reviewer`, `engineering_reviewer`, and `delivery_reviewer` evaluate delivery readiness
- `code_eval` runs a local verification command inside the generated workspace
- `doc_check` checks required thesis sections and basic scope consistency

The current execution model is single-pass and deterministic:

- there is no automatic multi-round repair loop yet
- the final job manifest records `repair_performed: false`
- blocked outputs are kept for manual inspection and rerun

Terminal outcomes mean:

- `completed`: verification and document checks both passed
- `failed`: local code verification failed
- `blocked`: deliverables were generated, but reviewer or document checks require manual repair

## History Workbench

The web app now includes a persistent history workbench:

- `GET /jobs` backs the left-side history list with search, status filter, and sort
- all jobs remain visible by default, including `deleted`
- selecting a row loads durable job detail plus the ordered event timeline
- only the currently selected active job is polled
- polling refreshes the selected job detail, event timeline, and left-side history summary together
- the detail view surfaces agent summaries, artifact lists, validation state, and repair guidance
- completed or retained jobs can export the generated `workspace/` as a ZIP from the detail panel
- when there are no jobs yet, the history panel shows first-run guidance with the recommended startup steps

### Rerun

Rerun reuses:

- the original uploaded `.docx`
- persisted non-sensitive runtime settings such as `Base URL`, `Model`, and per-agent override switches

Rerun does not reuse:

- global `API Key`
- per-agent `API Key`

Users must enter a fresh runtime API key before rerunning a job.

### Delete

Delete is soft delete only:

- only terminal jobs can be deleted
- deleting a job changes its durable status to `deleted`
- deleted jobs remain visible in the history list and detail panel
- workspaces, artifacts, and uploaded files are kept on disk in v1

### Workspace Export

The detail panel can download a `workspace` ZIP bundle for a selected job.

The ZIP intentionally excludes internal runtime directories such as:

- `workspace/.git/`
- `workspace/.idea2thesis-logs/`

## Artifact Layout

Each job writes durable artifacts under `jobs/<job-id>/artifacts/`:

- `agent/advisor/advisor_plan.json`
- `agent/coder/implementation_plan.md`
- `agent/coder/code_summary.json`
- `agent/writer/thesis_draft.md`
- `agent/writer/thesis_draft.docx`
- `agent/writer/design_report.md`
- `agent/review/requirements_review.json`
- `agent/review/engineering_review.json`
- `agent/review/delivery_review.json`
- `verification/code_eval.json`
- `verification/doc_check.json`
- `final/job_manifest.json`

The generated repository workspace stays under `jobs/<job-id>/workspace/`, while uploaded inputs and parsed brief snapshots remain under `input/` and `parsed/`.

## Verification Evidence

Repository verification evidence is stored under `artifacts/verification/`.

The final job manifest under `artifacts/final/job_manifest.json` summarizes:

- final disposition
- stage-by-stage agent results
- durable artifact paths used by the history workbench

Runtime API keys are not written into persisted runtime settings, durable artifacts, or the final manifest.
