"""
Configurazione centralizzata dell'applicazione FastAPI.
Legge le variabili d'ambiente tramite Pydantic Settings.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Impostazioni dell'applicazione caricate da variabili d'ambiente."""

    # Database PostgreSQL
    database_url: str = "postgresql://llmind_user:llmind_pass_dev@db:5432/llmind_db"

    # ICD-11 API container offline
    icd11_api_url: str = "http://icd11-api"
    icd11_client_id: str = ""
    icd11_client_secret: str = ""

    # Ollama — ESTERNO al cluster Docker
    ollama_base_url: str = "http://localhost:11434"
    ollama_default_model: str = "gemma4"

    # Sicurezza
    secret_key: str = "cambia_questa_chiave_in_produzione"
    environment: str = "development"

    # Embedding model locale
    embedding_model: str = "all-MiniLM-L6-v2"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Restituisce le impostazioni con cache (singleton)."""
    return Settings()
