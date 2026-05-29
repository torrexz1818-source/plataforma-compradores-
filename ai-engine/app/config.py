from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field
import os

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", encoding="utf-8-sig")


class Settings(BaseModel):
    ai_provider: str = Field(default_factory=lambda: os.getenv("AI_PROVIDER", "anthropic").strip().lower())
    anthropic_api_key: str = Field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY", "").strip())
    anthropic_model: str = Field(default_factory=lambda: os.getenv("ANTHROPIC_MODEL", "").strip())
    anthropic_max_tokens: int = Field(
        default_factory=lambda: int(os.getenv("ANTHROPIC_MAX_TOKENS", "8192"))
    )
    anthropic_temperature: float = Field(
        default_factory=lambda: float(os.getenv("ANTHROPIC_TEMPERATURE", "0.2"))
    )
    anthropic_timeout_seconds: float = Field(
        default_factory=lambda: float(os.getenv("ANTHROPIC_TIMEOUT_SECONDS", "120"))
    )
    anthropic_max_retries: int = Field(
        default_factory=lambda: int(os.getenv("ANTHROPIC_MAX_RETRIES", "2"))
    )
    health_deep_timeout_seconds: float = Field(
        default_factory=lambda: float(os.getenv("HEALTH_DEEP_TIMEOUT_SECONDS", "8"))
    )
    max_files_per_analysis: int = Field(
        default_factory=lambda: int(os.getenv("MAX_FILES_PER_ANALYSIS", "5"))
    )
    max_file_size_mb: int = Field(default_factory=lambda: int(os.getenv("MAX_FILE_SIZE_MB", "10")))
    max_files_terms: int = Field(default_factory=lambda: int(os.getenv("MAX_FILES_TERMS", "8")))
    max_files_tco: int = Field(default_factory=lambda: int(os.getenv("MAX_FILES_TCO", "8")))
    max_files_dashboard: int = Field(default_factory=lambda: int(os.getenv("MAX_FILES_DASHBOARD", "8")))
    document_model_char_budget: int = Field(
        default_factory=lambda: int(os.getenv("DOCUMENT_MODEL_CHAR_BUDGET", "32000"))
    )
    total_document_model_char_budget: int = Field(
        default_factory=lambda: int(os.getenv("TOTAL_DOCUMENT_MODEL_CHAR_BUDGET", "90000"))
    )
    table_sample_rows: int = Field(default_factory=lambda: int(os.getenv("TABLE_SAMPLE_ROWS", "30")))
    delete_temp_files: bool = Field(
        default_factory=lambda: os.getenv("DELETE_TEMP_FILES", "true").lower() == "true"
    )
    store_uploads: bool = Field(
        default_factory=lambda: os.getenv("STORE_UPLOADS", "false").lower() == "true"
    )
    store_extracted_text: bool = Field(
        default_factory=lambda: os.getenv("STORE_EXTRACTED_TEXT", "false").lower() == "true"
    )
    google_cloud_project_id: str = Field(
        default_factory=lambda: os.getenv("GOOGLE_CLOUD_PROJECT_ID", "").strip()
    )
    google_pubsub_topic_dashboard_ready: str = Field(
        default_factory=lambda: os.getenv("GOOGLE_PUBSUB_TOPIC_DASHBOARD_READY", "").strip()
    )
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            origin.strip().rstrip("/")
            for origin in os.getenv(
                "CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173,https://buyernodus.com,https://www.buyernodus.com",
            ).split(",")
            if origin.strip()
        ]
    )
    temp_dir: Path = BASE_DIR / "temp"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.temp_dir.mkdir(parents=True, exist_ok=True)
    return settings
