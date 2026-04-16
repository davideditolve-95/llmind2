"""
Schema Pydantic per il modulo chat.
Definisce i modelli per la comunicazione col chatbot ICD-11 / Well-being.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class ChatMessageRequest(BaseModel):
    """Richiesta di un nuovo messaggio al chatbot."""
    message: str = Field(..., min_length=1, max_length=10000)
    session_id: UUID = Field(...)
    # Modalità: "icd11" per ricerca diagnostica, "wellbeing" per analisi clinica
    mode: str = Field(default="icd11", pattern="^(icd11|wellbeing)$")
    # Modello Ollama da usare
    model_name: str = "gemma4"
    # Lingua della risposta desiderata
    language: str = Field(default="en", pattern="^(en|it)$")


class ChatMessageResponse(BaseModel):
    """Risposta a un messaggio dal chatbot."""
    id: UUID
    session_id: UUID
    role: str
    content: str
    mode: str
    model_name: Optional[str] = None
    icd11_codes_mentioned: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSessionResponse(BaseModel):
    """Informazioni di base su una sessione di chat."""
    id: UUID
    title: str
    mode: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChatSessionHistory(BaseModel):
    """Cronologia completa di una sessione di chat."""
    id: UUID
    title: str
    messages: List[ChatMessageResponse]
    mode: str


class AvailableModelsResponse(BaseModel):
    """Lista dei modelli Ollama disponibili."""
    models: List[str]
    default_model: str


class OllamaHealthResponse(BaseModel):
    """Stato di salute del servizio Ollama."""
    status: str
    base_url: str
    models_count: int
    latency_ms: int
    error: Optional[str] = None


class ChatTestRequest(BaseModel):
    """Richiesta di test inferenza (Playground)."""
    model_name: str
    prompt: str
    system_prompt: Optional[str] = None


class ChatTestResponse(BaseModel):
    """Risposta del test inferenza (Playground)."""
    content: str
    model: str
    latency_ms: int
    success: bool
    error: Optional[str] = None
