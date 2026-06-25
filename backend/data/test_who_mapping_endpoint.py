import sys
sys.path.insert(0, '/app')
import asyncio
import httpx
from app.config import get_settings

async def main():
    settings = get_settings()
    base_url = settings.icd11_api_url
    
    # 257068234 is Cholera (1A00)
    urls = [
        f"{base_url}/icd/release/11/2026-01/mms/mapping/257068234",
        f"{base_url}/icd/release/11/2026-01/mms/257068234/mapping",
        f"{base_url}/icd/release/11/2026-01/mms/mapping?id=257068234",
        f"{base_url}/icd/entity/257068234/mapping",
        f"{base_url}/icd/entity/mapping/257068234",
        f"{base_url}/icd/release/11/2026-01/mms/mapping",
        f"{base_url}/icd/release/11/mms/mapping/257068234",
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
                    print("  Success! Keys:", list(data.keys()))
                    print("  Snippet:", str(data)[:500])
                    break
            except Exception as e:
                print(f"  Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
