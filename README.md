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

Optional environment check:

```bash
bash scripts/dev.sh --check
```

## Local Jobs

Generated jobs are stored under `jobs/<job-id>/`.

Each job includes:

- uploaded input under `input/`
- parsed brief snapshots under `parsed/`
- generated workspace under `workspace/`
- generated artifacts under `artifacts/`
- logs under `logs/`

## Frontend Upload Flow

In the current frontend:

- select a `.docx` brief
- click `Generate Project`
- the UI sends a real `POST /jobs` request
- the dashboard then polls `GET /jobs/{job_id}` until the job reaches a terminal result

## Verification Evidence

Repository verification evidence is stored under `artifacts/verification/`.
