# 🌐 Open WebUI — Alternative Frontend

This directory holds **local-only** data and a dedicated virtual environment for [Open WebUI](https://github.com/open-webui/open-webui). It does **not** replace the main Vite app in `/frontend` — both can run simultaneously.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **PrismRAG backend** | Must be running on `http://localhost:8080` (see root `./run_bk.sh`) |
| **Repository setup** | Run `./setup.sh` once from the repo root. Step **[8/8]** creates `apps/open-webui/.venv` via **uv** with Python **3.12** or **3.11** *(PyPI `open-webui` does not support Python 3.13+)* |

> **If step [8/8] fails:** run `uv python install 3.12` then `./setup.sh` again.

---

## Quick Start

```bash
# From repository root — syncs deps with uv, then starts Open WebUI on :3000
./setup.sh --serve-open-webui
```

Open **`http://<your-LAN-IP>:3000`** in your browser *(the script auto-detects your primary IPv4)*.

**Host / port options:**

| Env Variable | Value | Effect |
|---|---|---|
| `OPEN_WEBUI_PORT` | e.g. `3001` | Override the default port `3000` |
| `OPEN_WEBUI_HOST` | `0.0.0.0` | Listen on all network interfaces |
| `OPEN_WEBUI_HOST` | `127.0.0.1` | Localhost only |

From another device on your network, use `http://<this-machine-LAN-IP>:3000`. The Open WebUI process talks to PrismRAG at `OPENAI_API_BASE_URL` on the machine where it runs — the default `http://127.0.0.1:8080/v1` is correct when the backend is local.

> **Auth:** Defaults to `WEBUI_AUTH=false` for a friction-free first run. Set `WEBUI_AUTH=true` **before** the first launch if you want enforced login.

---

## Connecting to PrismRAG

In Open WebUI, go to **Admin → Settings → Connections** (or the initial setup wizard) and configure the **OpenAI API**:

| Field | Value |
|---|---|
| **API URL** | `http://127.0.0.1:8080/v1` |
| **API Key** | Same as `OPENAI_API_KEY` when starting the server *(default: `sk-local-prismrag`)*, or whatever you set as `PRISMRAG_OPENAI_COMPAT_API_KEY` in the PrismRAG `.env` |

Pick a **model** named `prismrag-workspace-<id>` — each maps to one of your knowledge bases.

---

## Rollback

- Stop the Open WebUI process — nothing in the core backend or original frontend is affected.
- Optionally set `PRISMRAG_OPENAI_COMPAT_ENABLED=false` in the project `.env` to disable the `/v1` routes entirely.

---

## Directory Structure

| Path | Purpose |
|---|---|
| `requirements.txt` | Pins the `open-webui` package version |
| `data/` | Local SQLite database for Open WebUI *(gitignored)* |
| `.venv/` | Python venv created by `./setup.sh` step **[8/8]** *(gitignored)* |
