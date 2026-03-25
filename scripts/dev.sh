#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_PYTHON="$BACKEND_DIR/.venv/bin/python"

require_file() {
  local path="$1"
  local message="$2"
  if [[ ! -e "$path" ]]; then
    echo "$message" >&2
    exit 1
  fi
}

require_command() {
  local command_name="$1"
  local message="$2"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "$message" >&2
    exit 1
  fi
}

check_environment() {
  require_file "$BACKEND_DIR/pyproject.toml" "Missing backend project metadata."
  require_file "$FRONTEND_DIR/package.json" "Missing frontend package metadata."
  require_file "$BACKEND_PYTHON" "Missing backend virtual environment. Run bash scripts/bootstrap.sh first."
  require_command "npm" "Missing npm. Install Node.js 20+ first."
}

if [[ "${1:-}" == "--check" ]]; then
  check_environment
  echo "Environment check passed."
  exit 0
fi

check_environment

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${WORKER_PID:-}" ]]; then
    kill "$WORKER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

(
  cd "$BACKEND_DIR"
  exec "$BACKEND_PYTHON" -m uvicorn idea2thesis.main:app --reload --host 127.0.0.1 --port "$BACKEND_PORT"
) &
BACKEND_PID=$!

(
  cd "$BACKEND_DIR"
  exec "$BACKEND_PYTHON" -m idea2thesis.worker
) &
WORKER_PID=$!

(
  cd "$FRONTEND_DIR"
  exec npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT"
) &
FRONTEND_PID=$!

echo "Backend:  http://127.0.0.1:$BACKEND_PORT"
echo "Worker:   background process started"
echo "Frontend: http://127.0.0.1:$FRONTEND_PORT"
echo "Press Ctrl+C to stop all services."

wait "$BACKEND_PID" "$WORKER_PID" "$FRONTEND_PID"
