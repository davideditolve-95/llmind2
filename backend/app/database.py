"""
Configurazione del database SQLAlchemy.
Gestisce la connessione a PostgreSQL e la creazione delle sessioni.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import get_settings

settings = get_settings()

engine_kwargs = {
    "pool_pre_ping": True,       # Verifica la connessione prima dell'uso
    "echo": (settings.environment == "development"),  # Log SQL in sviluppo
}

if not settings.database_url.startswith("sqlite"):
    engine_kwargs["pool_size"] = 10             # Dimensione del pool di connessioni
    engine_kwargs["max_overflow"] = 20          # Connessioni aggiuntive oltre il pool
    engine_kwargs["connect_args"] = {"connect_timeout": 5}  # Evita hang indefiniti se il DB è offline/bloccato da firewall

# Crea l'engine SQLAlchemy per PostgreSQL
engine = create_engine(settings.database_url, **engine_kwargs)

# Factory per le sessioni del database
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base per tutti i modelli ORM
Base = declarative_base()


def get_db():
    """
    Dependency injection per FastAPI.
    Fornisce una sessione DB e garantisce la chiusura al termine della richiesta.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
