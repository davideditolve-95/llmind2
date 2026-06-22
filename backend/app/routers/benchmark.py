"""
Router FastAPI per il modulo di benchmarking universitario.
Gestisce l'esecuzione batch di inferenze LLM e la raccolta delle metriche.
"""

import asyncio
import logging
import json
import re
from typing import Mapping
from uuid import UUID
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from ..database import get_db
from ..models.benchmark import DSM5Case, BenchmarkRun, ManualEvaluation
from ..schemas.benchmark import (
    BenchmarkRunRequest,
    BenchmarkRunResponse,
    BenchmarkKPIResponse,
    ModelKPI,
)
from ..services.ollama import ollama_service
from ..services.embeddings import embedding_service
from ..services.legacy_rag import legacy_rag_service

router = APIRouter(prefix="/api/benchmark", tags=["Benchmark"])

# Flag globale per la cancellazione dei benchmark in background
# In un sistema multi-utente reale andrebbe gestito con Redis o batch_id
_CANCEL_ALL = False

_METRIC_STOPWORDS = {
    "a", "about", "also", "and", "are", "as", "at", "be", "by", "case", "clinical",
    "code", "diagnosis", "diagnostic", "disorder", "for", "from", "has", "have",
    "in", "is", "it", "of", "on", "or", "patient", "the", "this", "to", "with",
    "un", "una", "uno", "il", "lo", "la", "i", "gli", "le", "di", "del", "della",
    "dei", "delle", "e", "o", "con", "per", "nel", "nella", "diagnosi", "disturbo",
}

_NO_DIAGNOSIS_PATTERNS = (
    "no diagnosis",
    "cannot determine",
    "insufficient information",
    "not enough information",
    "unable to diagnose",
    "nessuna diagnosi",
    "non posso determinare",
    "informazioni insufficienti",
)


