#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# Signal handling
cleanup() {
    echo -e "\nStopping frontend..."
    trap - SIGINT SIGTERM EXIT
    kill 0 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Prerequisites
! command -v bun &>/dev/null && echo "ERROR: bun required" && exit 1
[ ! -d "node_modules" ] && echo "Installing deps..." && bun install

echo "🚀 Starting PrismRAG frontend on http://localhost:5174"
bun run --filter prismrag-frontend dev
