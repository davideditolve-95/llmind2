"""
Router per la gestione dei Datastore personalizzati.
Espone endpoint per il caricamento documenti, la gestione e l'interrogazione RAG.
"""

import asyncio
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
    },
    "aifa_drugs": {
        "name": "AIFA Italian Medicines & Indications",
        "description": "Comprehensive reference of Italian medicines, active ingredients, and indications mapped to ICD-10.",
        "files": ["aifa_drugs_indications.txt"]
    }
}

# ─── Endpoints ─────────────────────────────────────────────────────────────

def get_icd11_chapter_6(db: Session) -> Optional[ICD11Category]:
    """
    Return the ICD-11 chapter used by the research vector stores.

    Keep this lookup deterministic: a previous fuzzy match on "mental" also
    matched "Developmental anomalies" because of the substring "developMENTAL".
    """
    chapter = (
        db.query(ICD11Category)
        .filter(ICD11Category.level == 0, ICD11Category.code == "06")
        .first()
    )
    if chapter:
        return chapter

    chapter = (
        db.query(ICD11Category)
        .filter(ICD11Category.level == 0, ICD11Category.code == "6")
        .first()
    )
    if chapter:
        return chapter

    return (
        db.query(ICD11Category)
        .filter(
            ICD11Category.level == 0,
            ICD11Category.title_en.ilike("Mental, behavioural%")
        )
        .first()
    )

@router.get("/presets", response_model=List[KnowledgePreset])
async def list_presets():
    """
    Elenca i preset di conoscenza disponibili per la creazione di nuovi datastore.
    """
    return [
        KnowledgePreset(id=k, **v) for k, v in PRESETS.items()
    ]

DEFAULT_CHAPTER_6_SECTIONS = [
    {"id": "6A0", "code": "6A0", "title": "Neurodevelopmental disorders", "level": 1, "children_count": 12},
    {"id": "6A2", "code": "6A2", "title": "Schizophrenia or other primary psychotic disorders", "level": 1, "children_count": 8},
    {"id": "6A6", "code": "6A6", "title": "Mood disorders", "level": 1, "children_count": 15},
    {"id": "6A7", "code": "6A7", "title": "Anxiety or fear-related disorders", "level": 1, "children_count": 10},
    {"id": "6B0", "code": "6B0", "title": "Obsessive-compulsive or related disorders", "level": 1, "children_count": 6},
    {"id": "6B2", "code": "6B2", "title": "Disorders specifically associated with stress", "level": 1, "children_count": 7},
    {"id": "6B4", "code": "6B4", "title": "Dissociative disorders", "level": 1, "children_count": 5},
    {"id": "6B8", "code": "6B8", "title": "Feeding or eating disorders", "level": 1, "children_count": 6},
    {"id": "6C0", "code": "6C0", "title": "Elimination disorders", "level": 1, "children_count": 3},
    {"id": "6C2", "code": "6C2", "title": "Disorders of bodily distress or bodily experience", "level": 1, "children_count": 4},
    {"id": "6C4", "code": "6C4", "title": "Disorders due to substance use or addictive behaviours", "level": 1, "children_count": 14},
    {"id": "6C7", "code": "6C7", "title": "Impulse control disorders", "level": 1, "children_count": 5},
    {"id": "6D1", "code": "6D1", "title": "Disruptive behaviour or dissocial disorders", "level": 1, "children_count": 4},
    {"id": "6D3", "code": "6D3", "title": "Personality disorders and related traits", "level": 1, "children_count": 8},
    {"id": "6D5", "code": "6D5", "title": "Paraphilic disorders", "level": 1, "children_count": 7},
    {"id": "6D7", "code": "6D7", "title": "Factitious disorders", "level": 1, "children_count": 2},
    {"id": "6E0", "code": "6E0", "title": "Neurocognitive disorders", "level": 1, "children_count": 9},
    {"id": "6E2", "code": "6E2", "title": "Mental disorders associated with pregnancy or childbirth", "level": 1, "children_count": 3},
]

