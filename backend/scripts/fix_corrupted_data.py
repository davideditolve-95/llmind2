"""
Script di utilità per correggere i dati corrotti (stuttering dei caratteri) nel database.
Esegue la deduplicazione dei caratteri raddoppiati causati da artefatti del PDF o da importazioni errate.
Copre sia i casi clinici (DSM-5) che le categorie ICD-11.
"""

import sys
import re
from pathlib import Path
import logging

# Aggiunge la directory root al path per i moduli condivisi
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models.benchmark import DSM5Case
from app.models.icd11 import ICD11Category
from scripts.utils.text_processing import de_stutter, de_stutter_case_number, de_stutter_list

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cleanup")

def cleanup_dsm5_cases(db: Session):
    """Pulisce la tabella dei casi clinici DSM-5."""
    cases = db.query(DSM5Case).all()
    logger.info(f"Analisi di {len(cases)} casi DSM-5...")
    
    fixed_count = 0
    for case in cases:
        modified = False
        
        # Titolo
        new_title = de_stutter(case.title)
        if case.title != new_title:
            case.title = new_title
            modified = True
            
        # Numero caso
        new_num = de_stutter_case_number(case.case_number)
        if case.case_number != new_num:
            case.case_number = new_num
            modified = True
            
        # Contenuto (Anamnesi, Discussione, Diagnosi)
        new_anamnesis = de_stutter(case.anamnesis)
        if case.anamnesis != new_anamnesis:
            case.anamnesis = new_anamnesis
            modified = True
            
        new_discussion = de_stutter(case.discussion)
        if case.discussion != new_discussion:
            case.discussion = new_discussion
            modified = True
            
        # Diagnosi: Stuttering + Troncamento robusto a markers di bibliografia
        old_diag = case.gold_standard_diagnosis
        if not old_diag:
            continue
            
        # 1. Pulisci lo stuttering
        current_diag = de_stutter(old_diag)
        
        # 2. Definisci i markers di troncamento (case-insensitive + varianti robuste)
        # Includiamo varianti con typo (es. "Sugested" con una sola 'g') e stuttering
        markers = [
            r"Sug{1,2}ested\s+Readings?", 
            r"References?", 
            r"Bibliography", 
            r"Further\s+Readings?",
            r"SSuug{1,4}eesstt[^\s]*\s+RReeaadd[^\s]*", # Stuttered variants
            r"RReeffeerr[^\s]*"
        ]
        
        # Unisci i markers in un'unica regex case-insensitive
        truncation_regex = re.compile("|".join(markers), re.IGNORECASE)
        
        # Suddividi e prendi solo la prima parte (la diagnosi reale)
        parts = truncation_regex.split(current_diag)
        new_diag = parts[0].strip()
        
        if old_diag != new_diag:
            case.gold_standard_diagnosis = new_diag
            modified = True
            logger.debug(f"Truncated diagnosis for case {case.case_number}")
            
        if modified:
            db.add(case)
            fixed_count += 1
            
    logger.info(f"Casi DSM-5 corretti: {fixed_count}")
    return fixed_count

def cleanup_icd11_categories(db: Session):
    """Pulisce la tabella delle categorie ICD-11 (inclusi campi JSONB)."""
    categories = db.query(ICD11Category).all()
    logger.info(f"Analisi di {len(categories)} categorie ICD-11...")
    
    fixed_count = 0
    for cat in categories:
        modified = False
        
        # Titoli
        new_title_en = de_stutter(cat.title_en)
        if cat.title_en != new_title_en:
            cat.title_en = new_title_en
            modified = True
            
        if cat.title_it:
            new_title_it = de_stutter(cat.title_it)
            if cat.title_it != new_title_it:
                cat.title_it = new_title_it
                modified = True
        
        # Descrizione e Criteri
        if cat.description:
            new_desc = de_stutter(cat.description)
            if cat.description != new_desc:
                cat.description = new_desc
                modified = True
                
        if cat.diagnostic_criteria:
            new_crit = de_stutter(cat.diagnostic_criteria)
            if cat.diagnostic_criteria != new_crit:
                cat.diagnostic_criteria = new_crit
                modified = True
                
        # Liste (JSONB)
        if cat.inclusions:
            new_inc = de_stutter_list(cat.inclusions)
            if cat.inclusions != new_inc:
                cat.inclusions = new_inc
                modified = True
                
        if cat.exclusions:
            new_exc = de_stutter_list(cat.exclusions)
            if cat.exclusions != new_exc:
                cat.exclusions = new_exc
                modified = True
                
        if cat.index_terms:
            new_idx = de_stutter_list(cat.index_terms)
            if cat.index_terms != new_idx:
                cat.index_terms = new_idx
                modified = True
                
        if modified:
            db.add(cat)
            fixed_count += 1
            
    logger.info(f"Categorie ICD-11 corrette: {fixed_count}")
    return fixed_count

def main():
    db: Session = SessionLocal()
    try:
        logger.info("Avvio pulizia globale dei dati...")
        
        c_count = cleanup_dsm5_cases(db)
        logger.info(f"--- Finito Casi DSM-5. Record modificati: {c_count}")
        
        i_count = cleanup_icd11_categories(db)
        logger.info(f"--- Finito Categorie ICD-11. Record modificati: {i_count}")
        
        if c_count > 0 or i_count > 0:
            db.commit()
            logger.info(f"\n✅ DB aggiornato con successo. Totale record corretti: {c_count + i_count}")
        else:
            logger.info("\n✨ Nessuna corruzione trovata. Il database è pulito.")
            
    except Exception as e:
        db.rollback()
        logger.error(f"Errore critico durante la pulizia: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
