from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
from pathlib import Path

# Find .env file - check project root first, fallback for Docker
_candidate = Path(__file__).resolve().parent.parent.parent.parent / ".env"
ENV_FILE = str(_candidate) if _candidate.exists() else ".env"


class Settings(BaseSettings):
    # App
    APP_NAME: str = "PrismRAG"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # Base directory (backend folder)
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5433/prismrag"
    )

    # LLM Provider: "gemini" | "ollama"
    LLM_PROVIDER: str = Field(default="gemini")

    # Google AI
    GOOGLE_AI_API_KEY: str = Field(default="")

    # Ollama
    OLLAMA_HOST: str = Field(default="http://localhost:11434")
    OLLAMA_MODEL: str = Field(default="gemma3:12b")
    OLLAMA_ENABLE_THINKING: bool = Field(default=False)

    # LLM (fast model for chat + KG extraction — used when provider=gemini)
    LLM_MODEL_FAST: str = Field(default="gemini-2.5-flash")

    # Thinking level for Gemini 3.x+ models: "minimal" | "low" | "medium" | "high"
    # Gemini 2.5 uses thinking_budget_tokens instead (auto-detected)
    LLM_THINKING_LEVEL: str = Field(default="medium")

    # Max output tokens for LLM chat responses (includes thinking tokens)
    # Gemini 3.1 Flash-Lite supports up to 65536
    LLM_MAX_OUTPUT_TOKENS: int = Field(default=8192)

    # KG Embedding provider (can differ from LLM provider)
    KG_EMBEDDING_PROVIDER: str = Field(default="gemini")
    KG_EMBEDDING_MODEL: str = Field(default="gemini-embedding-001")
    KG_EMBEDDING_DIMENSION: int = Field(default=3072)

    # ChromaDB
    CHROMA_HOST: str = Field(default="localhost")
    CHROMA_PORT: int = Field(default=8002)

    # PrismRAG Pipeline
    PRISMRAG_ENABLED: bool = True
    PRISMRAG_ENABLE_KG: bool = True
    PRISMRAG_ENABLE_IMAGE_EXTRACTION: bool = True
    PRISMRAG_ENABLE_IMAGE_CAPTIONING: bool = True
    PRISMRAG_ENABLE_TABLE_CAPTIONING: bool = True
    PRISMRAG_MAX_TABLE_MARKDOWN_CHARS: int = 8000
    PRISMRAG_CHUNK_MAX_TOKENS: int = 512
    PRISMRAG_KG_QUERY_TIMEOUT: float = 30.0
    PRISMRAG_KG_CHUNK_TOKEN_SIZE: int = 1200
    PRISMRAG_KG_LANGUAGE: str = "English"
    PRISMRAG_KG_ENTITY_TYPES: list[str] = [
        "Organization",
        "Person",
        "Product",
        "Location",
        "Event",
        "Financial_Metric",
        "Technology",
        "Date",
        "Regulation",
    ]
    PRISMRAG_DEFAULT_QUERY_MODE: str = "hybrid"
    PRISMRAG_DOCLING_IMAGES_SCALE: float = 2.0
    PRISMRAG_MAX_IMAGES_PER_DOC: int = 50
    PRISMRAG_ENABLE_FORMULA_ENRICHMENT: bool = True

    # Document Parser provider: "docling" (default) or "marker" (lighter, better math)
    PRISMRAG_DOCUMENT_PARSER: str = "docling"
    PRISMRAG_MARKER_USE_LLM: bool = False

    # Processing timeout (minutes) — stale documents auto-recover to FAILED
    PRISMRAG_PROCESSING_TIMEOUT_MINUTES: int = 10

    # Pre-ingestion Deduplication
    PRISMRAG_DEDUP_ENABLED: bool = True
    PRISMRAG_DEDUP_MIN_CHUNK_LENGTH: int = 50  # min meaningful chars
    PRISMRAG_DEDUP_NEAR_THRESHOLD: float = 0.85  # Jaccard similarity cutoff

    # PrismRAG Retrieval Quality
    PRISMRAG_EMBEDDING_MODEL: str = "BAAI/bge-m3"
    PRISMRAG_RERANKER_MODEL: str = "BAAI/bge-reranker-v2-m3"
    PRISMRAG_VECTOR_PREFETCH: int = 20
    PRISMRAG_RERANKER_TOP_K: int = 8
    PRISMRAG_MIN_RELEVANCE_SCORE: float = 0.15

    # CORS (include Open WebUI default dev port and Vite)
    CORS_ORIGINS: list[str] = [
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # OpenAI-compatible /v1 API (for Open WebUI and other OpenAI clients)
    PRISMRAG_OPENAI_COMPAT_ENABLED: bool = True
    PRISMRAG_OPENAI_COMPAT_API_KEY: str = ""
    # Browser origin of the PrismRAG API — used to rewrite /static/ links in chat
    PRISMRAG_BACKEND_PUBLIC_ORIGIN: str = "http://localhost:8080"

    model_config = {
        "env_file": str(ENV_FILE),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
