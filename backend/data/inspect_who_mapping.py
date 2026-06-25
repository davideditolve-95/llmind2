import sys
sys.path.insert(0, '/app')
import asyncio
import json
from sqlalchemy import create_engine, text
from app.config import get_settings
from app.services.icd11_client import ICD11Client

async def main():
    settings = get_settings()
    engine = create_engine(settings.database_url)
    client = ICD11Client()
    
    # Get some sample foundation URIs
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT code, title_en, foundation_uri FROM icd11_categories WHERE code IS NOT NULL AND code != '' LIMIT 10")).fetchall()
        
    for code, title, uri in rows:
        print(f"\nCode: {code}, Title: {title}, URI: {uri}")
        if uri:
            entity = await client.get_entity(uri)
            if entity:
                print("Entity keys:", list(entity.keys()))
                # Check for mapping or reference fields
                for k, v in entity.items():
                    if "mapping" in k.lower() or "reference" in k.lower() or "icd10" in k.lower() or "cross" in k.lower():
                        print(f"  Found key '{k}': {json.dumps(v)[:300]}...")
            else:
                print("  Failed to fetch entity.")

if __name__ == "__main__":
    asyncio.run(main())