@router.get("/icd11-scope/options")
async def get_icd11_scope_options(db: Session = Depends(get_db)):
    """
    Ritorna le opzioni di ambito ICD-11 (capitolo 6 e le sue sezioni).
    """
    try:
        chapter = get_icd11_chapter_6(db)
        
        sections = []
        if chapter:
            db_sections = db.query(ICD11Category).filter(
                ICD11Category.parent_id == chapter.id
            ).order_by(ICD11Category.code).all()
            
            for sec in db_sections:
                children_count = db.query(ICD11Category).filter(
                    ICD11Category.parent_id == sec.id
                ).count()
                
                sections.append({
                    "id": str(sec.id),
                    "code": sec.code,
                    "title": sec.title_it or sec.title_en,
                    "level": sec.level,
                    "children_count": children_count
                })
        
        if not sections:
            sections = DEFAULT_CHAPTER_6_SECTIONS
            
        chapter_info = {
            "id": str(chapter.id) if chapter else "chapter_6",
            "code": chapter.code if chapter else "06",
            "title": (chapter.title_it or chapter.title_en) if chapter else "Mental, behavioural or neurodevelopmental disorders",
            "level": chapter.level if chapter else 0,
            "children_count": len(sections)
        }
            
        return {
            "chapter": chapter_info,
            "sections": sections
        }
    except Exception as e:
        logger.error(f"Errore recupero opzioni ambito ICD-11: {e}")
        return {
            "chapter": {
                "id": "chapter_6",
                "code": "06",
                "title": "Mental, behavioural or neurodevelopmental disorders",
                "level": 0,
                "children_count": len(DEFAULT_CHAPTER_6_SECTIONS)
            },
            "sections": DEFAULT_CHAPTER_6_SECTIONS
        }

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
    embedding_model_name: Optional[str] = Form(None),
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
    section_ids: list[uuid.UUID] = []
    normalized_scope = icd_scope or "chapter_6"
    normalized_embedding_model = (embedding_model_name or model_name).strip()
    chapter_metadata = None
    selected_section_labels: list[str] = []
    
    if preset_id == "icd11_standard" and icd_scope:
        # Recupera capitolo 6
        chapter = get_icd11_chapter_6(db)
        
        if not chapter:
            raise HTTPException(status_code=400, detail="ICD-11 chapter 6 not found in database. Please run the ETL first.")

        chapter_sections_count = db.query(ICD11Category).filter(
            ICD11Category.parent_id == chapter.id
        ).count()
        chapter_metadata = {
            "code": chapter.code or "06",
            "title": chapter.title_it or chapter.title_en,
            "children_count": chapter_sections_count,
        }
            
        if icd_scope == "chapter_6":
            nodes = get_descendants(db, [chapter.id])
        elif icd_scope == "sections" and icd_section_ids:
            try:
                section_ids = [uuid.UUID(x.strip()) for x in icd_section_ids.split(",") if x.strip()]
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid section IDs format")
            selected_sections = db.query(ICD11Category).filter(ICD11Category.id.in_(section_ids)).all()
            selected_section_labels = [
                f"{section.code or 'No code'} - {section.title_it or section.title_en}"
                for section in sorted(selected_sections, key=lambda item: item.code or "")
            ]
            nodes = get_descendants(db, section_ids)
        else:
            nodes = get_descendants(db, [chapter.id])
            
        if not nodes:
            raise HTTPException(status_code=400, detail="No ICD-11 categories found for the specified scope")
            
        # Genera il file di testo
        gen_dir = Path(os.getenv("DATA_DIR", "/app/data")) / "generated_datastore_sources" / str(datastore_id)
        gen_dir.mkdir(parents=True, exist_ok=True)
        gen_file_path = gen_dir / "icd11_chapter_6_scope.txt"
        
        generated_source = [
            "# ICD-11 Chapter 6 scoped datastore source\n",
            f"Scope: {icd_scope}",
            f"Chapter: {chapter.code or '06'} {chapter.title_en}",
            f"Nodes: {len(nodes)}\n",
        ]
        generated_source.extend(format_category_node(node) for node in nodes)
        await asyncio.to_thread(
            gen_file_path.write_text,
            "\n".join(generated_source),
            encoding="utf-8",
        )
                
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
        status="processing",
        metadata_info={
            "preset_id": preset_id,
            "icd_scope": normalized_scope,
            "icd_chapter": chapter_metadata,
            "icd_section_ids": sorted(str(section_id) for section_id in section_ids),
            "icd_section_labels": selected_section_labels,
            "embedding_model": normalized_embedding_model,
            "chat_model": model_name,
            "config_key": f"{preset_id}:{model_name}:{normalized_embedding_model}:{normalized_scope}:{','.join(sorted(str(section_id) for section_id in section_ids))}",
        }
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
        embedding_model_name=normalized_embedding_model,
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
        from langchain_chroma import Chroma
        from langchain_community.embeddings import OllamaEmbeddings
        from langchain_community.llms import Ollama
        from langchain_core.output_parsers import StrOutputParser
        from langchain_core.runnables import RunnablePassthrough
        from langchain import hub

        from ..services.embeddings import get_langchain_embeddings_instance, LocalSentenceTransformerEmbeddings

        embedding_model = datastore.metadata_info.get("embedding_model") if datastore.metadata_info else None
        target_embedding_model = embedding_model or datastore.model_name
        embeddings = get_langchain_embeddings_instance(target_embedding_model)

        try:
            vectorstore = Chroma(
                persist_directory=datastore.vector_path,
                embedding_function=embeddings
            )
        except Exception as emb_err:
            logger.warning(f"Ollama embedding query failed ({emb_err}). Falling back to LocalSentenceTransformerEmbeddings...")
            embeddings = LocalSentenceTransformerEmbeddings(settings.embedding_model)
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

        answer = await asyncio.get_event_loop().run_in_executor(
            None,
            qa_chain.invoke,
            request.query,
        )
        return {"answer": answer.replace("\n", " ").strip(), "model": datastore.model_name}

    except Exception as e:
        logger.error(f"Errore query RAG su datastore {datastore_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
