"""
Schema Pydantic per il modulo di benchmarking.
Definisce i modelli di validazione per casi DSM-5-TR e run di inferenza.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime


# ─── DSM-5 Cases ──────────────────────────────────────────────────────────

class DSM5CaseBase(BaseModel):
    """Campi base di un caso clinico DSM-5-TR."""
    case_number: Optional[str] = None
    title: str
    anamnesis: str = ""
    discussion: str = ""
    gold_standard_diagnosis: str = ""
    source_page: Optional[int] = None
    is_reviewed: bool = False
    review_notes: Optional[str] = None
    icd11_tags: Optional[str] = None


class DSM5CaseCreate(DSM5CaseBase):
    """Schema per la creazione (usato dallo script ETL)."""
    pass


class DSM5CaseUpdate(BaseModel):
    """Schema per l'aggiornamento manuale di un caso (editing da UI)."""
    title: Optional[str] = None
    anamnesis: Optional[str] = None
    discussion: Optional[str] = None
    gold_standard_diagnosis: Optional[str] = None
    is_reviewed: Optional[bool] = None
    review_notes: Optional[str] = None
    icd11_tags: Optional[str] = None


class DSM5CaseResponse(DSM5CaseBase):
    """Schema per la risposta API — include id e timestamp."""
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DSM5CaseSummary(BaseModel):
    """Riepilogo del caso (per liste e grid UI — senza testo completo)."""
    id: UUID
    case_number: Optional[str] = None
    title: str
    is_reviewed: bool
    anamnesis_preview: str = ""  # Primo paragrafo dell'anamnesi
    source_page: Optional[int] = None
    run_count: int = 0  # Numero di benchmark run associati
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Benchmark Runs ────────────────────────────────────────────────────────

class BenchmarkRunRequest(BaseModel):
    """Richiesta per avviare esecuzioni batch di benchmarking."""
    case_ids: List[UUID] = Field(..., min_length=1)
    model_names: List[str] = Field(..., min_length=1)
    include_discussion: bool = False
    prompt_language: str = "en"


class BenchmarkRunCreate(BaseModel):
    """Dati per creare un singolo run (uso interno)."""
    case_id: UUID
    model_name: str
    prompt_used: str
    include_discussion: bool = False
    prompt_language: str = "en"


class ManualEvaluationCreate(BaseModel):
    """Schema per creare una nuova valutazione manuale nominale."""
    evaluator_name: str = Field(..., min_length=1, max_length=100)
    rating: int = Field(..., ge=1, le=5)
    notes: Optional[str] = None


class ManualEvaluationResponse(BaseModel):
    """Schema di risposta per una valutazione manuale."""
    id: UUID
    run_id: UUID
    evaluator_name: str
    rating: int
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BenchmarkRunResponse(BaseModel):
    """Schema completo di risposta per un benchmark run."""
    id: UUID
    case_id: UUID
    model_name: str
    batch_id: Optional[UUID] = None
    prompt_used: str
    system_prompt_used: Optional[str] = None
    llm_response: Optional[str] = None
    similarity_score: Optional[float] = None
    llm_judge_score: Optional[float] = None
    latency_ms: Optional[int] = None
    include_discussion: bool
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    # Valutazioni manuali associate multiple
    evaluations: List[ManualEvaluationResponse] = []

    # Dati del caso associato (embedded per comodità nella UI)
    case_title: Optional[str] = None
    gold_standard_diagnosis: Optional[str] = None

    class Config:
        from_attributes = True


# ─── KPI Dashboard ────────────────────────────────────────────────────────

class ModelKPI(BaseModel):
    """KPI aggregati per un singolo modello."""
    model_name: str
    total_runs: int
    avg_similarity: Optional[float] = None
    avg_latency_ms: Optional[float] = None
    avg_human_rating: Optional[float] = None
    rated_runs: int = 0


class BenchmarkKPIResponse(BaseModel):
    """Risposta della dashboard KPI con tutte le statistiche aggregate."""
    total_cases: int
    total_runs: int
    reviewed_cases: int
    models_tested: List[str]
    model_kpis: List[ModelKPI]
    # Serie temporali per i grafici
    similarity_over_time: List[dict] = []
    rating_distribution: List[dict] = []
