import sys
sys.path.insert(0, '/app')
import asyncio
import json
from app.services.icd11_client import ICD11Client

async def main():
    client = ICD11Client()
    # Let's fetch the entity for "6A02" (ADHD) or "1A00" (Cholera)
    # The URI is usually like: http://id.who.int/icd/entity/821820574 (ADHD is 821820574 or similar)
    # Or we can search for ADHD or cholera
    print("Searching for ADHD...")
    results = await client.search("ADHD")
    if results:
        print(f"Search results: {len(results)}")
        for r in results[:3]:
            print(f"Title: {r.get('title')}, URI: {r.get('id')}, Code: {r.get('theCode')}")
            # Fetch the full entity
            uri = r.get('id')
            if uri:
                print(f"Fetching full entity for {uri}...")
                entity = await client.get_entity(uri)
                if entity:
                    # Print keys
                    print("Entity keys:", list(entity.keys()))
                    # Look for anything containing "mapping" or "crossReference" or "icd10"
                    for k, v in entity.items():
                        if "mapping" in k.lower() or "reference" in k.lower() or "icd10" in k.lower() or "cross" in k.lower():
                            print(f"Found key '{k}': {json.dumps(v)[:500]}...")
                            
if __name__ == "__main__":
    asyncio.run(main())
