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

- enter a global `API Key`
- confirm or edit global `Base URL` and `Model`
- optionally open `Advanced Settings` and configure per-agent overrides
- select a `.docx` brief
- click `Generate Project`
- the UI sends a real `POST /jobs` request with the uploaded file plus runtime config JSON
- the backend returns a durable `pending` job immediately
- a separate local worker process claims and executes the job
- the dashboard then polls `GET /jobs/{job_id}` until the job reaches a terminal result

## History Workbench

The web app now includes a persistent history workbench:

- `GET /jobs` backs the left-side history list with search, status filter, and sort
- all jobs remain visible by default, including `deleted`
- selecting a row loads durable job detail plus the ordered event timeline
- only the currently selected active job is polled
- completed or retained jobs can export the generated `workspace/` as a ZIP from the detail panel

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

## Verification Evidence

Repository verification evidence is stored under `artifacts/verification/`.
