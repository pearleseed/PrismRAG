#!/bin/bash
# ============================================================
# PrismRAG — Local Development Setup
#   ./scripts/setup.sh                    — full install: venv/ (backend) + apps/open-webui/.venv/ (Open WebUI)
#   ./scripts/setup.sh --serve-open-webui — start Open WebUI (separate venv; avoids marker-pdf vs open-webui conflicts)
# ============================================================
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Icons
CHECK="✅"
INFO="ℹ️"
ERROR="❌"
ROCKET="🚀"
GEAR="⚙️"
DOCS="📄"
FOLDER="📁"
LINK="🔗"

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"


echo -e "${BLUE}${BOLD}============================================${NC}"
echo -e "${BLUE}${BOLD}      PrismRAG — Local Development Setup    ${NC}"
echo -e "${BLUE}${BOLD}============================================${NC}"
echo ""

# -----------------------------------------------------------
# 1. Check prerequisites
# -----------------------------------------------------------
echo -e "${YELLOW}${BOLD}[1/7] Checking prerequisites...${NC}"

# Python
if ! command -v python3 &>/dev/null; then
    echo -e "${RED}${ERROR} ERROR: python3 not found. Install Python 3.10+ first.${NC}"
    exit 1
fi
PY_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PY_MAJOR=$(echo "$PY_VERSION" | cut -d. -f1)
PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)
if [ "$PY_MAJOR" -lt 3 ] || ([ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]); then
    echo -e "${RED}${ERROR} ERROR: Python 3.10+ required (found $PY_VERSION)${NC}"
    exit 1
fi
echo -e "  ${GREEN}${CHECK}${NC} Python $PY_VERSION"

# uv
if ! command -v uv &>/dev/null; then
    echo -e "${RED}${ERROR} ERROR: uv not found. Install: https://github.com/astral-sh/uv${NC}"
    exit 1
fi
echo -e "  ${GREEN}${CHECK}${NC} uv $(uv --version | cut -d' ' -f2)"

# Node
if ! command -v node &>/dev/null; then
    echo -e "${RED}${ERROR} ERROR: node not found. Install Node.js 18+ first.${NC}"
    exit 1
fi
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo -e "${RED}${ERROR} ERROR: Node.js 18+ required (found $(node -v))${NC}"
    exit 1
fi
echo -e "  ${GREEN}${CHECK}${NC} Node $(node -v)"

# Bun
if ! command -v bun &>/dev/null; then
    echo -e "${RED}${ERROR} ERROR: bun not found. Install: https://bun.sh${NC}"
    exit 1
fi
echo -e "  ${GREEN}${CHECK}${NC} bun $(bun -v)"


echo ""

echo ""

# -----------------------------------------------------------
# 2. Create Python virtual environment
# -----------------------------------------------------------
echo -e "${YELLOW}${BOLD}[2/7] Setting up Python virtual environment (backend)...${NC}"
if [ ! -d "venv" ]; then
    # Prefer 3.12 / 3.11 for backend wheels (Docling, Marker, etc.).
    VENV_PY=""
    for ver in 3.12 3.11; do
        if uv venv venv --python "$ver" 2>/dev/null; then
            VENV_PY="$ver"
            echo -e "  ${GREEN}${CHECK}${NC} Created venv/ with Python ${ver} (uv)"
            break
        fi
        rm -rf venv
    done
    if [ -z "$VENV_PY" ]; then
        uv venv venv
        echo -e "  ${GREEN}${CHECK}${NC} Created venv/ with default Python (uv)"
        echo -e "  ${YELLOW}${INFO}${NC} If backend pip install fails, use Python 3.11–3.12: ${BOLD}uv python install 3.12${NC}, remove venv/, re-run ./setup.sh"
    fi
else
    echo -e "  ${BLUE}${INFO}${NC} venv/ already exists"
fi
source venv/bin/activate

# -----------------------------------------------------------
# 3. Install Python dependencies (two venvs: backend vs Open WebUI have incompatible pins, e.g. marker-pdf vs transformers)
# -----------------------------------------------------------
echo -e "${YELLOW}${BOLD}[3/7] Installing Python dependencies...${NC}"

