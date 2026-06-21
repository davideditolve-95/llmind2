from fastapi import APIRouter, HTTPException, Body, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
import os
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
async def run_legacy_batch(request: BatchRunRequest, background_tasks: BackgroundTasks):
    """
    Avvia un batch run legacy su un CSV selezionato in background.
    """
    try:
        background_tasks.add_task(
            legacy_rag_service.run_batch,
            request.csv_filename
        )
        return {"message": "Batch run started in background", "output_file": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/runs")
async def list_legacy_runs():
    """
    Elenca i file di output generati dai batch run legacy.
    """
    try:
        output_dir = Path(os.getenv("DATA_DIR", "/app/data")) / "output" / "legacy_runs"
        if not output_dir.exists():
            return {"runs": []}
        files = [f.name for f in output_dir.glob("*.csv") if f.is_file()]
        # Ordina per data di modifica decrescente (i più recenti prima)
        files.sort(key=lambda x: os.path.getmtime(output_dir / x), reverse=True)
        return {"runs": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/runs/{filename}")
async def download_legacy_run(filename: str):
    """
    Consente di scaricare un file CSV di output generato dai run legacy.
    """
    try:
        file_path = Path(os.getenv("DATA_DIR", "/app/data")) / "output" / "legacy_runs" / filename
        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(file_path, filename=filename, media_type="text/csv")
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
