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
    ollama_default_model: str = "gemma3:270m"
    ollama_api_key: str = ""

    # Sicurezza
    secret_key: str = "cambia_questa_chiave_in_produzione"
    environment: str = "development"

    # Embedding model locale
    embedding_model: str = "all-MiniLM-L6-v2"

    # GCP Conversational Agents / Dialogflow CX
    gcp_project_id: str = ""
    gcp_location: str = "eu"
    gcp_dialogflow_agent_id: str = ""
    gcp_dialogflow_environment_id: str = ""
    gcp_dialogflow_agent_map: str = ""
    gcp_dialogflow_api_endpoint: str = "https://dialogflow.googleapis.com"
    gcp_credentials_file: str = ""
    gcp_agents_language_code: str = "en"
    gcp_agents_timeout_seconds: float = 30.0

    # Keycloak OIDC Config
    # Mappa KEYCLOAK_ISSUER (senza _URL per compatibilità con NextAuth/docker-compose)
    keycloak_issuer: str = ""
    keycloak_client_id: str = ""
    keycloak_client_secret: str = ""
    # JWKS URL è derivato dall'issuer: <issuer>/protocol/openid-connect/certs
    # Può essere sovrascritto esplicitamente con KEYCLOAK_JWKS_URL
    keycloak_jwks_url: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Restituisce le impostazioni con cache (singleton)."""
    return Settings()
