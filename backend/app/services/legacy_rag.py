"""
Servizio per il supporto del legacy llmind-v1.
Gestisce il setup del RAG con ChromaDB e Ollama (gemma2:27b).
"""

import os
import shutil
import csv
import time
import asyncio
import logging
from typing import Dict, Any, Optional, List
from langchain_chroma import Chroma
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.llms import Ollama
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain import hub

from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class LegacyRAGService:
    """
    Servizio che replica la logica di llmind-v1.
    Utilizza ChromaDB come datastore e gemma2:27b come LLM.
    """

    def __init__(self):
        # Percorso del vectorstore (montato in /app/data nel container)
        self.data_dir = os.getenv("DATA_DIR", "/app/data")
        self.persist_directory = os.path.join(
            self.data_dir, "vectorstore_legacy", "chroma_db-full-gemma227b"
        )
        self.model_name = "gemma2:27b"
        self._vectorstore = None
        self._qa_chain = None

    def _initialize(self):
        """Inizializza il vectorstore e la chain RAG se non ancora pronti."""
        if self._qa_chain:
            return

        logger.info(f"Inizializzazione Legacy RAG con model {self.model_name}...")
        
        try:
            # Configura gli embeddings (stessi parametri della v1)
            embeddings = OllamaEmbeddings(
                model=self.model_name,
                base_url=settings.ollama_base_url
            )

            # Carica il vectorstore
            if not os.path.exists(self.persist_directory):
                logger.error(f"Legacy vectorstore non trovato in {self.persist_directory}")
                raise FileNotFoundError(f"Vectorstore not found at {self.persist_directory}")

            self._vectorstore = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=embeddings
            )

            # Inizializza l'LLM
            llm = Ollama(
                model=self.model_name,
                base_url=settings.ollama_base_url,
                temperature=0.7
            )

            # Recuperatore
            retriever = self._vectorstore.as_retriever()

            # Prompt RAG (pull dal hub come nella v1)
            rag_prompt = hub.pull("rlm/rag-prompt")

            def format_docs(docs):
                return "\n\n".join(doc.page_content for doc in docs)

            # Costruzione della chain
            self._qa_chain = (
                {"context": retriever | format_docs, "question": RunnablePassthrough()}
                | rag_prompt
                | llm
                | StrOutputParser()
            )
            
            logger.info("Legacy RAG inizializzato con successo.")
            
        except Exception as e:
            logger.error(f"Errore durante l'inizializzazione del Legacy RAG: {e}")
            raise

    async def ask(self, input_string: str) -> str:
        """
        Esegue una query al sistema legacy RAG.
        Simula l'endpoint /askLLM della v1.
        """
        self._initialize()
        
        try:
            # Esecuzione sincrona in un executor per non bloccare FastAPI
            import asyncio
            from functools import partial
            
            loop = asyncio.get_event_loop()
            answer = await loop.run_in_executor(
                None, 
                partial(self._qa_chain.invoke, input_string)
            )
            
            # Post-processing (rimozione newline come nella v1)
            return answer.replace("\n", " ").strip()
            
        except Exception as e:
            logger.error(f"Errore durante l'esecuzione della query legacy: {e}")
            return f"[Errore Legacy RAG: {str(e)}]"
    async def run_batch(self, csv_filename: str) -> str:
        """
        Esegue il batch processing di un CSV di casi clinici.
        Simula il comportamento di v1/src/app.py.
        """
        self._initialize()
        
        input_path = os.path.join(self.data_dir, "original_docs", csv_filename)
        output_dir = os.path.join(self.data_dir, "output", "legacy_runs")
        os.makedirs(output_dir, exist_ok=True)
        
        output_filename = f"legacy_answers_{int(time.time())}.csv"
        output_path = os.path.join(output_dir, output_filename)
        log_path = os.path.join(self.data_dir, "legacy_log.txt")
        
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Source CSV {csv_filename} not found")

        def _log(msg):
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")

        def _process():
            _log(f"Starting legacy batch run for {csv_filename}...")
            try:
                with open(input_path, "r", encoding="utf-8") as infile, \
                     open(output_path, "w", encoding="utf-8", newline="") as outfile:
                    
                    # Usa § come delimitatore come nella v1 se possibile, altrimenti tenta di indovinare
                    reader = csv.reader(infile, delimiter="§")
                    writer = csv.writer(outfile, delimiter="§")
                    
                    header = next(reader, None)
                    writer.writerow(["row", "question", "answer"])
                    
                    for i, row in enumerate(reader, 1):
                        case_text = row[1] if len(row) > 1 else row[0]
                        question = f"Based on the ICD-11, make a diagnosis for this case: {case_text}"
                        
                        _log(f"Processing row {i}...")
                        # Invocazione sincrona
                        answer = self._qa_chain.invoke(question)
                        clean_answer = answer.replace("\n", " ").strip()
                        
                        writer.writerow([i, question, clean_answer])
                
                _log(f"Batch run completed. Output saved to {output_filename}")
            except Exception as e:
                _log(f"Error during batch run: {str(e)}")
                raise

        # Esegue in un thread separato
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _process)
        return output_filename

    def get_logs(self, limit: int = 100) -> List[str]:
        """Ritorna le ultime righe del log legacy."""
        log_path = os.path.join(self.data_dir, "legacy_log.txt")
        if not os.path.exists(log_path):
            return ["Log file not found."]
        
        with open(log_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            return lines[-limit:]

# Istanza singleton
legacy_rag_service = LegacyRAGService()
