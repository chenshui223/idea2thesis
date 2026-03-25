#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_VENV_DIR="$BACKEND_DIR/.venv"
BACKEND_PYTHON="${PYTHON_BIN:-python3}"
DRY_RUN=0

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

run_step() {
  local description="$1"
  shift
  echo "$description"
  echo "+ $*"
  if [[ "$DRY_RUN" == "1" ]]; then
    return 0
  fi
  "$@"
}

run_shell_step() {
  local description="$1"
  local command="$2"
  echo "$description"
  echo "+ $command"
  if [[ "$DRY_RUN" == "1" ]]; then
    return 0
  fi
  bash -lc "$command"
}

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

require_file "$BACKEND_DIR/pyproject.toml" "Missing backend project metadata."
require_file "$FRONTEND_DIR/package.json" "Missing frontend package metadata."
require_command "$BACKEND_PYTHON" "Missing python3. Install Python 3.12+ first."
require_command "npm" "Missing npm. Install Node.js 20+ first."

run_step "Creating backend virtual environment" \
  "$BACKEND_PYTHON" -m venv "$BACKEND_VENV_DIR"
run_shell_step "Installing backend dependencies" \
  "cd \"$BACKEND_DIR\" && .venv/bin/pip install -e \".[dev]\""
run_shell_step "Installing frontend dependencies" \
  "cd \"$FRONTEND_DIR\" && npm install"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "Dry run complete."
else
  echo "Bootstrap complete. Next run: bash scripts/dev.sh"
fi
