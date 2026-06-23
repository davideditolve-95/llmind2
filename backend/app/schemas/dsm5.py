from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class DSM5CategoryBase(BaseModel):
    code: str
    title: str
    chapter: str
    parent_category: Optional[str] = None
    variant_label: Optional[str] = None
    severity: Optional[str] = None
    sort_order: Optional[int] = None
    diagnostic_criteria: Optional[str] = None
    diagnostic_features: Optional[str] = None
    prevalence: Optional[str] = None
    development_and_course: Optional[str] = None
    risk_and_prognostic_factors: Optional[str] = None
    culture_related_issues: Optional[str] = None
    sex_gender_related_issues: Optional[str] = None
    functional_consequences: Optional[str] = None
    differential_diagnosis: Optional[str] = None
    comorbidity: Optional[str] = None
    icd10_code: Optional[str] = None
    icd11_code: Optional[str] = None


class DSM5CategoryCreate(DSM5CategoryBase):
    pass


class DSM5CategoryResponse(DSM5CategoryBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DSM5CategoryCompare(BaseModel):
    dsm5: DSM5CategoryResponse
    icd11: Optional[dict] = None  # Contiene informazioni sul nodo ICD-11
