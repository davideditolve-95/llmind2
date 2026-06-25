import sys
sys.path.insert(0, '/app')
from simple_icd_11 import ICDExplorer

explorer = ICDExplorer(
    language="en", 
    clientId="", 
    clientSecret="", 
    customUrl="http://icd11-api/"
)

# Let's get an entity for a well-known code, e.g. "6A02" (Autism Spectrum Disorder)
try:
    entity = explorer.getEntityFromCode("6A02")
    if entity:
        print("Entity methods and properties:")
        for attr in dir(entity):
            if not attr.startswith("__"):
                print(f"  {attr}")
                
        # Let's try some methods
        print("\nTrying methods on entity 6A02:")
        try:
            print("  Title:", entity.getTitle())
        except Exception as e:
            print("  getTitle failed:", e)
            
        try:
            # Let's see if there is any method containing "map" or "icd10" or "reference"
            for attr in dir(entity):
                if any(x in attr.lower() for x in ["map", "icd10", "reference", "cross"]):
                    val = getattr(entity, attr)
                    if callable(val):
                        try:
                            print(f"  {attr}() -> {val()}")
                        except Exception as e:
                            print(f"  {attr}() failed: {e}")
                    else:
                        print(f"  {attr} = {val}")
        except Exception as e:
            print("  Attribute scanning failed:", e)
            
except Exception as e:
    print("Error:", e)
