"""
Script per aggiornare i titoli dei casi DSM-5 nel database da 'Introduction'
ai nomi effettivi dei pazienti / descrizioni cliniche dei casi.
"""

import re
import logging
from app.database import SessionLocal
from app.models.benchmark import DSM5Case

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

STOP_WORDS = {
    'she', 'he', 'they', 'it', 'improvement', 'everything', 'for', 'although', 
    'this', 'after', 'prior', 'when', 'the', 'a', 'an', 'there', 'here', 'introduction'
}

def extract_patient_title(c: DSM5Case) -> str:
    text = c.anamnesis or ''
    # Rimuove intestazioni autori/medici tipo 'Carol A. Tamminga, M.D.'
    text_clean = re.sub(
        r'^(?:[A-Z][a-z\-]+(?:\s+[A-Z]\.|\s+[A-Z][a-z\-]+)*(?:,\s*(?:M\.D\.|Ph\.D\.|M\.P\.H\.|M\.B\.A\.|M\.R\.C\.Psych\.))*\s*)+',
        '', 
        text
    ).strip()

    # 1. Nome completo prima dell'età: 'Felicia Allen, a 32-year-old', 'Felicia Allen was a 32-year-old'
    m1 = re.search(r'\b([A-Z][a-z\-]+\s+[A-Z][a-z\-]+)\b(?:\s+(?:was|is))?,\s*(?:a|an)?\s*\d{1,2}[-\s]*year', text_clean)
    if m1 and m1.group(1).lower().strip() not in STOP_WORDS:
        name = m1.group(1).strip()
        if not any(w in name for w in ['Ph.D', 'M.D', 'Dr.', 'Professor']):
            return name

    # 2. Formato 'Mr. Evans', 'Ms. Gonzalez', 'Mrs. Estel'
    m2 = re.search(r'\b(Mr\.|Ms\.|Mrs\.|Dr\.)\s+([A-Z][a-z\-]+(?:\s+[A-Z][a-z\-]+)?)\b', text_clean)
    if m2 and m2.group(2).lower().strip() not in STOP_WORDS:
        return f"{m2.group(1)} {m2.group(2)}".strip()

    # 3. Nome singolo prima dell'età: 'Rachel, a 15-year-old', 'Ethan, a 10-year-old'
    m3 = re.search(r'\b([A-Z][a-z\-]+)\b,\s*(?:a|an)?\s*\d{1,2}[-\s]*year', text_clean)
    if m3 and m3.group(1).lower().strip() not in STOP_WORDS:
        return m3.group(1).strip()

    # 4. Estratto della diagnosi gold standard se il testo usa solo pronomi
    diag = (c.gold_standard_diagnosis or '').split('\n')[0].strip()
    diag_clean = re.sub(r'^\d+[\.\s\-]*', '', diag).strip()
    if diag_clean and len(diag_clean) > 3 and not diag_clean.lower().startswith('introduction'):
        return f"Caso Clinico: {diag_clean[:35]}"

    return f"Caso Clinico {c.case_number or 'DSM-5'}"

def run_migration():
    db = SessionLocal()
    try:
        cases = db.query(DSM5Case).all()
        logger.info(f"Trovati {len(cases)} casi DSM-5 nel database.")
        updated = 0
        for c in cases:
            current_title = (c.title or '').strip()
            if not current_title or current_title.lower() == 'introduction' or current_title.lower().startswith('case '):
                base_name = extract_patient_title(c)
                new_title = f"{base_name} (Caso {c.case_number})" if c.case_number and "Caso" not in base_name else base_name
                c.title = new_title
                updated += 1
                logger.info(f"Aggiornato Caso {c.case_number}: '{current_title}' -> '{new_title}'")

        db.commit()
        logger.info(f"Migrazione completata con successo! Aggiornati {updated} casi.")
    except Exception as e:
        db.rollback()
        logger.error(f"Errore durante la migrazione dei titoli: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()
