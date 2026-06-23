import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.benchmark import DSM5Case

db = SessionLocal()
cases = db.query(DSM5Case).all()
print(f"Total cases: {len(cases)}")

for c in cases[:10]:
    print(f"Case {c.case_number} (ID: {c.id})")
    print(f"  Anamnesis start: {c.anamnesis[:120]!r}")
    print(f"  Discussion start: {c.discussion[:120]!r}")
    print(f"  Diagnosis start: {c.gold_standard_diagnosis[:120]!r}")
    print("-" * 50)
db.close()
