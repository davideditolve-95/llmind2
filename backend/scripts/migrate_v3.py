import sys
import os

from sqlalchemy import text

# Aggiungi il percorso del backend al path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import engine, Base
from app.models.benchmark import ManualEvaluation

def migrate():
    # 1. Crea la nuova tabella
    print("Creating 'manual_evaluations' table...")
    Base.metadata.create_all(bind=engine, tables=[ManualEvaluation.__table__])
    
    # 2. Rimuove le vecchie colonne dalla tabella benchmark_runs
    print("Dropping legacy 'human_rating' and 'human_notes' from 'benchmark_runs'...")
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE benchmark_runs DROP COLUMN IF EXISTS human_rating;"))
            conn.execute(text("ALTER TABLE benchmark_runs DROP COLUMN IF EXISTS human_notes;"))
            conn.commit()
            print("Legacy columns dropped successfully.")
        except Exception as e:
            print(f"Error dropping columns (they might not exist): {e}")

    print("Migration V3 (Multi-Evaluation) completed successfully!")

if __name__ == "__main__":
    migrate()
