#!/bin/bash
set -e

# Config
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OW_DIR="$REPO_ROOT/apps/open-webui"
OW_VENV="$OW_DIR/.venv"
PORT="${OPEN_WEBUI_PORT:-3000}"

# Cleanup: kill processes on port
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    PID=$(netstat -ano | grep ":$PORT" | grep "LISTENING" | awk '{print $5}' | head -n 1)
    [ -n "$PID" ] && taskkill //F //PID "$PID" 2>/dev/null || true
else
    lsof -ti :$PORT | xargs kill -9 2>/dev/null || true
fi

# Check venv
if [ ! -d "$OW_VENV" ] || [ ! -x "$OW_VENV/bin/python" ]; then
    echo "ERROR: Open WebUI venv not found at $OW_VENV. Run ./scripts/setup.sh first."
    exit 1
fi

# Sync dependencies (optional but recommended for robustness)
if command -v uv &>/dev/null; then
    echo "Syncing Open WebUI dependencies with uv..."
    uv pip install --python "$OW_VENV/bin/python" -q -r "$OW_DIR/requirements.txt"
fi

# Environment
# shellcheck source=/dev/null
source "$OW_VENV/bin/activate"

mkdir -p "$OW_DIR/data"
ABS_DB="${OW_DIR}/data/webui.db"
export DATABASE_URL="${DATABASE_URL:-sqlite:////${ABS_DB}}"
export WEBUI_SECRET_KEY="${WEBUI_SECRET_KEY:-$("$OW_VENV/bin/python" -c 'import secrets; print(secrets.token_hex(24))')}"

# Detect IP
PRIMARY_IP="$("$OW_VENV/bin/python" -c 'import socket
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(0.5)
    s.connect(("8.8.8.8", 80))
    print(s.getsockname()[0])
    s.close()
except Exception:
    print("127.0.0.1")' 2>/dev/null || true)"
[ -z "$PRIMARY_IP" ] && PRIMARY_IP="127.0.0.1"

export OPENAI_API_BASE_URL="${OPENAI_API_BASE_URL:-http://127.0.0.1:8080/v1}"
export OPENAI_API_KEY="${OPENAI_API_KEY:-sk-local-prismrag}"
export ENABLE_OLLAMA_API="${ENABLE_OLLAMA_API:-false}"
export WEBUI_AUTH="${WEBUI_AUTH:-false}"

# Host selection
if [ -n "${OPEN_WEBUI_HOST+x}" ]; then
    BIND_HOST="${OPEN_WEBUI_HOST}"
    [ -z "$BIND_HOST" ] && BIND_HOST="127.0.0.1"
else
    BIND_HOST="$PRIMARY_IP"
fi

echo "🚀 Starting Open WebUI on http://${BIND_HOST}:${PORT}"
echo "   Bridge: ${OPENAI_API_BASE_URL}"

cd "$OW_DIR"
exec open-webui serve --host "$BIND_HOST" --port "$PORT"
