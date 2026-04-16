"""
Schema Pydantic per ICD-11.
Definisce i modelli di validazione e serializzazione per l'API REST.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class ICD11CategoryBase(BaseModel):
    """Campi base di una categoria ICD-11."""
    code: Optional[str] = None
    title_en: str
    title_it: Optional[str] = None
    description: Optional[str] = None
    level: int = 0
    has_children: bool = False
    foundation_uri: Optional[str] = None


class ICD11CategoryCreate(ICD11CategoryBase):
    """Schema per la creazione di una nuova categoria (usato dagli script ETL)."""
    parent_id: Optional[UUID] = None
    linearization_uri: Optional[str] = None


class ICD11CategoryResponse(ICD11CategoryBase):
    """Schema per la risposta API — include id e timestamp."""
    id: UUID
    parent_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ICD11NodeTree(BaseModel):
    """Nodo dell'albero ICD-11 per la visualizzazione 3D (include figli)."""
    id: str
    code: Optional[str] = None
    label: str
    level: int
    has_children: bool
    parent_id: Optional[str] = None
    children: List["ICD11NodeTree"] = []

    class Config:
        from_attributes = True


# Risolve la referenza ciclica per i nodi annidati
ICD11NodeTree.model_rebuild()


class ICD11SearchResult(BaseModel):
    """Risultato di una ricerca full-text nell'ICD-11."""
    id: str
    code: Optional[str] = None
    title: str
    description: Optional[str] = None
    level: int
    score: float = 1.0  # Rilevanza del risultato (per ordinamento)


class ICD11TableRow(BaseModel):
    """Riga del data grid tabulare."""
    id: str
    code: Optional[str] = None
    title_en: str
    title_it: Optional[str] = None
    description: Optional[str] = None
    inclusions: Optional[List[str]] = None
    exclusions: Optional[List[str]] = None
    index_terms: Optional[List[str]] = None
    diagnostic_criteria: Optional[str] = None
    coding_notes: Optional[str] = None
    postcoordination_axes: Optional[List[str]] = None
    differential_diagnoses: Optional[List[str]] = None
    level: int
    has_children: bool
    children_count: int = 0

    class Config:
        from_attributes = True


class PaginatedICD11Response(BaseModel):
    """Risposta paginata per la vista tabulare."""
    items: List[ICD11TableRow]
    total: int
    page: int
    page_size: int
    total_pages: int
