"""
Schemi Pydantic per la validazione delle richieste e risposte per la gestione dei Pazienti.
"""

from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class PatientBase(BaseModel):
    """Campi di base per la definizione di un Paziente."""
    name: str = Field(..., min_length=1, max_length=200, description="Nome e cognome del paziente")
    age: Optional[int] = Field(default=None, ge=0, le=150, description="Età del paziente")
    gender: Optional[str] = Field(default=None, max_length=50, description="Genere del paziente")
    behaviors: Optional[str] = Field(default=None, description="Sintomatologia e comportamenti osservati")
    specific_traits: Optional[str] = Field(default=None, description="Tratti specifici e di personalità")
    clinical_history: Optional[str] = Field(default=None, description="Anamnesi e storia clinica pregressa")


class PatientCreate(PatientBase):
    """Schema per la creazione di un nuovo paziente."""
    pass


class PatientUpdate(BaseModel):
    """Schema per l'aggiornamento parziale di un paziente."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    age: Optional[int] = Field(default=None, ge=0, le=150)
    gender: Optional[str] = Field(default=None, max_length=50)
    behaviors: Optional[str] = None
    specific_traits: Optional[str] = None
    clinical_history: Optional[str] = None


class PatientResponse(PatientBase):
    """Schema per la risposta completa del paziente, includendo metadati del DB."""
    id: UUID
    owner_email: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
