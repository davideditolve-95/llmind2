import sys
sys.path.insert(0, '/app')

from sqlalchemy import create_engine, text
from app.config import get_settings

settings = get_settings()
db_url = settings.database_url
print(f"Connecting to: {db_url}")
try:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        res = conn.execute(text("SELECT COUNT(*) FROM icd11_categories")).scalar()
        print(f"Total categories: {res}")
        if res > 0:
            sample = conn.execute(text("SELECT code, title_en, level FROM icd11_categories LIMIT 5")).fetchall()
            print("Sample categories:")
            for s in sample:
                print(s)
except Exception as e:
    print("Error:", e)
