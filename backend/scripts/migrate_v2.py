from sqlalchemy import text
import sys
import os

# Aggiungi il percorso del backend al path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal

def migrate():
    db = SessionLocal()
    try:
        print("Starting database migration...")
        
        # 1. Aggiunge batch_id a benchmark_runs
        print("Adding 'batch_id' column to 'benchmark_runs'...")
        db.execute(text("ALTER TABLE benchmark_runs ADD COLUMN IF NOT EXISTS batch_id UUID;"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_benchmark_runs_batch_id ON benchmark_runs (batch_id);"))
        
        # 2. Aggiunge system_prompt_used a benchmark_runs
        print("Adding 'system_prompt_used' column to 'benchmark_runs'...")
        db.execute(text("ALTER TABLE benchmark_runs ADD COLUMN IF NOT EXISTS system_prompt_used TEXT;"))
        
        db.commit()
        print("Migration completed successfully!")
    except Exception as e:
        print(f"Error during migration: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
