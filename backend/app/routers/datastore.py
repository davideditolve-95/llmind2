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
from datetime import datetime
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db, SessionLocal
from ..models.datastore import Datastore
from ..models.icd11 import ICD11Category
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
    created_at: datetime

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

@router.get("/icd11-scope/options")
async def get_icd11_scope_options(db: Session = Depends(get_db)):
    """
    Ritorna le opzioni di ambito ICD-11 (capitolo 6 e le sue sezioni).
    """
    try:
        chapter = db.query(ICD11Category).filter(
            ICD11Category.level == 0,
            (ICD11Category.code == "06") | (ICD11Category.code == "6") | (ICD11Category.title_en.ilike("%mental%"))
        ).first()
        
        if not chapter:
            return {"chapter": None, "sections": []}
        
        sections = db.query(ICD11Category).filter(
            ICD11Category.parent_id == chapter.id
        ).order_by(ICD11Category.code).all()
        
        res_sections = []
        for sec in sections:
            children_count = db.query(ICD11Category).filter(
                ICD11Category.parent_id == sec.id
            ).count()
            
            res_sections.append({
                "id": str(sec.id),
                "code": sec.code,
                "title": sec.title_it or sec.title_en,
                "level": sec.level,
                "children_count": children_count
            })
            
        return {
            "chapter": {
                "id": str(chapter.id),
                "code": chapter.code,
                "title": chapter.title_it or chapter.title_en,
                "level": chapter.level,
                "children_count": len(sections)
            },
            "sections": res_sections
        }
    except Exception as e:
        logger.error(f"Errore recupero opzioni ambito ICD-11: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def get_descendants(db: Session, parent_ids: List[uuid.UUID]) -> List[ICD11Category]:
    results_map = {}
    current_ids = list(set(parent_ids))
    
    if current_ids:
        parents = db.query(ICD11Category).filter(ICD11Category.id.in_(current_ids)).all()
        for p in parents:
            results_map[p.id] = p
            
    while current_ids:
        children = db.query(ICD11Category).filter(ICD11Category.parent_id.in_(current_ids)).all()
        if not children:
            break
        next_ids = []
        for c in children:
            if c.id not in results_map:
                results_map[c.id] = c
                next_ids.append(c.id)
        current_ids = next_ids
        
    # Convert to list and sort by level, then code
    nodes_list = list(results_map.values())
    nodes_list.sort(key=lambda x: (x.level, x.code or ""))
    return nodes_list

def format_category_node(node: ICD11Category) -> str:
    parts = []
    code_str = node.code if node.code else "No code"
    parts.append(f"## {code_str} - {node.title_en}")
    parts.append(f"Level: {node.level}")
    if node.description:
        parts.append(f"Description: {node.description}")
        
    def format_json_field(val):
        if not val:
            return ""
        if isinstance(val, list):
            return "; ".join(str(x) for x in val)
        if isinstance(val, dict):
            return "; ".join(f"{k}: {v}" for k, v in val.items())
        return str(val)

    if node.inclusions:
        parts.append(f"Inclusions: {format_json_field(node.inclusions)}")
    if node.exclusions:
        parts.append(f"Exclusions: {format_json_field(node.exclusions)}")
    if node.index_terms:
        parts.append(f"Index terms: {format_json_field(node.index_terms)}")
    if node.diagnostic_criteria:
        parts.append(f"Diagnostic criteria: {node.diagnostic_criteria}")
        
    return "\n".join(parts) + "\n\n"

@router.post("/create", response_model=DatastoreResponse)
async def create_datastore(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    model_name: str = Form(...),
    preset_id: str = Form(...),
    description: Optional[str] = Form(None),
    icd_scope: Optional[str] = Form(None),
    icd_section_ids: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Avvia la creazione asincrona di un nuovo datastore basato su un preset di conoscenza.
    """
    datastore_id = uuid.uuid4()
    
    if preset_id == "icd11_standard" and icd_scope:
        # Recupera capitolo 6
        chapter = db.query(ICD11Category).filter(
            ICD11Category.level == 0,
            (ICD11Category.code == "06") | (ICD11Category.code == "6") | (ICD11Category.title_en.ilike("%mental%"))
        ).first()
        
        if not chapter:
            raise HTTPException(status_code=400, detail="ICD-11 chapter 6 not found in database. Please run the ETL first.")
            
        if icd_scope == "chapter_6":
            nodes = get_descendants(db, [chapter.id])
        elif icd_scope == "sections" and icd_section_ids:
            try:
                section_ids = [uuid.UUID(x.strip()) for x in icd_section_ids.split(",") if x.strip()]
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid section IDs format")
            nodes = get_descendants(db, section_ids)
        else:
            nodes = get_descendants(db, [chapter.id])
            
        if not nodes:
            raise HTTPException(status_code=400, detail="No ICD-11 categories found for the specified scope")
            
        # Genera il file di testo
        gen_dir = Path(os.getenv("DATA_DIR", "/app/data")) / "generated_datastore_sources" / str(datastore_id)
        gen_dir.mkdir(parents=True, exist_ok=True)
        gen_file_path = gen_dir / "icd11_chapter_6_scope.txt"
        
        with open(gen_file_path, "w", encoding="utf-8") as f:
            f.write(f"# ICD-11 Chapter 6 scoped datastore source\n\n")
            f.write(f"Scope: {icd_scope}\n")
            f.write(f"Chapter: {chapter.code or '06'} {chapter.title_en}\n")
            f.write(f"Nodes: {len(nodes)}\n\n")
            
            for node in nodes:
                f.write(format_category_node(node))
                
        file_paths = [str(gen_file_path)]
        source_file = str(gen_file_path)
        description = description or f"ICD-11 Chapter 6 scoped datastore ({icd_scope}) with {len(nodes)} nodes."
    else:
        if preset_id not in PRESETS:
            raise HTTPException(status_code=404, detail=f"Preset {preset_id} not found")
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
            
        source_file = ", ".join(preset["files"])
        description = description or preset["description"]

    # Creazione record nel DB
    new_datastore = Datastore(
        id=datastore_id,
        name=name,
        description=description,
        model_name=model_name,
        source_file=source_file,
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
        headers = {"Authorization": f"Bearer {settings.ollama_api_key}"} if settings.ollama_api_key else None

        # Configurazione LangChain per questo specifico datastore
        embeddings = OllamaEmbeddings(
            model=datastore.model_name,
            base_url=settings.ollama_base_url,
            headers=headers
        )
        
        vectorstore = Chroma(
            persist_directory=datastore.vector_path,
            embedding_function=embeddings
        )

        llm = Ollama(
            model=datastore.model_name,
            base_url=settings.ollama_base_url,
            temperature=0.7,
            headers=headers
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
