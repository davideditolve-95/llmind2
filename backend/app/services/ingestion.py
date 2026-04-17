"""
Servizio per l'ingestion dinamica di documenti in ChromaDB.
Supporta la creazione di datastore personalizzati con modelli Ollama specifici.
"""

import os
import logging
from typing import List, Optional
from uuid import UUID

from langchain_community.document_loaders import PDFPlumberLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_community.embeddings import OllamaEmbeddings
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models.datastore import Datastore
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class IngestionService:
    def __init__(self):
        self.data_dir = os.getenv("DATA_DIR", "/app/data")
        self.datastores_base_path = os.path.join(self.data_dir, "datastores")
        os.makedirs(self.datastores_base_path, exist_ok=True)

    async def create_datastore(
        self, 
        datastore_id: UUID, 
        file_paths: List[str], 
        model_name: str,
        db: Session
    ):
        """
        Processa una lista di file e crea un unico vector store associato.
        """
        datastore = db.query(Datastore).filter(Datastore.id == datastore_id).first()
        if not datastore:
            logger.error(f"Datastore {datastore_id} non trovato nel DB")
            return

        try:
            datastore.status = "processing"
            db.commit()

            all_docs = []
            total_size = 0

            # 1. Caricamento di tutti i documenti
            for file_path in file_paths:
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

            # 2. Splitting globale
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000, 
                chunk_overlap=150
            )
            splits = text_splitter.split_documents(all_docs)
            logger.info(f"Knowledge divisa in {len(splits)} chunks")

            # 3. Embedding & Salvataggio in Chroma
            vector_path = os.path.join(self.datastores_base_path, str(datastore_id))
            
            embeddings = OllamaEmbeddings(
                model=model_name,
                base_url=settings.ollama_base_url
            )

            logger.info(f"Inizializzazione Chroma in {vector_path} con model {model_name}...")
            vectorstore = Chroma.from_documents(
                documents=splits,
                embedding=embeddings,
                persist_directory=vector_path
            )

            # 4. Aggiornamento stato DB
            datastore.status = "ready"
            datastore.vector_path = vector_path
            datastore.metadata_info = {
                "chunks": len(splits),
                "source_files_count": len(file_paths),
                "total_size_bytes": total_size
            }
            db.commit()
            logger.info(f"Datastore {datastore.name} pronto con {len(file_paths)} sorgenti.")

        except Exception as e:
            logger.error(f"Errore durante l'ingestion multi-file del datastore {datastore_id}: {e}", exc_info=True)
            datastore.status = "failed"
            datastore.error_message = str(e)
            db.commit()

# Singleton
ingestion_service = IngestionService()
