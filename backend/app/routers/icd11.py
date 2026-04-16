"""
Router FastAPI per l'API ICD-11.
Espone endpoint per l'albero gerarchico, la ricerca e la vista tabulare.
"""

import math
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from ..database import get_db
from ..models.icd11 import ICD11Category
from ..schemas.icd11 import (
    ICD11NodeTree,
    ICD11TableRow,
    PaginatedICD11Response,
    ICD11SearchResult,
)

router = APIRouter(prefix="/api/icd11", tags=["ICD-11"])


@router.get("/tree", response_model=list[ICD11NodeTree])
async def get_icd11_tree(
    level: int = Query(default=3, ge=1, le=10, description="Profondità massima dell'albero"),
    db: Session = Depends(get_db),
):
    """
    Restituisce l'albero ICD-11 fino alla profondità specificata.
    Utilizzato dal componente 3D per il rendering iniziale del grafo.
    """
    # Recupera i nodi di primo livello (capitoli ICD-11)
    top_nodes = (
        db.query(ICD11Category)
        .filter(ICD11Category.parent_id.is_(None))
        .order_by(ICD11Category.code)
        .all()
    )

    def build_tree(node: ICD11Category, current_depth: int) -> ICD11NodeTree:
        """Costruisce ricorsivamente il nodo albero fino alla profondità massima."""
        children = []
        if current_depth < level:
            db_children = (
                db.query(ICD11Category)
                .filter(ICD11Category.parent_id == node.id)
                .order_by(ICD11Category.code)
                .limit(30)  # Limita i figli per performance del rendering 3D
                .all()
            )
            children = [build_tree(child, current_depth + 1) for child in db_children]

        return ICD11NodeTree(
            id=str(node.id),
            code=node.code,
            label=node.title_en,
            level=node.level,
            has_children=node.has_children,
            parent_id=str(node.parent_id) if node.parent_id else None,
            children=children,
        )

    return [build_tree(node, 1) for node in top_nodes]


@router.get("/node/{node_id}/children", response_model=list[ICD11NodeTree])
async def get_node_children(
    node_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Restituisce i figli diretti di un nodo ICD-11.
    Chiamato dal 3D graph quando l'utente clicca un nodo per espanderlo.
    """
    # Verifica che il nodo esista
    node = db.query(ICD11Category).filter(ICD11Category.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Nodo ICD-11 non trovato")

    children = (
        db.query(ICD11Category)
        .filter(ICD11Category.parent_id == node_id)
        .order_by(ICD11Category.code)
        .all()
    )

    return [
        ICD11NodeTree(
            id=str(child.id),
            code=child.code,
            label=child.title_en,
            level=child.level,
            has_children=child.has_children,
            parent_id=str(child.parent_id) if child.parent_id else None,
            children=[],
        )
        for child in children
    ]


@router.get("/node/{node_id}", response_model=ICD11TableRow)
async def get_icd11_node(
    node_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Restituisce i dettagli di un singolo nodo ICD-11.
    Utilizzato per il deep-linking dalla dashboard anatomica.
    """
    node = db.query(ICD11Category).filter(ICD11Category.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Nodo ICD-11 non trovato")

    # Calcola il numero di figli
    children_count = db.query(ICD11Category).filter(ICD11Category.parent_id == node_id).count()

    return ICD11TableRow(
        id=str(node.id),
        code=node.code,
        title_en=node.title_en,
        title_it=node.title_it,
        description=node.description,
        inclusions=node.inclusions,
        exclusions=node.exclusions,
        index_terms=node.index_terms,
        diagnostic_criteria=node.diagnostic_criteria,
        coding_notes=node.coding_notes,
        postcoordination_axes=node.postcoordination_axes,
        differential_diagnoses=node.differential_diagnoses,
        level=node.level,
        has_children=node.has_children,
        children_count=children_count,
    )


@router.get("/search", response_model=list[ICD11SearchResult])
async def search_icd11(
    q: str = Query(..., min_length=2, description="Termine di ricerca"),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Ricerca full-text nel database ICD-11 locale.
    Cerca nel codice, nel titolo e nella descrizione.
    """
    search_term = f"%{q.lower()}%"
    results = (
        db.query(ICD11Category)
        .filter(
            or_(
                func.lower(ICD11Category.code).like(search_term),
                func.lower(ICD11Category.title_en).like(search_term),
                func.lower(ICD11Category.description).like(search_term),
            )
        )
        .limit(limit)
        .all()
    )

    return [
        ICD11SearchResult(
            id=str(r.id),
            code=r.code,
            title=r.title_en,
            description=r.description,
            level=r.level,
        )
        for r in results
    ]


@router.get("/codes", response_model=PaginatedICD11Response)
async def get_icd11_codes(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=10, le=200),
    search: Optional[str] = Query(default=None),
    level: Optional[int] = Query(default=None, ge=0),
    parent_id: Optional[UUID] = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Restituisce un elenco paginato di codici ICD-11.
    Utilizzato dalla vista tabulare (/tabular).
    Supporta filtraggio per testo, livello gerarchico e genitore (drill-down).
    """
    query = db.query(ICD11Category)

    # Filtro per genitore (per navigazione gerarchica)
    if parent_id:
        query = query.filter(ICD11Category.parent_id == parent_id)
    # Filtro per livello gerarchico (solo se non viene chiesto un parent specifico)
    elif level is not None:
        query = query.filter(ICD11Category.level == level)

    # Filtro per termine di ricerca
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(ICD11Category.code).like(search_term),
                func.lower(ICD11Category.title_en).like(search_term),
            )
        )

    # Conta il totale per la paginazione
    total = query.count()
    total_pages = math.ceil(total / page_size)

    # Applica paginazione
    items = (
        query.order_by(ICD11Category.level, ICD11Category.code)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Calcola il numero di figli per ogni elemento nella pagina corrente
    item_ids = [item.id for item in items]
    child_counts = (
        db.query(ICD11Category.parent_id, func.count(ICD11Category.id))
        .filter(ICD11Category.parent_id.in_(item_ids))
        .group_by(ICD11Category.parent_id)
        .all()
    )
    counts_map = {str(parent_id): count for parent_id, count in child_counts}

    return PaginatedICD11Response(
        items=[
            ICD11TableRow(
                id=str(item.id),
                code=item.code,
                title_en=item.title_en,
                title_it=item.title_it,
                description=item.description,
                inclusions=item.inclusions,
                exclusions=item.exclusions,
                index_terms=item.index_terms,
                diagnostic_criteria=item.diagnostic_criteria,
                coding_notes=item.coding_notes,
                postcoordination_axes=item.postcoordination_axes,
                differential_diagnoses=item.differential_diagnoses,
                level=item.level,
                has_children=item.has_children,
                children_count=counts_map.get(str(item.id), 0),
            )
            for item in items
        ],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/stats")
async def get_icd11_stats(db: Session = Depends(get_db)):
    """Statistiche generali sul database ICD-11 (per la dashboard)."""
    total = db.query(ICD11Category).count()
    chapters = db.query(ICD11Category).filter(ICD11Category.level == 0).count()
    return {
        "total_codes": total,
        "chapters": chapters,
        "status": "populated" if total > 0 else "empty",
    }