def _normalize_metric_text(value: Optional[str]) -> str:
    """Normalizza testo clinico per confronti lessicali riproducibili."""
    if not value:
        return ""
    value = value.lower()
    value = re.sub(r"[^a-z0-9àèéìòùüäöçñ\s-]+", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def _metric_tokens(value: Optional[str]) -> set[str]:
    normalized = _normalize_metric_text(value)
    raw_tokens = re.findall(r"[a-z0-9àèéìòùüäöçñ-]{3,}", normalized)
    return {token for token in raw_tokens if token not in _METRIC_STOPWORDS}


def compute_benchmark_metrics(response: Optional[str], gold_standard: Optional[str]) -> dict[str, Optional[float] | bool]:
    """
    Calcola metriche automatiche deterministiche per il benchmark.

    Le metriche sono volutamente semplici e auditabili: label_accuracy misura
    la corrispondenza complessiva con la diagnosi attesa, mentre precision/recall/F1
    usano overlap lessicale normalizzato. La valutazione esperta resta necessaria.
    """
    normalized_response = _normalize_metric_text(response)
    normalized_gold = _normalize_metric_text(gold_standard)
    response_tokens = _metric_tokens(response)
    gold_tokens = _metric_tokens(gold_standard)

    no_diagnosis = (
        not normalized_response
        or any(pattern in normalized_response for pattern in _NO_DIAGNOSIS_PATTERNS)
    )

    if not normalized_gold or not gold_tokens:
        return {
            "label_accuracy": None,
            "precision_score": None,
            "recall_score": None,
            "f1_score": None,
            "no_diagnosis": no_diagnosis,
        }

    overlap = response_tokens.intersection(gold_tokens)
    precision = len(overlap) / len(response_tokens) if response_tokens else 0.0
    recall = len(overlap) / len(gold_tokens) if gold_tokens else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0

    label_match = normalized_gold in normalized_response
    token_match = recall >= 0.65 and len(overlap) >= min(3, len(gold_tokens))
    label_accuracy = 1.0 if label_match or token_match else 0.0

    return {
        "label_accuracy": label_accuracy,
        "precision_score": precision,
        "recall_score": recall,
        "f1_score": f1,
        "no_diagnosis": no_diagnosis and not label_accuracy,
    }


def _average_metric(runs: list[BenchmarkRun], attr: str) -> Optional[float]:
    values = [getattr(run, attr) for run in runs if getattr(run, attr) is not None]
    return sum(values) / len(values) if values else None


def _build_model_kpi(model: str, runs: list[BenchmarkRun]) -> ModelKPI:
    all_evals = []
    rated_runs_count = 0
    for run in runs:
        if run.evaluations:
            all_evals.extend([evaluation.rating for evaluation in run.evaluations])
            rated_runs_count += 1

    avg_rating = sum(all_evals) / len(all_evals) if all_evals else None
    no_diagnosis_count = sum(1 for run in runs if run.no_diagnosis)
    no_diagnosis_rate = no_diagnosis_count / len(runs) if runs else None

    return ModelKPI(
        model_name=model,
        total_runs=len(runs),
        avg_similarity=_average_metric(runs, "similarity_score"),
        avg_label_accuracy=_average_metric(runs, "label_accuracy"),
        avg_precision=_average_metric(runs, "precision_score"),
        avg_recall=_average_metric(runs, "recall_score"),
        avg_f1=_average_metric(runs, "f1_score"),
        no_diagnosis_count=no_diagnosis_count,
        no_diagnosis_rate=no_diagnosis_rate,
        avg_latency_ms=_average_metric(runs, "latency_ms"),
        avg_human_rating=avg_rating,
        rated_runs=rated_runs_count,
    )


async def execute_single_run(
    db: Session,
    case: DSM5Case,
    model_name: str,
    include_discussion: bool,
    prompt_language: str,
    batch_id: Optional[UUID] = None,
    run_id: Optional[UUID] = None,
) -> BenchmarkRun:
    """
    Esegue un singolo run di inferenza diagnostica su un caso clinico.
    Salva il risultato nel database con le metriche di similarità.
    """
    # Costruisce il prompt diagnostico
    prompt = ollama_service.build_benchmark_prompt(
        case_title=case.title,
        anamnesis=case.anamnesis,
        discussion=case.discussion if include_discussion else None,
        language=prompt_language,
    )

    # Recupera o crea il record nel DB
    if run_id:
        run = db.query(BenchmarkRun).filter(BenchmarkRun.id == run_id).first()
        if run:
            run.status = "running"
            run.prompt_used = prompt
            run.updated_at = datetime.utcnow()
    else:
        run = BenchmarkRun(
            case_id=case.id,
            batch_id=batch_id,
            model_name=model_name,
            prompt_used=prompt,
            include_discussion=include_discussion,
            prompt_language=prompt_language,
            status="running",
        )
        db.add(run)
    
    db.commit()
    db.refresh(run)

    # System prompt specializzato per diagnosi ICD-11
    system_prompt = (
        "You are a clinical psychologist specialized in ICD-11 diagnosis. "
        "Analyze the clinical case and provide a structured ICD-11 diagnosis. "
        "Format: 1) ICD-11 Code 2) Diagnosis Name 3) Clinical Justification"
    )
    run.system_prompt_used = system_prompt
    db.commit()

    # Esegue l'inferenza con Ollama o Legacy RAG
    if model_name == "llmind-v1 (legacy)":
        logging.info(f"OLLAMA LOG: Using Legacy RAG Service for benchmark run {run_id}")
        import time
        start_time = time.time()
        try:
            answer = await legacy_rag_service.ask(prompt)
            latency_ms = int((time.time() - start_time) * 1000)
            result = {
                "success": True,
                "content": answer,
                "latency_ms": latency_ms,
                "model": model_name
            }
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            result = {
                "success": False,
                "content": "",
                "latency_ms": latency_ms,
                "error": str(e)
            }
    else:
        logging.info(f"OLLAMA LOG: Sending request to {ollama_service.base_url}/api/chat for model {model_name}")
        result = await ollama_service.run_inference(
            prompt=prompt,
            model=model_name,
            system_prompt=system_prompt,
        )

    logging.info(f"OLLAMA LOG: Received response from {model_name}. Success: {result['success']}")

    # Calcola la similarità semantica con il Gold Standard
    similarity = None
    diagnostic_metrics = compute_benchmark_metrics(
        result.get("content", ""),
        case.gold_standard_diagnosis,
    )
    if result["success"] and result["content"] and case.gold_standard_diagnosis:
        try:
            similarity = embedding_service.compute_cosine_similarity(
                result["content"],
                case.gold_standard_diagnosis,
            )
        except Exception as e:
            logging.error(f"Error calculating similarity: {e}")

    # Aggiorna il record con i risultati
    run.llm_response = result.get("content", "")
    run.latency_ms = result.get("latency_ms")
    run.similarity_score = similarity
    run.label_accuracy = diagnostic_metrics["label_accuracy"]
    run.precision_score = diagnostic_metrics["precision_score"]
    run.recall_score = diagnostic_metrics["recall_score"]
    run.f1_score = diagnostic_metrics["f1_score"]
    run.no_diagnosis = bool(diagnostic_metrics["no_diagnosis"])
    run.status = "completed" if result["success"] else "failed"
    run.error_message = result.get("error") if not result["success"] else None

    db.commit()
    db.refresh(run)
    return run


@router.post("/run", response_model=dict)
async def run_benchmark(
    request: BenchmarkRunRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Avvia un batch di inferenze multi-modello su più casi clinici.
    Ogni combinazione (caso × modello) genera un BenchmarkRun indipendente.
    """
    import uuid
    batch_id = uuid.uuid4()
    
    # Verifica che i casi esistano
    cases = db.query(DSM5Case).filter(DSM5Case.id.in_(request.case_ids)).all()
    if len(cases) != len(request.case_ids):
        raise HTTPException(status_code=404, detail="Uno o più casi non trovati")

    # Crea i record di run in stato "pending"
    runs_to_execute = []
    for case in cases:
        for model_name in request.model_names:
            run = BenchmarkRun(
                case_id=case.id,
                batch_id=batch_id,
                model_name=model_name,
                prompt_used="",
                include_discussion=request.include_discussion,
                prompt_language=request.prompt_language,
                status="pending",
            )
            db.add(run)
            db.flush() # Ottiene l'ID senza commit completo
            runs_to_execute.append((case.id, model_name, run.id))

    db.commit()

    # Avvia l'esecuzione in background
    async def execute_all():
        global _CANCEL_ALL
        _CANCEL_ALL = False
        
        from ..database import SessionLocal
        inner_db = SessionLocal()
        
        try:
            logging.info(f"OLLAMA LOG: Starting batch {batch_id} execution in background...")
            for case_id, model_name, run_id in runs_to_execute:
                if _CANCEL_ALL:
                    logging.info(f"OLLAMA LOG: Batch {batch_id} cancelled.")
                    break
                    
                try:
                    case = inner_db.query(DSM5Case).filter(DSM5Case.id == case_id).first()
                    if not case:
                        continue
                        
                    await execute_single_run(
                        db=inner_db,
                        case=case,
                        model_name=model_name,
                        include_discussion=request.include_discussion,
                        prompt_language=request.prompt_language,
                        batch_id=batch_id,
                        run_id=run_id,
                    )
                except Exception as e:
                    logging.error(f"OLLAMA LOG: Error in single run {run_id}: {e}")
        finally:
            logging.info(f"OLLAMA LOG: Batch {batch_id} execution finished.")
            inner_db.close()

    background_tasks.add_task(execute_all)

    total_runs = len(cases) * len(request.model_names)
    return {
        "message": f"Avviate {total_runs} esecuzioni in background",
        "batch_id": str(batch_id),
        "total_runs": total_runs,
    }

@router.post("/stop")
async def stop_benchmark():
    """Segnala al thread di background di interrompere l'esecuzione."""
    global _CANCEL_ALL
    _CANCEL_ALL = True
    return {"message": "Richiesta di interruzione inviata"}


@router.post("/runs/{run_id}/retry")
async def retry_run(
    run_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Esegue nuovamente un singolo benchmark run fallito o completato."""
    run = db.query(BenchmarkRun).filter(BenchmarkRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Benchmark run non trovato")

    case = db.query(DSM5Case).filter(DSM5Case.id == run.case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Caso associato non trovato")

    # Avvia in background
    background_tasks.add_task(
        execute_single_run,
        db=db,
        case=case,
        model_name=run.model_name,
        include_discussion=run.include_discussion,
        prompt_language=run.prompt_language,
        run_id=run.id,
    )

    return {"message": "Retry avviato in background", "run_id": str(run_id)}


@router.get("/history", response_model=dict)
async def get_benchmark_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=5, le=100),
    model_name: Optional[str] = Query(default=None),
    case_id: Optional[UUID] = Query(default=None),
    status: Optional[str] = Query(default=None),
    batch_id: Optional[UUID] = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Cronologia paginata di tutti i benchmark run.
    Supporta filtri per modello, caso, stato e batch.
    """
    query = db.query(BenchmarkRun)

    if model_name:
        query = query.filter(BenchmarkRun.model_name == model_name)
    if case_id:
        query = query.filter(BenchmarkRun.case_id == case_id)
    if status:
        query = query.filter(BenchmarkRun.status == status)
    if batch_id:
        query = query.filter(BenchmarkRun.batch_id == batch_id)

    total = query.count()
    import math
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    runs = (
        query.order_by(desc(BenchmarkRun.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Arricchisce con i dati del caso associato
    items = []
    for run in runs:
        case = db.query(DSM5Case).filter(DSM5Case.id == run.case_id).first()
        items.append({
            "id": str(run.id),
            "case_id": str(run.case_id),
            "batch_id": str(run.batch_id) if run.batch_id else None,
            "case_title": case.title if case else "N/A",
            "case_number": case.case_number if case else None,
            "gold_standard_diagnosis": case.gold_standard_diagnosis if case else None,
            "model_name": run.model_name,
            "prompt_used": run.prompt_used,
            "system_prompt_used": run.system_prompt_used,
            "llm_response": run.llm_response,
            "similarity_score": run.similarity_score,
            "label_accuracy": run.label_accuracy,
            "precision_score": run.precision_score,
            "recall_score": run.recall_score,
            "f1_score": run.f1_score,
            "no_diagnosis": run.no_diagnosis,
            "llm_judge_score": run.llm_judge_score,
            "latency_ms": run.latency_ms,
            "evaluations": [
                {
                    "id": str(e.id),
                    "run_id": str(e.run_id),
                    "evaluator_name": e.evaluator_name,
                    "rating": e.rating,
                    "notes": e.notes,
                    "created_at": e.created_at.isoformat(),
                } for e in run.evaluations
            ],
            "include_discussion": run.include_discussion,
            "status": run.status,
            "error_message": run.error_message,
            "created_at": run.created_at.isoformat(),
            "updated_at": run.updated_at.isoformat(),
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


from ..schemas.benchmark import ManualEvaluationCreate, ManualEvaluationResponse
from ..models.benchmark import ManualEvaluation

@router.post("/runs/{run_id}/evaluations", response_model=ManualEvaluationResponse)
async def add_manual_evaluation(
    run_id: UUID,
    evaluation: ManualEvaluationCreate,
    db: Session = Depends(get_db),
):
    """
    Aggiunge una nuova valutazione manuale nominale (es. 'Psychologist A', 'Accuracy') a un run.
    """
    run = db.query(BenchmarkRun).filter(BenchmarkRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Benchmark run non trovato")

    new_eval = ManualEvaluation(
        run_id=run.id,
        evaluator_name=evaluation.evaluator_name,
        rating=evaluation.rating,
        notes=evaluation.notes,
    )
    db.add(new_eval)
    db.commit()
    db.refresh(new_eval)

    return new_eval

@router.delete("/runs/{run_id}/evaluations/{eval_id}")
async def delete_manual_evaluation(
    run_id: UUID,
    eval_id: UUID,
    db: Session = Depends(get_db),
):
    """Elimina una singola valutazione manuale da un run."""
    db_eval = db.query(ManualEvaluation).filter(ManualEvaluation.id == eval_id, ManualEvaluation.run_id == run_id).first()
    if not db_eval:
        raise HTTPException(status_code=404, detail="Valutazione non trovata")
    
    db.delete(db_eval)
    db.commit()
    return {"success": True, "message": "Valutazione eliminata"}
@router.delete("/history")
async def purge_benchmark_history(db: Session = Depends(get_db)):
    """Interrompe tutto e cancella l'intera cronologia benchmark."""
    global _CANCEL_ALL
    _CANCEL_ALL = True # Ferma tutto quello che sta girando
    
    db.query(BenchmarkRun).delete()
    db.commit()
    return {"success": True, "message": "Cronologia benchmark resettata completamente"}


@router.get("/kpis", response_model=BenchmarkKPIResponse)
async def get_benchmark_kpis(db: Session = Depends(get_db)):
    """
    Calcola e restituisce i KPI aggregati per la dashboard di ricerca.
    Include statistiche per modello, serie temporali e distribuzioni.
    """
    total_cases = db.query(DSM5Case).count()
    reviewed_cases = db.query(DSM5Case).filter(DSM5Case.is_reviewed == True).count()
    total_runs = db.query(BenchmarkRun).filter(BenchmarkRun.status == "completed").count()

    # KPI aggregati per modello
    models = db.query(BenchmarkRun.model_name).filter(
        BenchmarkRun.status == "completed"
    ).distinct().all()
    model_names = [m[0] for m in models]

    model_kpis = []
    for model in model_names:
        runs = db.query(BenchmarkRun).filter(
            BenchmarkRun.model_name == model,
            BenchmarkRun.status == "completed",
        ).all()
        model_kpis.append(_build_model_kpi(model, runs))

    # Serie temporale similarità (ultimi 100 run per modello)
    recent_runs = (
        db.query(BenchmarkRun)
        .filter(BenchmarkRun.status == "completed", BenchmarkRun.similarity_score.isnot(None))
        .order_by(desc(BenchmarkRun.created_at))
        .limit(100)
        .all()
    )
    similarity_over_time = [
        {
            "date": run.created_at.strftime("%Y-%m-%d %H:%M"),
            "model": run.model_name,
            "similarity": round(run.similarity_score, 3),
            "f1": round(run.f1_score, 3) if run.f1_score is not None else None,
            "accuracy": round(run.label_accuracy, 3) if run.label_accuracy is not None else None,
        }
        for run in reversed(recent_runs)
    ]

    # Distribuzione valutazioni umane
    rating_distribution = []
    for star in range(1, 6):
        count = db.query(ManualEvaluation).filter(ManualEvaluation.rating == star).count()
        rating_distribution.append({"stars": star, "count": count})

    return BenchmarkKPIResponse(
        total_cases=total_cases,
        total_runs=total_runs,
        reviewed_cases=reviewed_cases,
        models_tested=model_names,
        model_kpis=model_kpis,
        similarity_over_time=similarity_over_time,
        rating_distribution=rating_distribution,
    )


from fastapi.responses import StreamingResponse
import io
import csv


@router.get("/batch/{batch_id}/kpis", response_model=BenchmarkKPIResponse)
async def get_batch_kpis(batch_id: UUID, db: Session = Depends(get_db)):
    """
    Calcola KPI specifici per una singola sessione (batch).
    Usato per visualizzare il dashboard specifico di un benchmark.
    """
    runs = db.query(BenchmarkRun).filter(
        BenchmarkRun.batch_id == batch_id,
        BenchmarkRun.status == "completed"
    ).all()

    if not runs:
        raise HTTPException(status_code=404, detail="Nessun dato completato per questo batch")

    # Identifica i modelli coinvolti nel batch
    model_names = list(set([r.model_name for r in runs]))
    
    model_kpis = []
    for model in model_names:
        m_runs = [r for r in runs if r.model_name == model]
        model_kpis.append(_build_model_kpi(model, m_runs))

    # Serie temporale per questo batch (ordinata per creazione)
    similarity_over_time = [
        {
            "date": r.created_at.strftime("%H:%M:%S"),
            "model": r.model_name,
            "similarity": round(r.similarity_score, 3) if r.similarity_score else 0,
            "f1": round(r.f1_score, 3) if r.f1_score is not None else None,
            "accuracy": round(r.label_accuracy, 3) if r.label_accuracy is not None else None,
        }
        for r in sorted(runs, key=lambda x: x.created_at)
    ]

    # Distribuzione rating in questo batch
    rating_distribution = []
    run_ids = [r.id for r in runs]
    for star in range(1, 6):
        count = db.query(ManualEvaluation).filter(
            ManualEvaluation.run_id.in_(run_ids),
            ManualEvaluation.rating == star
        ).count()
        rating_distribution.append({"stars": star, "count": count})

    return BenchmarkKPIResponse(
        total_cases=len(set([r.case_id for r in runs])),
        total_runs=len(runs),
        reviewed_cases=0,
        models_tested=model_names,
        model_kpis=model_kpis,
        similarity_over_time=similarity_over_time,
        rating_distribution=rating_distribution,
    )


@router.get("/export")
async def export_benchmark_data(
    format: str = Query("csv", enum=["csv", "json", "txt"]),
    batch_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db)
):
    """Esporta i dati benchmark in vari formati (CSV, JSON, TXT)."""
    # 1. Recupero Dati
    query = db.query(BenchmarkRun)
    if batch_id:
        query = query.filter(BenchmarkRun.batch_id == batch_id)
    runs = query.all()

    if not runs:
        raise HTTPException(status_code=404, detail="Nessun dato trovato per l'esportazione")

    # 2. Formattazione JSON
    if format == "json":
        data = []
        for run in runs:
            data.append({
                "id": str(run.id),
                "batch_id": str(run.batch_id) if run.batch_id else None,
                "model": run.model_name,
                "case": {
                    "id": str(run.case.id),
                    "title": run.case.title,
                    "anamnesis": run.case.anamnesis,
                    "gold_standard": run.case.gold_standard_diagnosis
                },
                "status": run.status,
                "similarity": run.similarity_score,
                "label_accuracy": run.label_accuracy,
                "precision": run.precision_score,
                "recall": run.recall_score,
                "f1": run.f1_score,
                "no_diagnosis": run.no_diagnosis,
                "latency_ms": run.latency_ms,
                "llm_response": run.llm_response,
                "evaluations": [
                    {"evaluator": ev.evaluator_name, "rating": ev.rating, "notes": ev.notes}
                    for ev in run.evaluations
                ]
            })
        return StreamingResponse(
            iter([json.dumps(data, indent=2)]),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=benchmark_export_{datetime.now().strftime('%Y%m%d')}.json"}
        )

    # 3. Formattazione TXT (Report Clinico)
    if format == "txt":
        output = io.StringIO()
        output.write(f"LLMIND2 BENCHMARK REPORT - {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
        output.write("="*60 + "\n\n")
        
        # Raggruppa per caso
        cases_grouped = {}
        for r in runs:
            if r.case_id not in cases_grouped: cases_grouped[r.case_id] = {"case": r.case, "runs": []}
            cases_grouped[r.case_id]["runs"].append(r)
            
        for cid, group in cases_grouped.items():
            case = group["case"]
            output.write(f"CASE: {case.case_number or 'N/A'} - {case.title}\n")
            output.write("-" * 40 + "\n")
            output.write(f"ANAMNESIS:\n{case.anamnesis[:500]}...\n\n")
            output.write(f"GOLD STANDARD DIAGNOSIS:\n{case.gold_standard_diagnosis}\n\n")
            
            for run in group["runs"]:
                output.write(f"  > MODEL: {run.model_name} ({run.status.upper()})\n")
                if run.status == "completed":
                    output.write(f"    SIMILARITY: {round((run.similarity_score or 0)*100, 1)}%\n")
                    output.write(f"    LABEL ACCURACY: {round((run.label_accuracy or 0)*100, 1)}%\n")
                    output.write(f"    PRECISION / RECALL / F1: {round((run.precision_score or 0)*100, 1)}% / {round((run.recall_score or 0)*100, 1)}% / {round((run.f1_score or 0)*100, 1)}%\n")
                    output.write(f"    NO DIAGNOSIS: {'yes' if run.no_diagnosis else 'no'}\n")
                    output.write(f"    LATENCY: {run.latency_ms}ms\n")
                    evals_str = ", ".join([f"{e.evaluator_name}: {e.rating}/5" for e in run.evaluations])
                    output.write(f"    EVALUATIONS: {evals_str or 'None'}\n")
                    output.write(f"    RESPONSE:\n    {run.llm_response[:1000]}\n")
                else:
                    output.write(f"    ERROR: {run.error_message}\n")
                output.write("\n")
            output.write("="*60 + "\n\n")
            
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/plain",
            headers={"Content-Disposition": f"attachment; filename=benchmark_report_{datetime.now().strftime('%Y%m%d')}.txt"}
        )

    # 4. Formattazione CSV (Pivotato)
    all_models = sorted(list(set([r.model_name for r in runs])))
    all_evaluator_names = sorted(list(set([e.evaluator_name for r in runs for e in r.evaluations])))
    
    runs_by_case = {}
    for run in runs:
        if run.case_id not in runs_by_case: runs_by_case[run.case_id] = {}
        runs_by_case[run.case_id][run.model_name] = run
        
    output = io.StringIO()
    writer = csv.writer(output, delimiter=',', quotechar='"', quoting=csv.QUOTE_MINIMAL)
    
    headers = ["Case ID", "Case Number", "Case Title", "Original Anamnesis", "Discussion", "Gold Standard Diagnosis"]
    for model in all_models:
        headers.extend([
            f"[{model}] LLM Output",
            f"[{model}] Similarity",
            f"[{model}] Label Accuracy",
            f"[{model}] Precision",
            f"[{model}] Recall",
            f"[{model}] F1",
            f"[{model}] No Diagnosis",
            f"[{model}] Latency",
            f"[{model}] Status",
        ])
        for e in all_evaluator_names: headers.append(f"[{model}] {e}")
            
    writer.writerow(headers)
    
    stats_map = {
        m: {
            "s_sum": 0, "s_count": 0,
            "acc_sum": 0, "acc_count": 0,
            "precision_sum": 0, "precision_count": 0,
            "recall_sum": 0, "recall_count": 0,
            "f1_sum": 0, "f1_count": 0,
            "no_diagnosis_count": 0,
            "l_sum": 0, "l_count": 0,
            "evals": {e: {"sum": 0, "count": 0} for e in all_evaluator_names}
        }
        for m in all_models
    }
    
    for case_id, model_runs in runs_by_case.items():
        case = db.query(DSM5Case).filter(DSM5Case.id == case_id).first()
        if not case: continue
            
        row = [str(case.id), case.case_number or "", case.title, case.anamnesis, case.discussion, case.gold_standard_diagnosis]
        for model in all_models:
            run = model_runs.get(model)
            if run:
                row.extend([
                    run.llm_response or "",
                    run.similarity_score or 0,
                    run.label_accuracy or 0,
                    run.precision_score or 0,
                    run.recall_score or 0,
                    run.f1_score or 0,
                    "yes" if run.no_diagnosis else "no",
                    run.latency_ms or 0,
                    run.status,
                ])
                if run.status == "completed":
                    if run.similarity_score is not None:
                        stats_map[model]["s_sum"] += run.similarity_score
                        stats_map[model]["s_count"] += 1
                    for attr, stat_prefix in [
                        ("label_accuracy", "acc"),
                        ("precision_score", "precision"),
                        ("recall_score", "recall"),
                        ("f1_score", "f1"),
                    ]:
                        value = getattr(run, attr)
                        if value is not None:
                            stats_map[model][f"{stat_prefix}_sum"] += value
                            stats_map[model][f"{stat_prefix}_count"] += 1
                    if run.no_diagnosis:
                        stats_map[model]["no_diagnosis_count"] += 1
                    if run.latency_ms is not None:
                        stats_map[model]["l_sum"] += run.latency_ms
                        stats_map[model]["l_count"] += 1
                
                run_evals = {e.evaluator_name: e.rating for e in run.evaluations}
                for e in all_evaluator_names:
                    rating = run_evals.get(e, "")
                    row.append(rating)
                    if rating != "" and run.status == "completed":
                        stats_map[model]["evals"][e]["sum"] += rating
                        stats_map[model]["evals"][e]["count"] += 1
            else:
                row.extend(["", "", "", "", "", "", "", "", "N/A"])
                for _ in all_evaluator_names: row.append("")
        writer.writerow(row)
        
    avg_row_data = ["AVERAGE", "", "", "", "", ""]
    for model in all_models:
        s_avg = (stats_map[model]["s_sum"] / stats_map[model]["s_count"]) if stats_map[model]["s_count"] > 0 else ""
        acc_avg = (stats_map[model]["acc_sum"] / stats_map[model]["acc_count"]) if stats_map[model]["acc_count"] > 0 else ""
        precision_avg = (stats_map[model]["precision_sum"] / stats_map[model]["precision_count"]) if stats_map[model]["precision_count"] > 0 else ""
        recall_avg = (stats_map[model]["recall_sum"] / stats_map[model]["recall_count"]) if stats_map[model]["recall_count"] > 0 else ""
        f1_avg = (stats_map[model]["f1_sum"] / stats_map[model]["f1_count"]) if stats_map[model]["f1_count"] > 0 else ""
        no_diagnosis_count = stats_map[model]["no_diagnosis_count"]
        l_avg = (stats_map[model]["l_sum"] / stats_map[model]["l_count"]) if stats_map[model]["l_count"] > 0 else ""
        avg_row_data.extend(["", s_avg, acc_avg, precision_avg, recall_avg, f1_avg, no_diagnosis_count, l_avg, ""])
        for e in all_evaluator_names:
            e_avg = (stats_map[model]["evals"][e]["sum"] / stats_map[model]["evals"][e]["count"]) if stats_map[model]["evals"][e]["count"] > 0 else ""
            avg_row_data.append(e_avg)
    writer.writerow(avg_row_data)
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=benchmark_results_{datetime.now().strftime('%Y%m%d')}.csv"}
    )
    
    # Raggruppa i run per case_id
    runs_by_case = {}
    for run in runs:
        if run.case_id not in runs_by_case:
            runs_by_case[run.case_id] = {}
        runs_by_case[run.case_id][run.model_name] = run
        
    output = io.StringIO()
    writer = csv.writer(output, delimiter=',', quotechar='"', quoting=csv.QUOTE_MINIMAL)
    
    # Costruisci l'intestazione dinamica
    headers = [
        "Case ID", "Case Number", "Case Title", 
        "Original Anamnesis", "Discussion", "Gold Standard Diagnosis"
    ]
    
    for model in models:
        headers.extend([
            f"[{model}] System Prompt",
            f"[{model}] User Prompt",
            f"[{model}] LLM Output",
            f"[{model}] Similarity Score",
            f"[{model}] Latency (ms)",
            f"[{model}] Status"
        ])
        for eval_name in evaluator_names:
            headers.append(f"[{model}] {eval_name} Rating")
            
    writer.writerow(headers)
    
    # Accumulatori per le medie finali spaziano per modello
    # ignores failed runs
    stats = {model: {
        "similarity_sum": 0, "similarity_count": 0,
        "latency_sum": 0, "latency_count": 0,
        "evals": {e: {"sum": 0, "count": 0} for e in evaluator_names}
    } for model in models}
    
    # Per ogni caso aggregato, scrivi la riga
    for case_id, model_runs in runs_by_case.items():
        case = db.query(DSM5Case).filter(DSM5Case.id == case_id).first()
        if not case:
            continue
            
        row = [
            str(case.id),
            case.case_number or "",
            case.title or "",
            case.anamnesis or "",
            case.discussion or "",
            case.gold_standard_diagnosis or ""
        ]
        
        for model in models:
            run = model_runs.get(model)
            if run:
                row.extend([
                    run.system_prompt_used or "",
                    run.prompt_used or "",
                    run.llm_response or "",
                    run.similarity_score if run.similarity_score is not None else "",
                    run.latency_ms if run.latency_ms is not None else "",
                    run.status
                ])
                
                # Calcola medie ignorando i falliti
                if run.status == "completed":
                    if run.similarity_score is not None:
                        stats[model]["similarity_sum"] += run.similarity_score
                        stats[model]["similarity_count"] += 1
                    if run.latency_ms is not None:
                        stats[model]["latency_sum"] += run.latency_ms
                        stats[model]["latency_count"] += 1
                
                # Valutazioni manuali
                run_evals = {e.evaluator_name: e.rating for e in run.evaluations}
                for eval_name in evaluator_names:
                    rating = run_evals.get(eval_name, "")
                    row.append(rating)
                    if rating != "" and run.status == "completed":
                        stats[model]["evals"][eval_name]["sum"] += rating
                        stats[model]["evals"][eval_name]["count"] += 1
            else:
                # Nessun run per questo modello su questo caso
                row.extend(["", "", "", "", "", ""])
                for _ in evaluator_names:
                    row.append("")
                    
        writer.writerow(row)
        
    # -- Riga delle medie --
    avg_row = ["AVERAGE", "", "", "", "", ""]
    for model in models:
        s_count = stats[model]["similarity_count"]
        s_avg = (stats[model]["similarity_sum"] / s_count) if s_count > 0 else ""
        
        l_count = stats[model]["latency_count"]
        l_avg = (stats[model]["latency_sum"] / l_count) if l_count > 0 else ""
        
        avg_row.extend(["", "", "", s_avg, l_avg, ""])
        
        for eval_name in evaluator_names:
            e_count = stats[model]["evals"][eval_name]["count"]
            e_avg = (stats[model]["evals"][eval_name]["sum"] / e_count) if e_count > 0 else ""
            avg_row.append(e_avg)
            
    writer.writerow(avg_row)
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=benchmark_results.csv"}
    )
