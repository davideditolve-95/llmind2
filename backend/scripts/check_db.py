from sqlalchemy import create_url
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
import os
import sys

# Aggiungi il percorso del backend al path
sys.path.append('/Users/davide/Documents/repos/llmind2/backend')

from app.database import SessionLocal
from app.models.benchmark import DSM5Case

def check_cases():
    db = SessionLocal()
    try:
        count = db.query(DSM5Case).count()
        print(f"TOTAL CASES IN DB: {count}")
    finally:
        db.close()

if __name__ == "__main__":
    check_cases()
