"""
Router per la gestione dei Datastore personalizzati.
Espone endpoint per il caricamento documenti, la gestione e l'interrogazione RAG.
"""

import os
import shutil
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form, BackgroundTasks
from pathlib import Path
import uuid
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db, SessionLocal
from ..models.datastore import Datastore
from ..services.ingestion import ingestion_service
from ..services.ollama import ollama_service  # Serve per il build_prompt
from langchain_chroma import Chroma
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.llms import Ollama
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain import hub
from ..config import get_settings

router = APIRouter(prefix="/api/datastore", tags=["Datastore"])
settings = get_settings()
logger = logging.getLogger(__name__)

# ─── Schemas ───────────────────────────────────────────────────────────────

class DatastoreResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    model_name: str
    status: str
    error_message: Optional[str]
    metadata_info: Optional[dict]
    created_at: str

    class Config:
        from_attributes = True

class AskRequest(BaseModel):
    query: str

class SourceDocument(BaseModel):
    id: str
    name: str
    size: int
    type: str

class KnowledgePreset(BaseModel):
    id: str
    name: str
    description: str
    files: List[str]

# ─── Configurazione Presets ──────────────────────────────────────────────────

PRESETS = {
    "clinical_full": {
        "name": "Comprehensive Clinical Archive",
        "description": "Full diagnostic knowledge base combining ICD-11 CDDR, DSM-5-TR Cases, and mapped coding frameworks.",
        "files": ["ICD-11-CDDR.pdf", "DSM-5-TR_Clinical_Cases.txt", "ICD-11_joined.csv"]
    },
    "icd11_standard": {
        "name": "ICD-11 Diagnostic Guidelines",
        "description": "Strict focus on ICD-11 Clinical Descriptions and Diagnostic Requirements.",
        "files": ["ICD-11-CDDR.pdf", "ICD-11_joined.csv"]
    },
    "dsm5_cases": {
        "name": "DSM-5-TR Clinical Reference",
        "description": "Specialized archive of DSM-5-TR clinical case studies and discussions.",
        "files": ["DSM-5-TR_Clinical_Cases.txt"]
    }
}

# ─── Endpoints ─────────────────────────────────────────────────────────────

@router.get("/presets", response_model=List[KnowledgePreset])
async def list_presets():
    """
    Elenca i preset di conoscenza disponibili per la creazione di nuovi datastore.
    """
    return [
        KnowledgePreset(id=k, **v) for k, v in PRESETS.items()
    ]

@router.post("/create", response_model=DatastoreResponse)
async def create_datastore(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    model_name: str = Form(...),
    preset_id: str = Form(...),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Avvia la creazione asincrona di un nuovo datastore basato su un preset di conoscenza.
    """
    if preset_id not in PRESETS:
        raise HTTPException(status_code=404, detail=f"Preset {preset_id} not found")

    datastore_id = uuid.uuid4()
    preset = PRESETS[preset_id]
    
    # Verifica esistenza dei file sorgente nel preset
    docs_dir = Path(os.getenv("DATA_DIR", "/app/data")) / "original_docs"
    file_paths = []
    
    for filename in preset["files"]:
        p = docs_dir / filename
        if not p.exists():
            logger.warning(f"File {filename} defined in preset {preset_id} is missing on disk.")
        else:
            file_paths.append(str(p))

    if not file_paths:
        raise HTTPException(status_code=500, detail="No valid files found for this preset on the server.")

    # Creazione record nel DB
    new_datastore = Datastore(
        id=datastore_id,
        name=name,
        description=description or preset["description"],
        model_name=model_name,
        source_file=", ".join(preset["files"]),
        vector_path="",
        status="processing"
    )
    db.add(new_datastore)
    db.commit()
    db.refresh(new_datastore)

    # Avvio ingestion multi-file in background
    background_tasks.add_task(
        ingestion_service.create_datastore,
        datastore_id=datastore_id,
        file_paths=file_paths,
        model_name=model_name,
        db=SessionLocal()
    )

    return new_datastore

@router.get("/list", response_model=List[DatastoreResponse])
async def list_datastores(db: Session = Depends(get_db)):
    """
    Elenca tutti i datastore creati.
    """
    datastores = db.query(Datastore).order_by(Datastore.created_at.desc()).all()
    # Piccola conversione manuale per i tipi non serializzabili se necessario
    return datastores

@router.delete("/{datastore_id}")
async def delete_datastore(datastore_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Rimuove un datastore e i suoi file associati.
    """
    datastore = db.query(Datastore).filter(Datastore.id == datastore_id).first()
    if not datastore:
        raise HTTPException(status_code=404, detail="Datastore not found")

    # Rimozione file vector store
    if datastore.vector_path and os.path.exists(datastore.vector_path):
        shutil.rmtree(datastore.vector_path)

    # Rimozione file sorgente
    if datastore.source_file and os.path.exists(datastore.source_file):
        os.remove(datastore.source_file)

    db.delete(datastore)
    db.commit()
    return {"message": "Datastore deleted successfully"}

@router.post("/{datastore_id}/ask")
async def ask_datastore(
    datastore_id: uuid.UUID, 
    request: AskRequest, 
    db: Session = Depends(get_db)
):
    """
    Interroga un datastore specifico usando la logica RAG.
    """
    datastore = db.query(Datastore).filter(Datastore.id == datastore_id).first()
    if not datastore:
        raise HTTPException(status_code=404, detail="Datastore not found")
    if datastore.status != "ready":
        raise HTTPException(status_code=400, detail=f"Datastore is not ready (status: {datastore.status})")

    try:
        # Configurazione LangChain per questo specifico datastore
        embeddings = OllamaEmbeddings(
            model=datastore.model_name,
            base_url=settings.ollama_base_url
        )
        
        vectorstore = Chroma(
            persist_directory=datastore.vector_path,
            embedding_function=embeddings
        )

        llm = Ollama(
            model=datastore.model_name,
            base_url=settings.ollama_base_url,
            temperature=0.7
        )

        retriever = vectorstore.as_retriever()
        rag_prompt = hub.pull("rlm/rag-prompt")

        def format_docs(docs):
            return "\n\n".join(doc.page_content for doc in docs)

        qa_chain = (
            {"context": retriever | format_docs, "question": RunnablePassthrough()}
            | rag_prompt
            | llm
            | StrOutputParser()
        )

        answer = await qa_chain.ainvoke(request.query)
        return {"answer": answer, "model": datastore.model_name}

    except Exception as e:
        logger.error(f"Errore query RAG su datastore {datastore_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