echo -e "  ${BOLD}Backend${NC} → ${BLUE}venv/${NC} (PrismRAG API, Marker, Docling, …)"
echo -e "${BLUE}Running: uv pip install -r backend/requirements.txt${NC}"
uv pip install -r backend/requirements.txt
echo -e "  ${GREEN}${CHECK}${NC} Backend dependencies installed."

OW_DIR="$SCRIPT_DIR/apps/open-webui"
OW_VENV="$OW_DIR/.venv"
if [ ! -d "$OW_VENV" ]; then
    OW_PY=""
    for ver in 3.12 3.11; do
        if uv venv "$OW_VENV" --python "$ver" 2>/dev/null; then
            OW_PY="$ver"
            echo -e "  ${GREEN}${CHECK}${NC} Created ${BLUE}apps/open-webui/.venv/${NC} with Python ${ver}"
            break
        fi
        rm -rf "$OW_VENV"
    done
    if [ -z "$OW_PY" ]; then
        uv venv "$OW_VENV"
        echo -e "  ${GREEN}${CHECK}${NC} Created ${BLUE}apps/open-webui/.venv/${NC} with default Python"
        echo -e "  ${YELLOW}${INFO}${NC} If Open WebUI install fails, use Python 3.11–3.12: ${BOLD}uv python install 3.12${NC}, remove apps/open-webui/.venv/, re-run ./setup.sh"
    fi
else
    echo -e "  ${BLUE}${INFO}${NC} apps/open-webui/.venv/ already exists"
fi

echo -e "  ${BOLD}Open WebUI${NC} → ${BLUE}apps/open-webui/.venv/${NC} (PyPI open-webui only)"
echo -e "${BLUE}Running: uv pip install --python apps/open-webui/.venv/bin/python -r apps/open-webui/requirements.txt${NC}"
uv pip install --python "$OW_VENV/bin/python" -r "$OW_DIR/requirements.txt"
echo -e "  ${GREEN}${CHECK}${NC} Open WebUI dependencies installed."

# -----------------------------------------------------------
# 4. Create .env if not exists
# -----------------------------------------------------------
echo -e "${YELLOW}${BOLD}[4/7] Checking .env configuration...${NC}"
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "  ${GREEN}${CHECK}${NC} Created .env from .env.example"
    echo -e "  ${RED}${BOLD}>>> IMPORTANT: Edit .env and set GOOGLE_AI_API_KEY <<<${NC}"
else
    echo -e "  ${BLUE}${INFO}${NC} .env already exists"
fi

# -----------------------------------------------------------
# 5. Database services instructions
# -----------------------------------------------------------
echo -e "${YELLOW}${BOLD}[5/7] Database services...${NC}"
echo -e "  ${YELLOW}${INFO}${NC} Docker has been removed from this project."
echo -e "  ${BLUE}Ensure the following services are running locally:${NC}"
echo -e "  - ${BOLD}PostgreSQL 15+${NC} on port ${BOLD}5433${NC}"
echo -e "  - ${BOLD}ChromaDB${NC} on port ${BOLD}8002${NC}"
echo ""

# -----------------------------------------------------------
# 6. Download ML models (optional)
# -----------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[6/7] ML models (~2.5GB total):${NC}"
echo -e "  ${DOCS} BAAI/bge-m3 (embedding, ~1.4GB)"
echo -e "  ${DOCS} BAAI/bge-reranker-v2-m3 (reranker, ~1.1GB)"
echo ""
# Where sentence-transformers / Hugging Face Hub store downloaded weights
MODEL_CACHE_DIR=""
if [ -x "$SCRIPT_DIR/venv/bin/python" ]; then
    MODEL_CACHE_DIR="$("$SCRIPT_DIR/venv/bin/python" -c "from huggingface_hub import constants; print(constants.HF_HUB_CACHE)" 2>/dev/null || true)"
