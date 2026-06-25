import sys
sys.path.insert(0, '/app')
from sqlalchemy import create_engine, text
from app.config import get_settings

settings = get_settings()
engine = create_engine(settings.database_url)

with engine.connect() as conn:
    res = conn.execute(text("SELECT COUNT(*) FROM dsm5_categories WHERE icd11_code IS NOT NULL AND icd11_code != ''")).scalar()
    print(f"DSM-5 categories with icd11_code: {res}")
    
    res_both = conn.execute(text("SELECT COUNT(*) FROM dsm5_categories WHERE icd11_code IS NOT NULL AND icd11_code != '' AND icd10_code IS NOT NULL AND icd10_code != ''")).scalar()
    print(f"DSM-5 categories with both icd11 and icd10: {res_both}")
    
    if res_both > 0:
        samples = conn.execute(text("SELECT code, title, icd10_code, icd11_code FROM dsm5_categories WHERE icd11_code IS NOT NULL AND icd11_code != '' LIMIT 10")).fetchall()
        for s in samples:
            print(s)
            
        # Check how many icd11_categories we can map directly using this
        mapped_count = conn.execute(text("""
            SELECT COUNT(*) FROM icd11_categories i
            JOIN dsm5_categories d ON i.code = d.icd11_code
            WHERE d.icd10_code IS NOT NULL AND d.icd10_code != ''
        """)).scalar()
        print(f"Directly mapped icd11_categories: {mapped_count}")
