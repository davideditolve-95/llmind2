"""
Router FastAPI per la gestione dei casi clinici DSM-5-TR.
Gestisce CRUD, paginazione e importazione da PDF.
"""

import math
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from ..database import get_db
from ..models.benchmark import DSM5Case
from ..schemas.benchmark import (
    DSM5CaseResponse,
    DSM5CaseUpdate,
    DSM5CaseSummary,
)

router = APIRouter(prefix="/api/cases", tags=["Cases"])


@router.get("", response_model=dict)
async def list_cases(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=5, le=100),
    search: Optional[str] = Query(default=None),
    reviewed_only: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    """
    Lista paginata dei casi clinici DSM-5-TR.
    Utilizzata dalla pagina /benchmark/cases.
    """
    query = db.query(DSM5Case)

    if reviewed_only:
        query = query.filter(DSM5Case.is_reviewed == True)

    if search:
        term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(DSM5Case.title).like(term),
                func.lower(DSM5Case.case_number).like(term),
                func.lower(DSM5Case.anamnesis).like(term),
            )
        )

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    items = (
        query.order_by(DSM5Case.case_number, DSM5Case.created_at)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    from ..models.benchmark import BenchmarkRun
    summaries = []
    for item in items:
        run_count = db.query(BenchmarkRun).filter(BenchmarkRun.case_id == item.id).count()
        # Anteprima: primi 200 caratteri dell'anamnesi
        preview = (item.anamnesis or "")[:200]
        summaries.append({
            "id": str(item.id),
            "case_number": item.case_number,
            "title": item.title,
            "is_reviewed": item.is_reviewed,
            "anamnesis_preview": preview,
            "source_page": item.source_page,
            "run_count": run_count,
            "created_at": item.created_at.isoformat(),
        })

    return {
        "items": summaries,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/{case_id}", response_model=DSM5CaseResponse)
async def get_case(
    case_id: UUID,
    db: Session = Depends(get_db),
):
    """Recupera il dettaglio completo di un caso clinico (incluse le 3 sezioni)."""
    case = db.query(DSM5Case).filter(DSM5Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Caso clinico non trovato")
    return case


@router.put("/{case_id}", response_model=DSM5CaseResponse)
async def update_case(
    case_id: UUID,
    update_data: DSM5CaseUpdate,
    db: Session = Depends(get_db),
):
    """
    Aggiorna i contenuti di un caso clinico.
    Usato per correggere manualmente l'estrazione PDF.
    """
    case = db.query(DSM5Case).filter(DSM5Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Caso clinico non trovato")

    # Aggiorna solo i campi forniti nel payload
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(case, field, value)

    db.commit()
    db.refresh(case)
    return case


@router.delete("/{case_id}")
async def delete_case(
    case_id: UUID,
    db: Session = Depends(get_db),
):
    """Elimina un caso clinico e tutti i suoi benchmark run associati."""
    case = db.query(DSM5Case).filter(DSM5Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Caso clinico non trovato")

    db.delete(case)
    db.commit()
    return {"deleted": True, "case_id": str(case_id)}


@router.get("/stats/summary")
async def get_cases_stats(db: Session = Depends(get_db)):
    """Statistiche sui casi nel database (per dashboard e header)."""
    total = db.query(DSM5Case).count()
    reviewed = db.query(DSM5Case).filter(DSM5Case.is_reviewed == True).count()
    return {
        "total_cases": total,
        "reviewed": reviewed,
        "pending_review": total - reviewed,
    }