fi
if [ -z "$MODEL_CACHE_DIR" ]; then
    if [ -n "${HF_HUB_CACHE:-}" ]; then
        MODEL_CACHE_DIR="$HF_HUB_CACHE"
    elif [ -n "${HF_HOME:-}" ]; then
        MODEL_CACHE_DIR="${HF_HOME}/hub"
    else
        MODEL_CACHE_DIR="${HOME}/.cache/huggingface/hub"
    fi
fi
echo -e "  ${FOLDER} ${BOLD}Model cache (on disk):${NC}"
echo -e "      ${BLUE}${MODEL_CACHE_DIR}${NC}"
echo -e "  ${INFO} Override with ${BOLD}HF_HUB_CACHE${NC} or ${BOLD}HF_HOME${NC} (see Hugging Face Hub docs)."
echo ""

# --- Check which models are already cached ---
BGE_M3_DIR="${MODEL_CACHE_DIR}/models--BAAI--bge-m3"
BGE_RERANKER_DIR="${MODEL_CACHE_DIR}/models--BAAI--bge-reranker-v2-m3"
BGE_M3_CACHED=false
BGE_RERANKER_CACHED=false

if [ -d "$BGE_M3_DIR" ] && [ -n "$(ls -A "$BGE_M3_DIR" 2>/dev/null)" ]; then
    BGE_M3_CACHED=true
    echo -e "  ${GREEN}${CHECK}${NC} BAAI/bge-m3 — already cached."
else
    echo -e "  ${YELLOW}${INFO}${NC} BAAI/bge-m3 — not yet downloaded."
fi

if [ -d "$BGE_RERANKER_DIR" ] && [ -n "$(ls -A "$BGE_RERANKER_DIR" 2>/dev/null)" ]; then
    BGE_RERANKER_CACHED=true
    echo -e "  ${GREEN}${CHECK}${NC} BAAI/bge-reranker-v2-m3 — already cached."
else
    echo -e "  ${YELLOW}${INFO}${NC} BAAI/bge-reranker-v2-m3 — not yet downloaded."
fi

echo ""

if $BGE_M3_CACHED && $BGE_RERANKER_CACHED; then
    echo -e "  ${GREEN}${CHECK}${NC} All models already cached — skipping download."
else
    read -p "  Download missing models now? [y/N] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[yY]$ ]]; then
        echo -e "  ${BLUE}Downloading models (this may take a few minutes)...${NC}"
        python backend/scripts/download_models.py
        echo -e "  ${GREEN}${CHECK}${NC} Models downloaded."
        echo -e "  ${GREEN}${CHECK}${NC} Saved under: ${BLUE}${BOLD}${MODEL_CACHE_DIR}${NC}"
    else
        echo -e "  ${BLUE}${INFO}${NC} Skipped. Models will be downloaded on first use (same cache path as above)."
    fi
fi

# -----------------------------------------------------------
# 7. Install JS/TS workspace dependencies (frontend + mcp-server)
# -----------------------------------------------------------
echo -e "${YELLOW}${BOLD}[7/7] Installing workspace dependencies (Bun)...${NC}"
echo -e "${BLUE}Running: bun install${NC} (repo root — workspaces: frontend, mcp-server)"
bun install
echo -e "  ${GREEN}${CHECK}${NC} Workspace dependencies installed."

mkdir -p "$SCRIPT_DIR/apps/open-webui/data"

# -----------------------------------------------------------
# Done
# -----------------------------------------------------------
echo ""
echo -e "${BLUE}${BOLD}============================================${NC}"
echo -e "${GREEN}${BOLD}    ${ROCKET} Setup Complete! ${ROCKET}    ${NC}"
echo -e "${BLUE}${BOLD}============================================${NC}"
echo ""
echo -e "  ${GEAR}  Start backend:     ${BOLD}./scripts/run/run_bk.sh${NC}
  ${GEAR}  Start frontend:    ${BOLD}./scripts/run/run_fe.sh${NC}
  ${GEAR}  Open WebUI (opt): ${BOLD}./scripts/run/run_ow.sh${NC}
"
echo -e "  ${LINK}  Open:              ${BLUE}${BOLD}http://localhost:5174${NC}"
echo ""
echo -e ""
echo ""
