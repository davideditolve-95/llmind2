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
from .routers import legacy as router_legacy
from .routers import datastore as router_datastore
from .routers import system as router_system
from .routers import gcp_agents as router_gcp_agents
from .routers import patient as router_patient
from .routers import dsm5 as router_dsm5
from .routers import drugs as router_drugs
from .config import get_settings


# Importa tutti i modelli per assicurarsi che vengano registrati prima di create_all
from .models import icd11 as icd11_model  # noqa: F401
from .models import benchmark as benchmark_model  # noqa: F401
from .models import chat as chat_model  # noqa: F401
from .models import datastore as datastore_model  # noqa: F401
from .models import patient as patient_model  # noqa: F401
from .models import dsm5 as dsm5_model  # noqa: F401
from .models import drugs as drugs_model  # noqa: F401


settings = get_settings()
cors_allowed_origins = [
    origin.strip()
    for origin in settings.cors_allowed_origins.split(",")
    if origin.strip()
]

# Configurazione del logging
from .services.logs import log_handler
logging.basicConfig(
    level=logging.INFO if settings.environment == "production" else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        log_handler
    ]
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
    allow_origins=cors_allowed_origins,
    allow_origin_regex=settings.cors_allowed_origin_regex or None,
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

        # 3. Controlla le colonne di chat_sessions per i nuovi campi (user_email, is_pinned, is_starred)
        if not needs_reset and "chat_sessions" in tables:
            cs_columns = [c['name'] for c in inspector.get_columns("chat_sessions")]
            if "user_email" not in cs_columns or "is_pinned" not in cs_columns or "is_starred" not in cs_columns:
                logger.warning("MISMATCH: Colonne di chat_sessions non aggiornate (manca user_email, is_pinned, o is_starred). Reset necessario.")
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

    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        if "chat_sessions" in tables:
            cs_columns = [c['name'] for c in inspector.get_columns("chat_sessions")]
            if "patient_id" not in cs_columns:
                logger.info("Aggiornamento schema chat_sessions: aggiungo patient_id")
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN patient_id UUID REFERENCES patients(id) ON DELETE SET NULL"))
                    conn.commit()
    except Exception as e:
        logger.error(f"Errore aggiunta colonna patient_id a chat_sessions: {e}", exc_info=True)

    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        if "benchmark_runs" in tables:
            benchmark_columns = [c["name"] for c in inspector.get_columns("benchmark_runs")]
            benchmark_additions = {
                "label_accuracy": "DOUBLE PRECISION",
                "precision_score": "DOUBLE PRECISION",
                "recall_score": "DOUBLE PRECISION",
                "f1_score": "DOUBLE PRECISION",
                "no_diagnosis": "BOOLEAN DEFAULT FALSE NOT NULL",
            }

            missing_columns = [
                (name, ddl_type)
                for name, ddl_type in benchmark_additions.items()
                if name not in benchmark_columns
            ]
            if missing_columns:
                logger.info(f"Aggiornamento schema benchmark_runs: aggiungo {missing_columns}")
                with engine.connect() as conn:
                    for name, ddl_type in missing_columns:
                        conn.execute(text(f"ALTER TABLE benchmark_runs ADD COLUMN {name} {ddl_type}"))
                    conn.commit()
    except Exception as e:
        logger.error(f"Errore sincronizzazione schema benchmark: {e}", exc_info=True)

    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        if "dsm5_categories" in tables:
            dsm5_columns = [c["name"] for c in inspector.get_columns("dsm5_categories")]
            dsm5_indexes = inspector.get_indexes("dsm5_categories")
            dsm5_additions = {
                "parent_category": "TEXT",
                "variant_label": "TEXT",
                "severity": "VARCHAR(50)",
                "sort_order": "INTEGER",
                "diagnostic_features": "TEXT",
                "prevalence": "TEXT",
                "development_and_course": "TEXT",
                "risk_and_prognostic_factors": "TEXT",
                "culture_related_issues": "TEXT",
                "sex_gender_related_issues": "TEXT",
                "functional_consequences": "TEXT",
                "differential_diagnosis": "TEXT",
                "comorbidity": "TEXT",
            }

            missing_columns = [
                (name, ddl_type)
                for name, ddl_type in dsm5_additions.items()
                if name not in dsm5_columns
            ]
            if missing_columns:
                logger.info(f"Aggiornamento schema dsm5_categories: aggiungo {missing_columns}")
                with engine.connect() as conn:
                    for name, ddl_type in missing_columns:
                        conn.execute(text(f"ALTER TABLE dsm5_categories ADD COLUMN {name} {ddl_type}"))
                    conn.commit()

            code_index = next((idx for idx in dsm5_indexes if idx["name"] == "ix_dsm5_categories_code"), None)
            if code_index and code_index.get("unique"):
                logger.info("Aggiornamento schema dsm5_categories: rendo non univoco l'indice code")
                with engine.connect() as conn:
                    conn.execute(text("DROP INDEX IF EXISTS ix_dsm5_categories_code"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_dsm5_categories_code ON dsm5_categories (code)"))
                    conn.commit()
    except Exception as e:
        logger.error(f"Errore sincronizzazione schema DSM-5: {e}", exc_info=True)

    # ─── Allineamento automatico codici ICD-10 in icd11_categories ───────────
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        if "icd11_categories" in tables:
            icd11_columns = [c["name"] for c in inspector.get_columns("icd11_categories")]
            if "icd10_code" not in icd11_columns:
                logger.info("Aggiunta colonna icd10_code a icd11_categories...")
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE icd11_categories ADD COLUMN icd10_code VARCHAR"))
                    conn.commit()

        if "icd11_categories" in tables and "dsm5_categories" in tables:
            logger.info("Inizio allineamento automatico icd10_code in icd11_categories...")
            with engine.connect() as conn:
                res = conn.execute(text("""
                    UPDATE icd11_categories i
                    SET icd10_code = d.icd10_code
                    FROM dsm5_categories d
                    WHERE i.code = d.icd11_code 
                      AND (i.icd10_code IS NULL OR i.icd10_code = '')
                      AND d.icd10_code IS NOT NULL 
                      AND d.icd10_code != ''
                """))
                conn.commit()
                logger.info(f"Allineamento completato: {res.rowcount} codici ICD-10 associati alle categorie ICD-11.")
    except Exception as e:
        logger.error(f"Errore durante l'allineamento dei codici ICD-10: {e}", exc_info=True)

    logger.info("Inizializzazione schema database completata.")



# ─── Registrazione dei router ──────────────────────────────────────────────
from .services.auth import verify_token
from fastapi import Depends

app.include_router(router_icd11.router)  # Rimane pubblico per la home page
app.include_router(router_chat.router, dependencies=[Depends(verify_token)])
app.include_router(router_cases.router, dependencies=[Depends(verify_token)])
app.include_router(router_benchmark.router, dependencies=[Depends(verify_token)])
app.include_router(router_legacy.router, dependencies=[Depends(verify_token)])
app.include_router(router_datastore.router, dependencies=[Depends(verify_token)])
app.include_router(router_system.router, dependencies=[Depends(verify_token)])
app.include_router(router_gcp_agents.router, dependencies=[Depends(verify_token)])
app.include_router(router_patient.router, dependencies=[Depends(verify_token)])
app.include_router(router_dsm5.router, dependencies=[Depends(verify_token)])
app.include_router(router_drugs.router, dependencies=[Depends(verify_token)])



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
