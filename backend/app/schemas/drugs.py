"""
Schemi Pydantic per la validazione e la serializzazione dei farmaci AIFA.
"""

from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class AIFADrugResponse(BaseModel):
    """Schema per la risposta di un singolo farmaco AIFA."""
    id: UUID
    active_ingredient: str
    atc_code: Optional[str] = None
    aic_code: str
    commercial_name: str
    packaging: Optional[str] = None
    manufacturer: Optional[str] = None
    price: Optional[float] = None
    category_class: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaginatedDrugsResponse(BaseModel):
    """Schema per la risposta paginata di farmaci AIFA."""
    items: List[AIFADrugResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class DrugIndicationMappingResponse(BaseModel):
    """Schema per il mapping tra farmaco (RxNorm) ed indicazione (ICD-10)."""
    id: UUID
    rxcui: Optional[str] = None
    drug_name: str
    icd10_code: str
    indication_desc: Optional[str] = None
    is_consensus: bool
    created_at: datetime

    class Config:
        from_attributes = True
