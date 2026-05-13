#!/bin/bash
# PrismRAG frontend — Vite dev server (Bun workspace: prismrag-frontend)
# Default URL: http://localhost:5174 (port set in frontend/vite.config.ts)
# Requires: bun install at repo root (./setup.sh step [7/7] or bun install)
set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

if ! command -v bun &>/dev/null; then
    echo "ERROR: bun not found. Install: https://bun.sh"
    echo "  Then from repo root: ./setup.sh   or   bun install"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "Installing workspace dependencies (Bun workspaces: frontend, mcp-server)..."
    bun install
fi

echo "Starting PrismRAG frontend (Vite) — LAN-friendly (host: all interfaces, port 5174)"
echo "  Open on this machine: http://localhost:5174"
echo "  From another device:   http://<this-computer-LAN-IP>:5174"
echo "  API proxy target:      \${VITE_DEV_PROXY_TARGET:-http://127.0.0.1:8080} (see frontend/.env.example)"
exec bun run --filter prismrag-frontend dev
