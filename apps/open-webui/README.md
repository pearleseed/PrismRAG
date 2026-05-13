# Open WebUI (alternative frontend)

This directory holds **local-only** data and a dedicated virtual environment for [Open WebUI](https://github.com/open-webui/open-webui). It does not replace the main Vite app in `/frontend`.

## Prerequisites

1. **PrismRAG backend** on `http://localhost:8080` (see project root `./run_bk.sh`).
2. **Repository setup** — from the repo root, run **`./setup.sh`** once. Step **[8/8]** creates **`apps/open-webui/.venv`** with **uv** (Python **3.12** or **3.11**; PyPI `open-webui` does not support 3.13+). If that step fails, run **`uv python install 3.12`** then **`./setup.sh`** again.

## Quick start

```bash
# From repository root — syncs deps with uv, then starts Open WebUI on :3000
./setup.sh --serve-open-webui
```

Open **`http://<your-LAN-IP>:3000`** (the script auto-detects your primary IPv4; override with `OPEN_WEBUI_PORT`). Set `OPEN_WEBUI_HOST=0.0.0.0` to listen on all interfaces, or `127.0.0.1` for localhost only.

From another device on your network, use `http://<this-machine-LAN-IP>:3000` (same port). The Open WebUI process still talks to PrismRAG at `OPENAI_API_BASE_URL` on the machine where it runs (default `http://127.0.0.1:8080/v1` is correct when the backend is local).

The command defaults `WEBUI_AUTH=false` for a friction-free first run on a fresh `data/webui.db`. Set `WEBUI_AUTH=true` before the first launch if you want enforced login.

In Open WebUI: **Admin → Settings → Connections** (or initial setup), set **OpenAI API**:

- **API URL**: `http://127.0.0.1:8080/v1`
- **API Key**: same as **`OPENAI_API_KEY`** when you start the server (default `sk-local-prismrag`), or set `PRISMRAG_OPENAI_COMPAT_API_KEY` in the PrismRAG `.env` and use that value here.

Pick a **model** named `prismrag-workspace-<id>` (they are listed from your knowledge bases). Each model maps to one workspace.

## Rollback

- Stop this process; nothing in the core backend or original frontend is removed.
- Optionally set `PRISMRAG_OPENAI_COMPAT_ENABLED=false` in the project `.env` to turn off `/v1` routes.

## Files

| Path | Purpose |
|------|---------|
| `requirements.txt` | Pins `open-webui` |
| `data/` | Local SQLite for Open WebUI (gitignored) |
| `.venv/` | Created by repo-root **`./setup.sh`** step **[8/8]** (gitignored) |
