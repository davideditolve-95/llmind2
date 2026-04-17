"""
Router per l'integrazione del supporto legacy llmind-v1.
Espone endpoint per il Legacy Explorer.
"""

from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from ..services.legacy_rag import legacy_rag_service

router = APIRouter(prefix="/api/legacy", tags=["Legacy"])

class LegacyAskRequest(BaseModel):
    input_string: str

class LegacyAskResponse(BaseModel):
    output_string: str
    model: str = "llmind-v1 (gemma2:27b)"

class BatchRunRequest(BaseModel):
    csv_filename: str

@router.post("/ask", response_model=LegacyAskResponse)
async def ask_legacy(request: LegacyAskRequest):
    """
    Endpoint per interrogare la versione legacy di llmind.
    Utilizza il datastore (ChromaDB) originale della v1.
    """
    try:
        answer = await legacy_rag_service.ask(request.input_string)
        return LegacyAskResponse(output_string=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch-run")
async def run_legacy_batch(request: BatchRunRequest):
    """
    Avvia un batch run legacy su un CSV selezionato.
    """
    try:
        # Nota: in un sistema reale questo dovrebbe essere gestito con BackgroundTasks
        # ma per semplicità lo facciamo così (il service usa run_in_executor)
        output_file = await legacy_rag_service.run_batch(request.csv_filename)
        return {"message": "Batch run completed", "output_file": output_file}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/logs")
async def get_legacy_logs(limit: int = 50):
    """
    Ritorna gli ultimi log del sistema legacy.
    """
    try:
        logs = legacy_rag_service.get_logs(limit)
        return {"logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
