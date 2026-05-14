#!/bin/bash
set -e

# Config
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${PRISMRAG_BACKEND_PORT:-8080}"
HOST="${PRISMRAG_BACKEND_HOST:-0.0.0.0}"
VENV="$REPO_ROOT/venv"

# Cleanup: kill processes on port
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash / MSYS)
    PID=$(netstat -ano | grep ":$PORT" | grep "LISTENING" | awk '{print $5}' | head -n 1)
    [ -n "$PID" ] && taskkill //F //PID "$PID" 2>/dev/null || true
else
    # Linux / Mac
    lsof -ti :$PORT | xargs kill -9 2>/dev/null || true
fi

cleanup() {
    echo -e "\nStopping backend..."
    trap - SIGINT SIGTERM EXIT
    kill 0 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Environment
if [ -d "$VENV/Scripts" ]; then
    # Windows venv
    PYTHON="$VENV/Scripts/python.exe"
    ACTIVATE="$VENV/Scripts/activate"
else
    # Unix venv
    PYTHON="$VENV/bin/python"
    ACTIVATE="$VENV/bin/activate"
fi

[ ! -x "$PYTHON" ] && echo "ERROR: venv not found. Run ./scripts/setup.sh" && exit 1
source "$ACTIVATE"
export PYTORCH_ENABLE_MPS_FALLBACK=1 UV_LOOP=uvloop

echo "🚀 Starting PrismRAG backend on http://${HOST}:${PORT} (MPS enabled)"

cd "$REPO_ROOT/backend"
python -m uvicorn app.main:app --reload --host "$HOST" --port "$PORT" --loop uvloop --http httptools
