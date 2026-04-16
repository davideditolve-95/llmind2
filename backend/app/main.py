"""
Punto di ingresso principale dell'applicazione FastAPI.
Configura i router, il middleware CORS, e l'inizializzazione del database.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from .database import engine, Base
from .routers import icd11 as router_icd11
from .routers import chat as router_chat
from .routers import cases as router_cases
from .routers import benchmark as router_benchmark
from .config import get_settings

# Importa tutti i modelli per assicurarsi che vengano registrati prima di create_all
from .models import icd11 as icd11_model  # noqa: F401
from .models import benchmark as benchmark_model  # noqa: F401
from .models import chat as chat_model  # noqa: F401

settings = get_settings()

# Configurazione del logging
logging.basicConfig(
    level=logging.INFO if settings.environment == "production" else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Creazione dell'applicazione FastAPI
app = FastAPI(
    title="ICD-11 Explorer & Clinical AI API",
    description="API backend per l'esplorazione ICD-11, il chatbot clinico e il benchmarking universitario",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Middleware CORS — permette al frontend Next.js di comunicare col backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://frontend:3000",
        "*",  # Da restringere in produzione Coolify all'URL del dominio specifico
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """
    Evento di avvio: crea le tabelle del database e sincronizza lo schema se necessario.
    """
    logger.info("Avvio del backend ICD-11 Explorer...")
    
    # ─── Sincronizzazione automatica schema Chat (UUID Fix) ──────────────────
    from sqlalchemy import inspect, text
    import sqlalchemy
    
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        logger.info(f"Tabelle rilevate: {tables}")
        
        needs_reset = False
        
        # 1. Se chat_sessions manca ma chat_history esiste (vecchio schema)
        if "chat_history" in tables and "chat_sessions" not in tables:
            logger.warning("MISMATCH: chat_history esiste ma chat_sessions manca. Reset necessario.")
            needs_reset = True
            
        # 2. Se chat_history esiste, controlla il tipo di session_id
        elif "chat_history" in tables:
            columns = inspector.get_columns("chat_history")
            session_id_col = next((c for c in columns if c['name'] == 'session_id'), None)
            
            if session_id_col:
                type_str = str(session_id_col['type']).upper()
                logger.info(f"Tipo colonna session_id rilevato: {type_str}")
                
                # Se non è UUID (o è VARCHAR/TEXT/altro retaggio)
                if "UUID" not in type_str:
                    logger.warning(f"MISMATCH: session_id è {type_str}, atteso UUID. Reset necessario.")
                    needs_reset = True
            else:
                logger.warning("MISMATCH: colonna session_id mancante in chat_history. Reset necessario.")
                needs_reset = True

        if needs_reset:
            logger.info(">>> ESECUZIONE RESET FORZATO TABELLE CHAT PER SINCRONIZZAZIONE SCHEMA <<<")
            from sqlalchemy import text
            with engine.connect() as conn:
                # CASCADE è fondamentale per rimuovere dipendenze FK
                conn.execute(text("DROP TABLE IF EXISTS chat_history CASCADE"))
                conn.execute(text("DROP TABLE IF EXISTS chat_sessions CASCADE"))
                conn.commit()
            logger.info(">>> Reset completato con successo. Le tabelle verranno ricreate ora. <<<")

    except Exception as e:
        logger.error(f"Errore critico ispezione schema: {e}", exc_info=True)

    # Crea tutte le tabelle (incluse quelle appena rimosse, con lo schema corretto)
    Base.metadata.create_all(bind=engine)
    logger.info("Inizializzazione schema database completata.")


# ─── Registrazione dei router ──────────────────────────────────────────────
app.include_router(router_icd11.router)
app.include_router(router_chat.router)
app.include_router(router_cases.router)
app.include_router(router_benchmark.router)


# ─── Endpoint di utilità ───────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Endpoint di health check per Docker e Coolify."""
    return {
        "status": "healthy",
        "service": "llmind2-backend",
        "version": "1.0.0",
        "ollama_url": settings.ollama_base_url,
        "environment": settings.environment,
    }


@app.get("/")
async def root():
    """Endpoint radice — reindirizza alla documentazione."""
    return {
        "message": "ICD-11 Explorer & Clinical AI API",
        "docs": "/docs",
        "health": "/health",
    }
