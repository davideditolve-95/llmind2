"""
Servizio per l'ingestion dinamica di documenti in ChromaDB.
Supporta la creazione di datastore personalizzati con modelli Ollama specifici.
"""

import asyncio
import os
import logging
from pathlib import Path
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models.datastore import Datastore
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _parse_icd11_nodes_count(file_path: str) -> int | None:
    """Extract the generated ICD-11 node count from the source header."""
    for line in Path(file_path).read_text(encoding="utf-8").splitlines()[:10]:
        if line.startswith("Nodes:"):
            return int(line.split(":", 1)[1].strip())
    return None


class IngestionService:
    def __init__(self):
        default_dir = os.getenv("DATA_DIR", "/app/data")
        try:
            os.makedirs(os.path.join(default_dir, "datastores"), exist_ok=True)
            self.data_dir = default_dir
        except OSError:
            self.data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
            os.makedirs(os.path.join(self.data_dir, "datastores"), exist_ok=True)
        self.datastores_base_path = os.path.join(self.data_dir, "datastores")

    def _update_progress(
        self,
        db: Session,
        datastore: Datastore,
        percent: int,
        stage: str,
        message: str,
    ):
        metadata = {
            **(datastore.metadata_info or {}),
            "progress_percent": max(0, min(100, percent)),
            "progress_stage": stage,
            "progress_message": message,
        }
        datastore.metadata_info = metadata
        db.commit()

    async def create_datastore(
        self, 
        datastore_id: UUID, 
        file_paths: List[str], 
        model_name: str,
        embedding_model_name: str,
        db: Session
    ):
        """
        Processa una lista di file e crea un unico vector store associato.
        """
        datastore = db.query(Datastore).filter(Datastore.id == datastore_id).first()
        if not datastore:
            logger.error(f"Datastore {datastore_id} non trovato nel DB")
            return

        from langchain_community.document_loaders import PDFPlumberLoader, TextLoader
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        from langchain_chroma import Chroma
        from langchain_community.embeddings import OllamaEmbeddings

        try:
            datastore.status = "processing"
            self._update_progress(
                db,
                datastore,
                5,
                "initializing",
                "Preparing source documents and vector-store workspace.",
            )

            all_docs = []
            total_size = 0

            # 1. Caricamento di tutti i documenti
            for index, file_path in enumerate(file_paths, start=1):
                self._update_progress(
                    db,
                    datastore,
                    10 + int((index - 1) / max(len(file_paths), 1) * 20),
                    "loading_sources",
                    f"Loading source {index} of {len(file_paths)}.",
                )
                logger.info(f"Caricamento documento: {file_path}")
                if not os.path.exists(file_path):
                    logger.warning(f"File non trovato: {file_path}, salto.")
                    continue
                
                total_size += os.path.getsize(file_path)
                
                try:
                    if file_path.lower().endswith('.pdf'):
                        loader = PDFPlumberLoader(file_path)
                    else:
                        loader = TextLoader(file_path)
                    
                    all_docs.extend(loader.load())
                except Exception as e:
                    logger.error(f"Impossibile caricare {file_path}: {e}")

            if not all_docs:
                raise ValueError("Nessun documento caricato con successo dai preset forniti.")

            logger.info(f"Totale documenti caricati: {len(all_docs)} pagine/sezioni")
            self._update_progress(
                db,
                datastore,
                30,
                "splitting",
                f"Loaded {len(all_docs)} document sections. Splitting text into retrieval chunks.",
            )

            # 2. Splitting globale
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000, 
                chunk_overlap=150
            )
            splits = text_splitter.split_documents(all_docs)
            logger.info(f"Knowledge divisa in {len(splits)} chunks")
            self._update_progress(
                db,
                datastore,
                45,
                "embedding",
                f"Generated {len(splits)} chunks. Sending them to OllamaEmbeddings with model {embedding_model_name}.",
            )

            # 3. Embedding & Salvataggio in Chroma
            vector_path = os.path.join(self.datastores_base_path, str(datastore_id))
            
            headers = {"Authorization": f"Bearer {settings.ollama_api_key}"} if settings.ollama_api_key else None

            embeddings = OllamaEmbeddings(
                model=embedding_model_name,
                base_url=settings.ollama_base_url,
                headers=headers,
            )

            logger.info(
                "Inizializzazione Chroma in %s con Ollama embedding model %s e chat model %s...",
                vector_path,
                embedding_model_name,
                model_name,
            )
            vectorstore = Chroma.from_documents(
                documents=splits,
                embedding=embeddings,
                persist_directory=vector_path
            )
            self._update_progress(
                db,
                datastore,
                85,
                "persisting",
                "Embeddings completed. Persisting Chroma vector store and metadata.",
            )

            # Parse nodes count if it is a generated scoped file
            icd11_nodes_count = None
            for file_path in file_paths:
                if "icd11_chapter_6_scope.txt" in file_path:
                    try:
                        icd11_nodes_count = await asyncio.to_thread(_parse_icd11_nodes_count, file_path)
                    except Exception as e:
                        logger.warning(f"Failed to parse nodes count: {e}")

            # 4. Aggiornamento stato DB
            datastore.status = "ready"
            datastore.vector_path = vector_path
            
            metadata = {
                **(datastore.metadata_info or {}),
                "embedding_model": embedding_model_name,
                "chat_model": model_name,
                "progress_percent": 100,
                "progress_stage": "ready",
                "progress_message": "Vector store ready.",
                "chunks": len(splits),
                "source_files_count": len(file_paths),
                "total_size_bytes": total_size
            }
            if icd11_nodes_count is not None:
                metadata["icd11_nodes_count"] = icd11_nodes_count
                
            datastore.metadata_info = metadata
            db.commit()
            logger.info(f"Datastore {datastore.name} pronto con {len(file_paths)} sorgenti.")

        except Exception as e:
            logger.error(f"Errore durante l'ingestion multi-file del datastore {datastore_id}: {e}", exc_info=True)
            datastore.status = "failed"
            error_message = str(e)
            if "does not support embeddings" in error_message or "--embeddings" in error_message:
                error_message = (
                    f"The selected Ollama/inference server does not expose embeddings for `{embedding_model_name}`. "
                    "Choose the same embedding model name you used manually in LLMind1, or leave the override empty "
                    "to use the main model for both embeddings and generation."
                )
            datastore.error_message = error_message
            datastore.metadata_info = {
                **(datastore.metadata_info or {}),
                "progress_percent": 100,
                "progress_stage": "failed",
                "progress_message": error_message,
            }
            db.commit()

# Singleton
ingestion_service = IngestionService()
