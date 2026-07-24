"""
Punto di ingresso principale dell'applicazione FastAPI.
Configura i router, il middleware CORS, e l'inizializzazione del database.
"""

from fastapi import FastAPI
from fastapi import Depends
from fastapi.middleware.cors import CORSMiddleware
import logging
from sqlalchemy import inspect, text

from .database import engine, Base
from .routers import icd11 as router_icd11
from .routers import chat as router_chat
from .routers import cases as router_cases
from .routers import benchmark as router_benchmark
from .routers import legacy as router_legacy
from .routers import datastore as router_datastore
from .routers import vectorstore as router_vectorstore
from .routers import system as router_system
from .routers import gcp_agents as router_gcp_agents
from .routers import patient as router_patient
from .routers import dsm5 as router_dsm5
from .routers import drugs as router_drugs
from .config import get_settings
from .services.auth import verify_token


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


def _chat_schema_needs_reset(inspector, tables: list[str]) -> bool:
    if "chat_history" in tables and "chat_sessions" not in tables:
        logger.warning("MISMATCH: chat_history esiste ma chat_sessions manca. Reset necessario.")
        return True

    if "chat_history" in tables:
        columns = inspector.get_columns("chat_history")
        session_id_col = next((column for column in columns if column["name"] == "session_id"), None)
        if not session_id_col:
            logger.warning("MISMATCH: colonna session_id mancante in chat_history. Reset necessario.")
            return True

        type_str = str(session_id_col["type"]).upper()
        logger.info(f"Tipo colonna session_id rilevato: {type_str}")
        if "UUID" not in type_str:
            logger.warning(f"MISMATCH: session_id è {type_str}, atteso UUID. Reset necessario.")
            return True

    if "chat_sessions" in tables:
        cs_columns = [column["name"] for column in inspector.get_columns("chat_sessions")]
        required_columns = {"user_email", "is_pinned", "is_starred"}
        if not required_columns.issubset(cs_columns):
            logger.warning("MISMATCH: Colonne di chat_sessions non aggiornate. Reset necessario.")
            return True

    return False


def _reset_chat_tables() -> None:
    logger.info(">>> ESECUZIONE RESET FORZATO TABELLE CHAT PER SINCRONIZZAZIONE SCHEMA <<<")
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS chat_history CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS chat_sessions CASCADE"))
        conn.commit()
    logger.info(">>> Reset completato con successo. Le tabelle verranno ricreate ora. <<<")


def _add_missing_columns(table_name: str, additions: dict[str, str]) -> None:
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    if table_name not in tables:
        return

    existing_columns = [column["name"] for column in inspector.get_columns(table_name)]
    missing_columns = [
        (name, ddl_type)
        for name, ddl_type in additions.items()
        if name not in existing_columns
    ]
    if not missing_columns:
        return

    logger.info(f"Aggiornamento schema {table_name}: aggiungo {missing_columns}")
    with engine.connect() as conn:
        for name, ddl_type in missing_columns:
            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {name} {ddl_type}"))
        conn.commit()


def _sync_chat_schema() -> None:
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    logger.info(f"Tabelle rilevate: {tables}")

    if _chat_schema_needs_reset(inspector, tables):
        _reset_chat_tables()


def _ensure_chat_patient_column() -> None:
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    if "chat_sessions" not in tables:
        return

    cs_columns = [column["name"] for column in inspector.get_columns("chat_sessions")]
    if "patient_id" in cs_columns:
        return

    logger.info("Aggiornamento schema chat_sessions: aggiungo patient_id")
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN patient_id UUID REFERENCES patients(id) ON DELETE SET NULL"))
        conn.commit()


def _sync_benchmark_schema() -> None:
    _add_missing_columns(
        "benchmark_runs",
        {
            "label_accuracy": "DOUBLE PRECISION",
            "precision_score": "DOUBLE PRECISION",
            "recall_score": "DOUBLE PRECISION",
            "f1_score": "DOUBLE PRECISION",
            "no_diagnosis": "BOOLEAN DEFAULT FALSE NOT NULL",
        },
    )


def _sync_dsm5_schema() -> None:
    _add_missing_columns(
        "dsm5_categories",
        {
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
        },
    )
    _ensure_dsm5_code_index_is_not_unique()


def _ensure_dsm5_code_index_is_not_unique() -> None:
    inspector = inspect(engine)
    if "dsm5_categories" not in inspector.get_table_names():
        return

    indexes = inspector.get_indexes("dsm5_categories")
    code_index = next((idx for idx in indexes if idx["name"] == "ix_dsm5_categories_code"), None)
    if not code_index or not code_index.get("unique"):
        return

    logger.info("Aggiornamento schema dsm5_categories: rendo non univoco l'indice code")
    with engine.connect() as conn:
        conn.execute(text("DROP INDEX IF EXISTS ix_dsm5_categories_code"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_dsm5_categories_code ON dsm5_categories (code)"))
        conn.commit()


def _sync_icd11_icd10_column() -> None:
    _add_missing_columns("icd11_categories", {"icd10_code": "VARCHAR"})


def _align_icd10_codes() -> None:
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    if "icd11_categories" not in tables or "dsm5_categories" not in tables:
        return

    logger.info("Inizio allineamento automatico icd10_code in icd11_categories...")
    with engine.connect() as conn:
        result = conn.execute(text("""
            UPDATE icd11_categories i
            SET icd10_code = d.icd10_code
            FROM dsm5_categories d
            WHERE i.code = d.icd11_code
              AND (i.icd10_code IS NULL OR i.icd10_code = '')
              AND d.icd10_code IS NOT NULL
              AND d.icd10_code != ''
        """))
        conn.commit()
    logger.info(f"Allineamento completato: {result.rowcount} codici ICD-10 associati alle categorie ICD-11.")


def _run_schema_step(label: str, action) -> None:
    try:
        action()
    except Exception:
        logger.exception(f"Errore durante {label}")

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

    _run_schema_step("sincronizzazione schema chat", _sync_chat_schema)
    # Crea tutte le tabelle (incluse quelle appena rimosse, con lo schema corretto)
    Base.metadata.create_all(bind=engine)
    _run_schema_step("aggiunta patient_id a chat_sessions", _ensure_chat_patient_column)
    _run_schema_step("sincronizzazione schema benchmark", _sync_benchmark_schema)
    _run_schema_step("sincronizzazione schema DSM-5", _sync_dsm5_schema)
    _run_schema_step("aggiunta colonna icd10_code", _sync_icd11_icd10_column)
    _run_schema_step("allineamento codici ICD-10", _align_icd10_codes)

    logger.info("Inizializzazione schema database completata.")



app.include_router(router_icd11.router)  # Rimane pubblico per la home page
app.include_router(router_chat.router, dependencies=[Depends(verify_token)])
app.include_router(router_cases.router, dependencies=[Depends(verify_token)])
app.include_router(router_benchmark.router, dependencies=[Depends(verify_token)])
app.include_router(router_legacy.router, dependencies=[Depends(verify_token)])
app.include_router(router_vectorstore.router, dependencies=[Depends(verify_token)])
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
