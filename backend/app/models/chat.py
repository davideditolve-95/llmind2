"""
Modello SQLAlchemy per la cronologia delle chat.
Gestisce i messaggi del chatbot ICD-11 e del modulo Well-being.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..database import Base


class ChatSession(Base):
    """
    Rappresenta una sessione di chat persistente.
    Permette di raggruppare i messaggi e assegnare un titolo alla conversazione.
    """
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Titolo della sessione (es. "Consulto per Caso 1.2" o i primi caratteri del primo messaggio)
    title = Column(String(200), nullable=False, default="Nuova Conversazione")
    
    # Modalità: "icd11" o "wellbeing"
    mode = Column(String(20), default="icd11", nullable=False)
    
    # Indica se la sessione è visibile nella cronologia
    is_active = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relazione con i messaggi
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at")

    def __repr__(self):
        return f"<ChatSession title={self.title!r} mode={self.mode!r}>"


class ChatMessage(Base):
    """
    Singolo messaggio nella cronologia della chat.
    Supporta due modalità: ricerca ICD-11 e analisi clinica Well-being.
    """
    __tablename__ = "chat_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Identificativo della sessione di chat (FK verso ChatSession)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)

    # Ruolo del mittente: "user" o "assistant"
    role = Column(String(20), nullable=False)

    # Contenuto del messaggio
    content = Column(Text, nullable=False)

    # Modalità di chat: "icd11" o "wellbeing" (ridondante ma utile per query dirette)
    mode = Column(String(20), default="icd11", nullable=False)

    # Modello utilizzato per generare la risposta (solo per role="assistant")
    model_name = Column(String(100), nullable=True)

    # Codici ICD-11 rilevanti menzionati nella risposta (JSON array come stringa)
    icd11_codes_mentioned = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relazione con la sessione
    session = relationship("ChatSession", back_populates="messages")

    def __repr__(self):
        return f"<ChatMessage role={self.role!r} session={self.session_id!r} mode={self.mode!r}>"
