<div align="center">

# PrismRAG

### Hybrid Knowledge Base with Agentic Chat, Citations & Knowledge Graph

**Upload documents. Ask questions. Get cited answers.**

PrismRAG combines vector search, knowledge graph, and cross-encoder reranking into one seamless RAG pipeline — powered by Gemini, local Ollama, or fully offline sentence-transformers.

[Features](#features) · [Running & usage](#running--using-prismrag) · [Model recommendations](#multi-provider-llm) · [Tech stack](#tech-stack)

</div>

---

## Features

<details>
<summary><b>Deep Document Parsing (Docling / Marker)</b></summary>

PrismRAG supports two document parsers, switchable via `PRISMRAG_DOCUMENT_PARSER` env config:

| Feature | [Docling](https://github.com/docling-project/docling) (default) | [Marker](https://github.com/datalab-to/marker) |
|---|---|---|
| **Math/Formula** | Basic (known LaTeX issues) | Superior LaTeX via Surya |
| **GPU footprint** | ~18-20GB VRAM (formula enrichment) | ~2-4GB VRAM |
| **Formats** | PDF, DOCX, PPTX, HTML | PDF, DOCX, PPTX, XLSX, HTML, EPUB |
| **Chunking** | HybridChunker (semantic + structural) | Heading-aware + page-based |
| **Image extraction** | Via Docling pipeline | Via Marker pipeline |
| **Table extraction** | Structured export | Markdown tables |

Both parsers share the same output contract (`ParsedDocument`) — downstream pipeline (dedup, embedding, KG, retrieval) works identically regardless of parser choice.

**Common features across both parsers:**
- **Structural preservation** — Heading hierarchy, page boundaries, paragraph grouping
- **Multi-format** — PDF, DOCX, PPTX, TXT with consistent output
- **Page-aware metadata** — Every chunk carries its page number, heading path, and references to images/tables on the same page
- **LLM captioning** — Images and tables captioned by vision/text LLM for semantic search

```bash
# Switch parser in .env
PRISMRAG_DOCUMENT_PARSER=marker   # or "docling" (default)
```

</details>

<details open>
<summary><b>Hybrid Retrieval Pipeline</b></summary>

| Stage | Technology | Details |
|---|---|---|
| **Vector Embedding** | BAAI/bge-m3 | 1024-dim multilingual bi-encoder (100+ languages) |
| **KG Embedding** | Gemini / Ollama / sentence-transformers | Configurable: Gemini (3072d), Ollama, or local sentence-transformers (e.g. bge-m3 1024d) |
| **Vector Search** | ChromaDB | Cosine similarity, over-fetch top-20 candidates |
| **Knowledge Graph** | LightRAG | Entity/relationship extraction, keyword-to-entity matching |
| **Reranking** | BAAI/bge-reranker-v2-m3 | Cross-encoder joint scoring — encodes (query, chunk) pairs together |
| **Generation** | Gemini / Ollama | Agentic streaming chat with function calling |

**Retrieval flow:**
1. **Parallel retrieval** — Vector over-fetch (top-20) + KG entity lookup run simultaneously
2. **Cross-encoder reranking** — All 20 candidates scored jointly with the query through a transformer (far more precise than cosine similarity alone)
3. **Filtering** — Keep top-8 above relevance threshold (0.15), with fallback to top-3 if all below
4. **Media discovery** — Find images and tables on the same pages as retrieved chunks

</details>

<details>
<summary><b>Visual Document Intelligence</b></summary>

Images and tables are **embedded into chunk vectors** — not stored separately. When the parser extracts an image on page 5, its LLM-generated caption is appended to the text chunks on that page before embedding.

**Image Pipeline**
1. Parser (Docling or Marker) extracts images from PDF/DOCX/PPTX (up to 50 per document)
2. Vision LLM (Gemini Vision or Ollama multimodal) generates captions
3. Captions appended to page chunks: `[Image on page 5]: Graph showing 12% revenue growth YoY`
4. Chunk is embedded → **image becomes vector-searchable** through its description

**Table Pipeline**
1. Parser exports tables as structured Markdown
2. Text LLM summarizes each table
3. Summaries appended to page chunks
4. Table summaries injected back into document Markdown as blockquotes for the document viewer

</details>

<details>
<summary><b>Citation System</b></summary>

Every answer is grounded in source documents with **4-character citation IDs** (e.g., `[a3z1]`):

- **Inline citations** — Clickable badges embedded directly in the answer text
- **Source cards** — Each citation shows filename, page number, heading path, and relevance score
- **Cross-navigation** — Click a citation to jump to the exact section in the document viewer
- **Strict grounding** — The LLM is instructed to only cite sources that directly support claims

</details>

<details>
<summary><b>Knowledge Graph Visualization</b></summary>

Interactive force-directed graph built from extracted entities and relationships:

- **Entity types** — Person, Organization, Product, Location, Event, Technology, Financial Metric, Date, Regulation (configurable)
- **Force simulation** — Repulsion + spring forces + center gravity with real-time physics
- **Node interaction** — Click to select, hover to highlight connected edges, drag to reposition
- **No extra services** — LightRAG uses file-based storage (NetworkX + NanoVectorDB), zero overhead

</details>

<details open>
<summary><b>Multi-Provider LLM</b></summary>

Switch between cloud and local models with a single environment variable:

#### Gemini (Cloud)

| Model | Best For | Thinking |
|---|---|---|
| `gemini-2.5-flash` | General chat, fast responses | Budget-based (auto) |
| `gemini-3.1-flash-lite` | High throughput, cost-effective | Level-based: minimal / low / medium / high |

#### Ollama (Local / Self-hosted)

| Model | Parameters | Tool Calling | Recommendation |
|---|---|---|---|
| `gemma4:e4b` | 4.5B effective (8B total) | Native | **Recommended default** |
| `gemma4:e2b` | 2.3B effective (5.1B total) | Native | Ultra-lightweight |
| `qwen3.5:9b` | 9B | Native | Good multilingual support |

**Provider switching** — Comment/uncomment blocks in `.env`:

```bash
# Cloud (Gemini)
LLM_PROVIDER=gemini
GOOGLE_AI_API_KEY=your-key

# Local (Ollama)
# LLM_PROVIDER=ollama
# OLLAMA_MODEL=gemma4:e4b
```

</details>

---

## Tech Stack

<details>
<summary><b>Backend</b></summary>

| Technology | Purpose |
|---|---|
| **FastAPI** | Async web framework with SSE streaming |
| **SQLAlchemy 2.0** | Async ORM with PostgreSQL |
| **ChromaDB** | Vector store |
| **LightRAG** | Knowledge graph |
| **Docling / Marker** | Document parsing |
| **sentence-transformers** | Embeddings & Reranking |

</details>

<details>
<summary><b>Frontend</b></summary>

| Technology | Purpose |
|---|---|
| **React 19** + **TypeScript** | UI framework |
| **TailwindCSS 4** | Styling |
| **Zustand** | State management |
| **React Query** | Data fetching |
| **Framer Motion** | Animations |

</details>

---

## Running & using PrismRAG

This section describes **what to run**, in **what order**, and **how to use** the main UI, the optional Open WebUI layer, and related tools.

### Prerequisites

| Requirement | Notes |
|---|---|
| **Python 3.10+** | Used for the project `venv/` (backend). Checked by `./setup.sh`. |
| **[uv](https://github.com/astral-sh/uv)** | Creates the venv and installs Python dependencies. |
| **Node.js 18+** and **[Bun](https://bun.sh)** | Frontend installs and `bun dev` use Bun. |
| **PostgreSQL 15+** | Default in `.env.example`: `localhost:5433`, database `prismrag`. Adjust `DATABASE_URL` if your port or credentials differ. |
| **ChromaDB** | Default: `CHROMA_HOST=localhost`, `CHROMA_PORT=8002`. The backend expects a reachable Chroma server for vector search. |
| **LLM access** | **Gemini:** set `GOOGLE_AI_API_KEY` in `.env`. **Ollama:** set `LLM_PROVIDER=ollama` and run Ollama with your chosen model. |

### First-time setup

From the repository root:

```bash
./setup.sh
```

The script, in order: verifies **Python**, **uv**, **Node**, and **Bun**; creates **`venv/`** if missing; runs **`uv pip install -r backend/requirements.txt`**; copies **`.env.example` → `.env`** when no `.env` exists; reminds you to run **PostgreSQL** (port **5433**) and **ChromaDB** (port **8002**); optionally downloads **embedding/reranker** weights; runs **`bun install`** at the **repository root** (workspaces: **`frontend/`**, **`mcp-server/`**); then creates **`apps/open-webui/.venv`** with **`uv venv`** (Python **3.12** or **3.11**) and **`uv pip install`** for Open WebUI when that venv exists.

After setup, **edit `.env`** (at least `GOOGLE_AI_API_KEY` if you use Gemini, and `DATABASE_URL` if Postgres is not on `5433`).

### Configure environment

```bash
cp .env.example .env   # skip if ./setup.sh already created .env
```

Use **`.env.example`** as reference for parsers, LLM provider, CORS, and optional **OpenAI-compatible** settings (`PRISMRAG_OPENAI_COMPAT_*`, `PRISMRAG_BACKEND_PUBLIC_ORIGIN`) used by Open WebUI.

### What to run (local development)

Start **Postgres** and **Chroma** yourself (this repo does not ship Docker Compose for them). Then use **separate terminals** so logs stay readable.

| # | Component | Command | URL / endpoint | Purpose |
|---|------------|---------|----------------|----------|
| 1 | **Backend API** | `./run_bk.sh` | http://localhost:8080 | FastAPI: `/api/v1`, `/docs`, `/v1` (OpenAI compat), `/static/doc-images`, `/health` |
| 2 | **Main frontend** | `./run_fe.sh` | http://localhost:5174 | Primary React UI (Vite proxies `/api` and `/static` to the backend) |
| 3 | **Open WebUI** (optional) | `./setup.sh --serve-open-webui` | printed on start (primary IPv4, port 3000) | Requires **`./setup.sh`** (`apps/open-webui/.venv`). Binds your LAN IP by default, not `0.0.0.0`. Default `OPENAI_API_BASE_URL` is `http://127.0.0.1:8080/v1` (works with `./run_bk.sh` on `0.0.0.0`). |
| 4 | **MCP server** (optional) | From `mcp-server/`: build then run with HTTP transport | Default http://localhost:8000/mcp | Exposes tools for Cursor / Claude Desktop, etc. |

**Minimal daily flow:** terminal 1 → `./run_bk.sh` → wait until Uvicorn is listening → terminal 2 → `./run_fe.sh` → open **http://localhost:5174**.

### Using the main web UI (http://localhost:5174)

1. **Knowledge bases** — Open the app; use the sidebar or home flow to **list** and **create** workspaces (knowledge bases). Each workspace has its own documents, vectors, and graph.
2. **Open a workspace** — Select a workspace to enter the main RAG view: documents, chat, analytics, and graph depending on layout.
3. **Upload documents** — Upload **PDF, DOCX, PPTX, TXT**, etc. New files appear with a processing status until parsing, chunking, embedding, and optional KG steps finish.
4. **Indexing** — Wait until documents show as **indexed** (or use any **Analyze / Process** control the UI exposes for stuck or pending files). Large files or first-time model download can take several minutes.
5. **Chat** — Use the **chat** panel with the workspace selected. Answers use **retrieval + reranking** and stream over SSE. **Citations** (short IDs like `[a3z1]`) link back to sources; use the **document viewer** or side panels to jump to the cited section when the UI provides that navigation.
6. **Knowledge graph** — When PrismRAG KG is enabled and data exists, open the **graph** (or equivalent) view to explore entities and relationships extracted from that workspace’s documents.

The Vite dev server proxies API calls to **port 8080**, so you normally do **not** need to set `VITE_API_URL` unless you run the frontend against a remote backend.

### Optional: Open WebUI (http://localhost:3000)

Use this when you want a **second UI** (Open WebUI) for chat only, using the same RAG stack, **without** removing the Vite app.

1. Ensure the **backend is already running** on **8080**.
2. Ensure Open WebUI’s venv exists (**`./setup.sh`** from the repo root creates **`apps/open-webui/.venv`** with **uv** in step **[8/8]**). If that step failed, run **`uv python install 3.12`** then **`./setup.sh`** again.
3. Start the UI from the **repository root** (syncs Python deps with **uv**, then serves):

   ```bash
   ./setup.sh --serve-open-webui
   ```

4. In Open WebUI, under **Admin → Settings → Connections** (or the first-run connection wizard), configure the **OpenAI**-compatible connection:
   - **API URL:** `http://127.0.0.1:8080/v1`
   - **API key:** must match your setup — default script value is `sk-local-prismrag`, **unless** you set `PRISMRAG_OPENAI_COMPAT_API_KEY` in PrismRAG’s `.env`, in which case use that same value here.
5. **Pick a model** whose id looks like **`prismrag-workspace-<id>`** (each id is a knowledge base). You can confirm ids with `GET http://localhost:8080/v1/models` while the backend is running.

**Notes:** Open WebUI uses its **own** SQLite DB under `apps/open-webui/data/`. The script defaults `WEBUI_AUTH=false` for easy local first launch; set `WEBUI_AUTH=true` before the first start if you want accounts enforced. Prefer **disabling Open WebUI’s built-in RAG** for PrismRAG-backed models so retrieval stays in PrismRAG. More detail: [apps/open-webui/README.md](apps/open-webui/README.md).

### API reference and health checks

| Resource | URL |
|---|---|
| **Swagger UI** | http://localhost:8080/docs |
| **ReDoc** | http://localhost:8080/redoc |
| **Health** | http://localhost:8080/health |
| **Readiness** | http://localhost:8080/ready |

REST routes live under **`/api/v1`** (see table below). OpenAI-compatible routes for external UIs are under **`/v1`** (`/v1/models`, `/v1/chat/completions`).

### MCP server (optional)

The **`mcp-server/`** package exposes PrismRAG over MCP. For **HTTP** (e.g. `http://localhost:8000/mcp`), set `TRANSPORT=http` and optionally `PORT` when starting the compiled server. From the repo root, run **`bun run --filter mcp-server build`** (or **`cd mcp-server && bun run build`** after **`bun install`** at the root), then **`node mcp-server/dist/index.js`** with the appropriate env vars as implemented in **`mcp-server/src/index.ts`**.

### Troubleshooting

| Symptom | What to check |
|---|---|
| Backend exits on startup | **Postgres** running and **`DATABASE_URL`** correct; **Chroma** on `CHROMA_HOST`/`CHROMA_PORT`. |
| `venv` not found when running `./run_bk.sh` | Run **`./setup.sh`** first, or create `venv` manually and `uv pip install -r backend/requirements.txt`. |
| Frontend cannot reach API | Backend on **8080**; browser console for proxy errors; try **http://localhost:5174** (not only `127.0.0.1`) if cookies/CORS differ. |
| Open WebUI script says venv missing | Run **`./setup.sh`** from the repo root (step **[8/8]**). Or: **`uv python install 3.12`** then **`./setup.sh`**. |
| Open WebUI install fails | PyPI **`open-webui`** needs **Python 3.11 or 3.12** in `apps/open-webui/.venv`; the PrismRAG root `venv` may be 3.13 — that is expected. |
| Open WebUI “unauthorized” on chat | Align **`OPENAI_API_KEY`** (env when running `./setup.sh --serve-open-webui`) with **`PRISMRAG_OPENAI_COMPAT_API_KEY`** in `.env`, or leave both unset (default `sk-local-prismrag`). |

---

## Configuration

Copy `.env.example` and configure:

```bash
cp .env.example .env
```

### Key Settings

| Variable | Default | Description |
|---|---|---|
| `GOOGLE_AI_API_KEY` | - | Required for Gemini |
| `LLM_PROVIDER` | `gemini` | `gemini` or `ollama` |
| `PRISMRAG_DOCUMENT_PARSER` | `docling` | `docling` or `marker` |
| `KG_EMBEDDING_PROVIDER` | `gemini` | `gemini`, `ollama`, or `sentence_transformers` |


---

## MCP Server

PrismRAG includes an MCP server that exposes its core functionalities:
- `get_workspace_list`: List all knowledge bases.
- `get_document_by_id`: Get details for a specific document.
- `query`: Query indexed documents using semantic search.

Connect your MCP clients (Cursor, Claude Desktop, etc.) to:
`http://localhost:8000/mcp`

---

## API

- **REST (application):** prefix **`/api/v1`**. Interactive docs: http://localhost:8080/docs  
- **OpenAI-compatible (Open WebUI, scripts):** prefix **`/v1`** — `GET /v1/models`, `POST /v1/chat/completions` (same host and port as the main API).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/workspaces` | List all workspaces |
| `POST` | `/documents/upload/{workspace_id}` | Upload file |
| `POST` | `/rag/chat/{workspace_id}/stream` | Agentic streaming chat (SSE) |
| `GET` | `/rag/graph/{workspace_id}` | Knowledge graph data |
| `GET` | `/v1/models` | List models (`prismrag-workspace-<id>`) for Open WebUI |
| `POST` | `/v1/chat/completions` | Chat with a workspace via OpenAI-style payloads |

---

<div align="center">

MIT License &copy; 2026

</div>
