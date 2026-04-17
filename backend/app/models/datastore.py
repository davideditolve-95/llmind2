"""
Modello per la gestione dei Datastore personalizzati.
Consente agli utenti di caricare propri documenti e creare vector store dedicati.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON, Boolean
from sqlalchemy.dialects.postgresql import UUID
from ..database import Base

class Datastore(Base):
    __tablename__ = "datastores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    
    # Nome del modello di embedding/inferenza usato (es. llama3, gemma2)
    model_name = Column(String(50), nullable=False)
    
    # Percorso del file sorgente caricato (opzionale se è multi-file in futuro)
    source_file = Column(String(255), nullable=True)
    
    # Percorso della directory del Vector Store (Chroma)
    vector_path = Column(String(255), nullable=False)
    
    # Stato della creazione: "processing", "ready", "failed"
    status = Column(String(20), default="processing")
    error_message = Column(String(500), nullable=True)
    
    # Metadati aggiuntivi (numero chunk, dimensione documenti, etc)
    metadata_info = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
