<div align="center">

# 🔮 PrismRAG

### Hybrid Knowledge Base with Agentic Chat, Citations & Knowledge Graph

**Upload documents → Ask questions → Get cited answers.**

PrismRAG combines **vector search**, **knowledge graph**, and **cross-encoder reranking** into one seamless RAG pipeline — powered by Gemini, local Ollama, or fully offline sentence-transformers.

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-async-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Beginner's Guide](#-beginners-zero-to-hero-guide) · [Features](#-features) · [LLM Models](#-multi-provider-llm) · [Tech Stack](#-tech-stack) · [Running Services](#-running-services) · [Configuration](#-configuration) · [API Reference](#-api-reference) · [MCP Server](#-mcp-server)

</div>

---

## 🌟 Beginner's Zero-to-Hero Guide

This section is for users who want to get PrismRAG running locally without using Docker. Follow these steps exactly.

### 📋 1. Prerequisites (Install these first)
Before starting, download and install these tools on your computer:
*   **[Python 3.12+](https://www.python.org/downloads/)**: The language that runs the backend.
*   **[Node.js 18+](https://nodejs.org/)**: Required for the frontend.
*   **[PostgreSQL 15+](https://www.postgresql.org/download/)**: The main database. 
    *   *Mac users:* [Postgres.app](https://postgresapp.com/) is highly recommended for simplicity.
*   **[Bun](https://bun.sh/)**: A fast tool to run the frontend (Install via terminal: `curl -fsSL https://bun.sh/install | bash`).
*   **[uv](https://github.com/astral-sh/uv)**: A fast Python package manager (Install via terminal: `curl -LsSf https://astral.sh/uv/install.sh | sh`).
*   **[FFmpeg](https://ffmpeg.org/download.html)**: Required for **Audio & Video** processing (transcription).

### 🗄️ 2. Database Setup
1.  **PostgreSQL**: 
    *   Open your PostgreSQL tool (like pgAdmin or Postgres.app).
    *   Create a new database named **`prismrag`**.
    *   Ensure it is running on the default port (usually **5432** or **5433** as set in your `.env`).
2.  **ChromaDB**: This will be run locally within the project folder using a script in Step 5.

### ⚙️ 3. Automatic Setup
Run the setup script from the project root to install all dependencies and create your configuration:

```bash
./scripts/setup.sh
```
*Wait for it to finish. If it asks to download models (BAAI/bge-m3), type `y`.*

### 🛠️ 4. Configure Your Settings
1.  Open the file named **`.env`** in the project root with a text editor.
2.  **API Key**: Find `GOOGLE_AI_API_KEY` and paste your key from [Google AI Studio](https://aistudio.google.com/apikey).
3.  **Database**: Find `DATABASE_URL`. Ensure the port matches your local PostgreSQL (usually `5432` or `5433`).
    *   *Example:* `postgresql+asyncpg://postgres:postgres@localhost:5433/prismrag`

### 🚀 5. Initializing & Running
Run these commands in separate terminal windows:

**Terminal 1: Start ChromaDB (Vector Search)**
```bash
./scripts/run/run_db.sh
```

**Terminal 2: Initialize Database (One-time only)**
```bash
source venv/bin/activate
alembic -c backend/alembic.ini upgrade head
```

**Terminal 3: Start the Backend API**
```bash
./scripts/run/run_bk.sh
```

**Terminal 4: Start the Frontend UI**
```bash
./scripts/run/run_fe.sh
```

**Visit http://localhost:5174 to start using PrismRAG!** 🎈

---

## ✨ Features

### 📄 Deep Document Parsing
PrismRAG supports two document parsers, switchable via `PRISMRAG_DOCUMENT_PARSER`:

| Feature | [Docling](https://github.com/docling-project/docling) *(default)* | [Marker](https://github.com/datalab-to/marker) |
|---|---|---|
| **Math / Formula** | Basic (known LaTeX issues) | Superior LaTeX via Surya |
| **GPU Footprint** | ~18–20 GB VRAM (formula enrichment) | ~2–4 GB VRAM |
| **Formats** | PDF, DOCX, PPTX, XLSX, HTML, MD, CSV, XML, LaTeX, Images, Audio, Video | PDF, DOCX, PPTX, XLSX, HTML, EPUB |
| **ASR / Transcription** | ✅ Audio & Video (via Whisper Turbo) | ❌ No |
| **Chunking** | HybridChunker (semantic + structural) | Heading-aware + page-based |
| **Image Extraction** | Via Docling pipeline (OCR support) | Via Marker pipeline |
| **Table Extraction** | Structured export / Markdown | Markdown tables |

**Common features across both parsers:**
- 🏗️ **Structural preservation** — Heading hierarchy, page boundaries, paragraph grouping.
- 🏷️ **Page-aware metadata** — Every chunk carries its page number, heading path, and references to images/tables on the same page.
- 🖼️ **Visual/Audio Intelligence** — Images captioned by vision LLM; Audio/Video transcribed by ASR pipeline.

---

### 🔍 Hybrid Retrieval Pipeline

| Stage | Technology | Details |
|---|---|---|
| **Vector Embedding** | BAAI/bge-m3 | 1024-dim multilingual bi-encoder (100+ languages) |
| **KG Embedding** | Gemini / Ollama / ST | Configurable: Gemini (3072d) or local bge-m3 (1024d) |
| **Vector Search** | ChromaDB | Cosine similarity, over-fetch top-20 candidates |
| **Knowledge Graph** | LightRAG | Entity/relationship extraction, keyword-to-entity matching |
| **Reranking** | BAAI/bge-reranker-v2-m3 | Cross-encoder joint scoring for extreme precision |
| **Generation** | Gemini / Ollama | Agentic streaming chat with function calling |

**Retrieval flow:**
1. **Parallel retrieval** — Vector over-fetch (top-20) + KG entity lookup run simultaneously.
2. **Cross-encoder reranking** — All candidates scored jointly with the query through a transformer.
3. **Filtering** — Keep top-8 above relevance threshold (0.15), with fallback to top-3 if all below.
4. **Media discovery** — Automatically find images and tables on the same pages as retrieved text.

---

### 🎬 Multimedia Document Intelligence
PrismRAG embeds images, tables, and audio/video into the same search index.

**Image & Table Pipeline**
1. **Extraction** — Parser extracts images (OCR enabled) and tables.
2. **Captioning/Summarization** — Vision LLM generates captions for images; Text LLM summarizes tables.
3. **Contextual Injection** — Captions/summaries are appended to page chunks: `[Image on page 5]: Graph showing 12% revenue growth YoY`.

**Audio & Video Pipeline (Docling only)**
1. **Extraction** — Video audio is automatically extracted via **FFmpeg**.
2. **Transcription** — Whisper Turbo generates a structured transcript with timestamps.
3. **Chunking** — Transcripts are chunked for semantic retrieval.

---

### 🔗 Citation System & Knowledge Graph
*   **Grounding**: Every claim is backed by a clickable `[a3z1]` citation badge.
*   **Source Cards**: Click any citation to see the exact page, heading path, and relevance score.
*   **Visual KG**: Interactive force-directed graph exploring entities (People, Orgs, Metrics) and relationships.
*   **Entity types**: Person, Organization, Product, Location, Event, Technology, Financial Metric, Date, Regulation.

---

## 🤖 Multi-Provider LLM

Switch between cloud and local models with a single environment variable in `.env`.

#### ☁️ Gemini (Cloud)
| Model | Best For | Thinking |
|---|---|---|
| `gemini-2.5-flash` | General chat, fast responses | Budget-based (auto) |
| `gemini-3.1-flash-lite` | High throughput, cost-effective | Configurable levels |

#### 🖥️ Ollama (Local / Self-hosted)
| Model | Parameters | Tool Calling | Recommendation |
|---|---|---|---|
| `gemma4:e4b` | 4.5B effective | ✅ Native | ⭐ **Recommended default** |
| `gemma4:e2b` | 2.3B effective | ✅ Native | Ultra-lightweight |
| `qwen3.5:9b` | 9B | ✅ Native | Good multilingual support |

---

## 🏗️ Tech Stack

<details>
<summary><b>Backend (Python/FastAPI)</b></summary>

| Technology | Purpose |
|---|---|
| **FastAPI** | Async web framework with SSE streaming |
| **SQLAlchemy 2.0** | Async ORM with PostgreSQL |
| **ChromaDB** | High-performance vector store |
| **LightRAG** | Knowledge graph framework |
| **Docling / Marker** | Industrial-grade document parsers |
| **sentence-transformers**| Embeddings & Reranking |

</details>

<details>
<summary><b>Frontend (React/TypeScript)</b></summary>

| Technology | Purpose |
|---|---|
| **React 19** | Latest UI library |
| **TailwindCSS 4** | Modern utility-first styling |
| **Zustand** | Lightweight state management |
| **React Query** | Data fetching & caching |
| **Framer Motion** | Smooth, premium animations |

</details>

---

## 🖥️ Running Services

Start **Postgres** and **Chroma** first, then run these in separate terminals:

| # | Component | Command | URL | Purpose |
|---|---|---|---|---|
| 1 | **Backend API** | `./scripts/run/run_bk.sh` | http://localhost:8080 | FastAPI API, Swagger Docs, OpenAI compat |
| 2 | **Main Frontend** | `./scripts/run/run_fe.sh` | http://localhost:5174 | Primary React User Interface |
| 3 | **Open WebUI** | `./scripts/run/run_ow.sh` | http://localhost:3000 | Optional: Alternative Chat UI |
| 4 | **MCP Server** | From `mcp-server/`: build/run | http://localhost:8000/mcp | Tools for Cursor / Claude Desktop |

---

## 📤 Processing Options

### 1. Web Frontend (Easiest)
Select a workspace → Click **Upload** → Drop your files. Supports PDF, DOCX, PNG, JPG, MP3, MP4, etc.

### 2. CLI Ingestion (Bulk & Automation)
For bulk uploads, use the provided script:
```bash
./scripts/dev/ingest.py -w 1 ./my_documents_folder --recursive
```

### 3. MCP Server (AI IDEs)
Expose PrismRAG as a tool for **Cursor** or **Claude Desktop**:
```bash
bun run --filter mcp-server build
node mcp-server/dist/index.js
```
*Connect to:* `http://localhost:8000/mcp`

### 💡 Which tool should I use?

| Scenario | Recommended Tool | Why? |
|---|---|---|
| "I just want to chat with 1-2 PDFs" | **Web Frontend** | Easiest UI, visual feedback. |
| "I have a folder with 500 research papers" | **CLI Script** | Automatic batching & folder support. |
| "I'm coding in Cursor and need my docs" | **MCP Server** | Integrated directly into the AI IDE. |
| "I'm building a mobile app for this" | **REST API** | Standard integration method. |

---

## ⚙️ Configuration

Copy `.env.example` to `.env` and adjust key settings:

| Variable | Default | Description |
|---|---|---|
| `GOOGLE_AI_API_KEY` | — | Required for Gemini models |
| `LLM_PROVIDER` | `gemini` | `gemini` or `ollama` |
| `PRISMRAG_DOCUMENT_PARSER` | `docling` | `docling` or `marker` |
| `KG_EMBEDDING_PROVIDER` | `gemini` | `gemini`, `ollama`, or `sentence_transformers` |
| `DATABASE_URL` | `...` | PostgreSQL connection string |

---

## 📡 API Reference

*   **Swagger UI**: [http://localhost:8080/docs](http://localhost:8080/docs)
*   **OpenAI Compatible**: [http://localhost:8080/v1](http://localhost:8080/v1)
*   **Health**: [http://localhost:8080/health](http://localhost:8080/health)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/documents/upload/{id}` | Upload file to workspace |
| `POST` | `/api/v1/rag/chat/{id}/stream` | Stream RAG chat with citations |
| `GET` | `/api/v1/rag/graph/{id}` | Fetch KG visualization data |
| `GET` | `/v1/models` | List models for Open WebUI |

---

## 🔌 MCP Server

Exposes core functionality to AI clients (Cursor, Claude Desktop, etc.):

| Tool | Description |
|---|---|
| `get_workspace_list` | List all knowledge bases |
| `get_document_by_id` | Get details for a specific document |
| `query` | Query indexed documents using semantic search |

**Setup:**
```bash
# From repo root
bun run --filter mcp-server build
node mcp-server/dist/index.js
```
Connect to: `http://localhost:8000/mcp`

---

## ❓ Troubleshooting

| Symptom | Fix |
|---|---|
| **Database Connection Error** | Ensure local PostgreSQL is running and database `prismrag` exists. |
| **"Module not found"** | Ensure you ran `./scripts/setup.sh` and are using `venv`. |
| **Processing Stuck** | Check backend logs. Ensure your LLM API Key is valid. |
| **Frontend blank page** | Run `bun install` in the root and ensure `run_fe.sh` is active. |
| **Backend exits on startup** | Check **Postgres** and **Chroma** host/port in `.env`. |

---

<div align="center">
MIT License &copy; 2026 · Built with 💜 for Multimodal RAG
</div>
