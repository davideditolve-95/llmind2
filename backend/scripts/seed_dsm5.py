"""
Script per il seeding delle categorie principali del DSM-5 con relative equivalenze ICD-11 e ICD-10.

USO:
    docker compose exec backend python scripts/seed_dsm5.py
"""

import sys
import logging
from pathlib import Path

# Aggiunge la directory root al path per i moduli condivisi
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models.dsm5 import DSM5Category

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Definizione dei disturbi principali del DSM-5 da pre-popolare
CORE_DSM5_CATEGORIES = [
    # 1. Neurodevelopmental Disorders
    {
        "code": "F90.2",
        "title": "Attention-Deficit/Hyperactivity Disorder (Combined Presentation)",
        "chapter": "Neurodevelopmental Disorders",
        "icd10_code": "314.01",
        "icd11_code": "6A05",
        "diagnostic_criteria": None  # Verrà estratto dal PDF al volo o aggiornato
    },
    {
        "code": "F90.0",
        "title": "Attention-Deficit/Hyperactivity Disorder (Predominantly Inattentive Presentation)",
        "chapter": "Neurodevelopmental Disorders",
        "icd10_code": "314.00",
        "icd11_code": "6A05.0",
        "diagnostic_criteria": None
    },
    {
        "code": "F84.0",
        "title": "Autism Spectrum Disorder",
        "chapter": "Neurodevelopmental Disorders",
        "icd10_code": "299.00",
        "icd11_code": "6A02",
        "diagnostic_criteria": None
    },
    # 2. Schizophrenia Spectrum and Other Psychotic Disorders
    {
        "code": "F20.9",
        "title": "Schizophrenia",
        "chapter": "Schizophrenia Spectrum and Other Psychotic Disorders",
        "icd10_code": "295.90",
        "icd11_code": "6A20",
        "diagnostic_criteria": None
    },
    # 3. Bipolar and Related Disorders
    {
        "code": "F31.9",
        "title": "Bipolar I Disorder",
        "chapter": "Bipolar and Related Disorders",
        "icd10_code": "296.40",
        "icd11_code": "6A60",
        "diagnostic_criteria": None
    },
    # 4. Depressive Disorders
    {
        "code": "F33.1",
        "title": "Major Depressive Disorder, Recurrent, Moderate",
        "chapter": "Depressive Disorders",
        "icd10_code": "296.32",
        "icd11_code": "6A71",
        "diagnostic_criteria": None
    },
    # 5. Anxiety Disorders
    {
        "code": "F41.1",
        "title": "Generalized Anxiety Disorder",
        "chapter": "Anxiety Disorders",
        "icd10_code": "300.02",
        "icd11_code": "6B00",
        "diagnostic_criteria": None
    },
    {
        "code": "F41.0",
        "title": "Panic Disorder",
        "chapter": "Anxiety Disorders",
        "icd10_code": "300.01",
        "icd11_code": "6B01",
        "diagnostic_criteria": None
    },
    # 6. Obsessive-Compulsive and Related Disorders
    {
        "code": "F42",
        "title": "Obsessive-Compulsive Disorder",
        "chapter": "Obsessive-Compulsive and Related Disorders",
        "icd10_code": "300.3",
        "icd11_code": "6B20",
        "diagnostic_criteria": None
    },
    # 7. Trauma- and Stressor-Related Disorders
    {
        "code": "F43.10",
        "title": "Posttraumatic Stress Disorder",
        "chapter": "Trauma- and Stressor-Related Disorders",
        "icd10_code": "309.81",
        "icd11_code": "6B40",
        "diagnostic_criteria": None
    },
    # 8. Personality Disorders
    {
        "code": "F60.3",
        "title": "Borderline Personality Disorder",
        "chapter": "Personality Disorders",
        "icd10_code": "301.83",
        "icd11_code": "6D10",
        "diagnostic_criteria": None
    }
]

def seed_dsm5():
    logger.info("Avvio seeding DSM-5...")
    db: Session = SessionLocal()
    try:
        # Assicuriamoci che la tabella esista (create_all viene invocata anche qui per sicurezza)
        Base.metadata.create_all(bind=engine)
        
        inserted_count = 0
        updated_count = 0
        
        for item in CORE_DSM5_CATEGORIES:
            existing = db.query(DSM5Category).filter(DSM5Category.code == item["code"]).first()
            if existing:
                # Aggiorna se già presente
                existing.title = item["title"]
                existing.chapter = item["chapter"]
                existing.parent_category = item["title"]
                existing.variant_label = None
                existing.severity = None
                existing.icd10_code = item["icd10_code"]
                existing.icd11_code = item["icd11_code"]
                updated_count += 1
            else:
                new_cat = DSM5Category(
                    code=item["code"],
                    title=item["title"],
                    chapter=item["chapter"],
                    parent_category=item["title"],
                    variant_label=None,
                    severity=None,
                    icd10_code=item["icd10_code"],
                    icd11_code=item["icd11_code"],
                    diagnostic_criteria=item["diagnostic_criteria"]
                )
                db.add(new_cat)
                inserted_count += 1
                
        db.commit()
        logger.info(f"Seeding completato: {inserted_count} record inseriti, {updated_count} aggiornati.")
    except Exception as e:
        db.rollback()
        logger.error(f"Errore durante il seeding: {e}", exc_info=True)
    finally:
        db.close()

if __name__ == "__main__":
    seed_dsm5()
