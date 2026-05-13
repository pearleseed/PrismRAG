#!/bin/bash
# PrismRAG backend — FastAPI via Uvicorn (default port 8080, all interfaces for LAN dev)
# Requires: repo-root venv from ./setup.sh (backend)
set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV="$REPO_ROOT/venv"
BACKEND_DIR="$REPO_ROOT/backend"
PORT="${PRISMRAG_BACKEND_PORT:-8080}"
HOST="${PRISMRAG_BACKEND_HOST:-0.0.0.0}"

cd "$BACKEND_DIR"

if [ ! -d "$VENV" ] || [ ! -x "$VENV/bin/python" ]; then
    echo "ERROR: Python venv not found at ${VENV}"
    echo "  Run from repo root: ./setup.sh"
    exit 1
fi

# shellcheck source=/dev/null
source "$VENV/bin/activate"

echo "Starting PrismRAG backend on http://${HOST}:${PORT}"
echo "  To bind localhost only: PRISMRAG_BACKEND_HOST=127.0.0.1 $0"
exec python -m uvicorn app.main:app --reload --host "$HOST" --port "$PORT"
