import sys
sys.path.insert(0, '/app')
import asyncio
import httpx
from app.config import get_settings

async def main():
    settings = get_settings()
    base_url = settings.icd11_api_url
    
    # We will try several URLs on the local container for mapping 6A02 or 1A00
    urls = [
        f"{base_url}/icd/release/11/mms/6A02",
        f"{base_url}/icd/release/11/mms/6A02.0",
        f"{base_url}/icd/release/11/mms/1A00",
        f"{base_url}/icd/release/11/mms/mapping/6A02",
        f"{base_url}/icd/release/11/mms/mapping/1A00",
    ]
    
    headers = {
        "Accept": "application/json",
        "Accept-Language": "en",
        "API-Version": "v2",
    }
    
    async with httpx.AsyncClient(timeout=5.0) as client:
        for url in urls:
            print(f"\nTrying: {url}")
            try:
                res = await client.get(url, headers=headers)
                print(f"  Status: {res.status_code}")
                if res.status_code == 200:
                    data = res.json()
                    print("  Keys:", list(data.keys()))
                    # Look for anything containing "icd10" or "mapping" or "reference" in keys or values
                    for k, v in data.items():
                        if "map" in k.lower() or "reference" in k.lower() or "icd10" in k.lower():
                            print(f"    Key '{k}': {str(v)[:300]}")
            except Exception as e:
                print(f"  Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
