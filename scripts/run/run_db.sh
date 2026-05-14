#!/bin/bash
set -e

# Config
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${CHROMA_PORT:-8002}"
DB_PATH="$REPO_ROOT/chroma_db"

# Cleanup port 8002
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    PID=$(netstat -ano | grep ":$PORT" | grep "LISTENING" | awk '{print $5}' | head -n 1)
    [ -n "$PID" ] && taskkill //F //PID "$PID" 2>/dev/null || true
else
    lsof -ti :$PORT | xargs kill -9 2>/dev/null || true
fi

# Signal handling
cleanup() {
    echo -e "\nStopping ChromaDB..."
    trap - SIGINT SIGTERM EXIT
    kill 0 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

mkdir -p "$DB_PATH"
echo "------------------------------------------------"
echo "🚀 Starting ChromaDB Vector Store"
echo "📍 Path: $DB_PATH"
echo "🌐 Port: $PORT"
echo "📝 Log Level: ERROR (Quiet Mode)"
echo "------------------------------------------------"

# Use chroma CLI (ensure it's in path or in venv)
if [ -x "$REPO_ROOT/venv/bin/chroma" ]; then
    CHROMA_BIN="$REPO_ROOT/venv/bin/chroma"
elif [ -x "$REPO_ROOT/venv/Scripts/chroma.exe" ]; then
    CHROMA_BIN="$REPO_ROOT/venv/Scripts/chroma.exe"
else
    CHROMA_BIN="chroma"
fi

# Set RUST_LOG to error to suppress verbose Rust traces and cache misses
export RUST_LOG=error
exec $CHROMA_BIN run --host localhost --port "$PORT" --path "$DB_PATH"
