"""
Script per l'estrazione dei casi clinici dal PDF del DSM-5-TR (Barnhill).

USO:
    docker compose exec backend python scripts/extract_dsm5_cases.py --pdf-path /app/data/dsm5_cases.pdf
    python scripts/extract_dsm5_cases.py --pdf-path ./data/dsm5_cases.pdf --dry-run

Lo script:
1. Legge il PDF del manuale DSM-5-TR Clinical Cases usando pdfplumber
2. Identifica i confini dei casi tramite pattern regex e euristiche testuali
3. Divide ogni caso nelle 3 sezioni: Anamnesis, Discussion, Diagnosis
4. Carica i casi nel database PostgreSQL (casi dubbi marcati is_reviewed=False)
5. Genera un report di qualità dell'estrazione
"""

import sys
import re
import argparse
import logging
from pathlib import Path
from typing import Optional
import uuid
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

import pdfplumber
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models.benchmark import DSM5Case
from scripts.utils.text_processing import de_stutter, de_stutter_case_number

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ─── Pattern per il riconoscimento delle sezioni ──────────────────────────────

# Titoli dei casi (tipicamente "Case X.X: Title" o "CASE XX")
CASE_TITLE_PATTERNS = [
    re.compile(r"^\s*Case\s+(\d+(?:\.\d+)?)[:\s]+(.+)$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*CASE\s+(\d+(?:\.\d+)?)\s*$", re.MULTILINE),
    re.compile(r"^\s*Clinical\s+Case\s+(\d+(?:\.\d+)?)[:\s]+(.+)$", re.IGNORECASE | re.MULTILINE),
    # Pattern più flessibile per casi senza numero esplicito o con nomi in maiuscolo
    re.compile(r"^\s*(?:Case|CASE)\s+(\d+(?:\.\d*)?)(.*)$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*(?:Case|CASE)\s+Study\s+(\d+(?:\.\d*)?)(.*)$", re.IGNORECASE | re.MULTILINE),
    # Pattern per gestire l'artefatto di "bolding" del PDF (es. "CCaassee 11..33")
    re.compile(r"^\s*(?:C|CC)(?:a|aa)(?:s|ss)(?:e|ee)\s+(\d+(?:\.\.?\d+)?)(.*)$", re.IGNORECASE | re.MULTILINE),
]

# Marcatori di inizio sezione Anamnesi
ANAMNESIS_MARKERS = [
    "History and Mental Status",
    "Psychiatric History",
    "History of Present Illness",
    "Clinical Presentation",
    "Chief Complaint",
    "Presenting Complaints",
    "Patient History",
    "Background",
    "Case Description",
    "HH i s t o r y", # Spaced stutter
    "HHiissttoorryy", # Normal stutter
]

# Marcatori di inizio sezione Discussione
DISCUSSION_MARKERS = [
    "Discussion",
    "Clinical Discussion",
    "Diagnostic Discussion",
    "Commentary",
    "Analysis",
    "DDiissccuussssiioonn", # Artefatto PDF
    "D D i s c u s s i o n", # Spaced stutter
]

# Marcatori di inizio sezione Diagnosi (Gold Standard)
DIAGNOSIS_MARKERS = [
    "Diagnosis",
    "DSM-5 Diagnosis",
    "DSM-5-TR Diagnosis",
    "ICD-11 Diagnosis",
    "Final Diagnosis",
    "Diagnoses",
    "Diagnostic Conclusion",
    "DDiiaaggnnoossiiss", # Artefatto PDF
    "DDiiaaggnnoosseess", # Artefatto PDF plural
    "D D i a g n o s i s", # Spaced stutter
]


def extract_text_from_pdf(pdf_path: str) -> list[dict]:
    """
    Estrae il testo da ogni pagina del PDF con metadati di pagina.
    Restituisce una lista di dizionari con testo e numero di pagina.
    """
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        logger.info(f"PDF aperto: {len(pdf.pages)} pagine trovate")
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text()
            if text:
                pages.append({
                    "page": page_num,
                    "text": text,
                })
    return pages


def find_section_boundary(text: str, markers: list[str]) -> int:
    """
    Trova la posizione del primo marcatore di sezione trovato nel testo.
    Restituisce -1 se nessun marcatore viene trovato.
    """
    best_pos = -1
    for marker in markers:
        # Cerca il marcatore come intestazione di paragrafo (inizio riga o con punteggiatura)
        pattern = re.compile(
            rf"^\s*{re.escape(marker)}\s*[:\n]",
            re.IGNORECASE | re.MULTILINE,
        )
        match = pattern.search(text)
        if match:
            if best_pos == -1 or match.start() < best_pos:
                best_pos = match.start()
    return best_pos


def split_case_into_sections(case_text: str) -> dict:
    """
    Divide il testo di un caso clinico nelle 3 sezioni fondamentali.
    
    Strategia:
    1. Cerca prima il marcatore di Diagnosi (in fondo)
    2. Poi cerca il marcatore di Discussione (nel mezzo)
    3. Tutto ciò che precede è l'Anamnesi
    
    Restituisce un dizionario con:
    - anamnesis: testo dell'anamnesi
    - discussion: testo della discussione
    - gold_standard_diagnosis: testo della diagnosi (Gold Standard)
    - confidence: float 0–1 indicante la confidenza della suddivisione
    """
    result = {
        "anamnesis": "",
        "discussion": "",
        "gold_standard_diagnosis": "",
        "confidence": 1.0,
        "uncertain": False,
    }
    
    # Cerca la posizione della sezione Diagnosi
    diag_pos = find_section_boundary(case_text, DIAGNOSIS_MARKERS)
    
    # Cerca la posizione della sezione Discussione
    disc_pos = find_section_boundary(case_text, DISCUSSION_MARKERS)
    
    # Cerca la posizione della sezione Anamnesi (potrebbe non esserci un marcatore esplicito)
    anam_pos = find_section_boundary(case_text, ANAMNESIS_MARKERS)
    
    if diag_pos > 0 and disc_pos > 0 and disc_pos < diag_pos:
        # Caso ideale: trovate tutte e 3 le sezioni nell'ordine corretto
        start_anam = anam_pos if anam_pos > 0 else 0
        result["anamnesis"] = case_text[start_anam:disc_pos].strip()
        result["discussion"] = case_text[disc_pos:diag_pos].strip()
        result["gold_standard_diagnosis"] = case_text[diag_pos:].strip()
        result["confidence"] = 0.9
        
    elif diag_pos > 0 and disc_pos < 0:
        # Solo diagnosi trovata: tutto ciò che precede è anamnesi + discussione combinata
        result["anamnesis"] = case_text[:diag_pos].strip()
        result["discussion"] = ""
        result["gold_standard_diagnosis"] = case_text[diag_pos:].strip()
        result["confidence"] = 0.6
        result["uncertain"] = True
        
    elif disc_pos > 0 and diag_pos < 0:
        # Solo discussione trovata, nessuna diagnosi esplicita
        result["anamnesis"] = case_text[:disc_pos].strip()
        result["discussion"] = case_text[disc_pos:].strip()
        result["gold_standard_diagnosis"] = ""
        result["confidence"] = 0.5
        result["uncertain"] = True
        
    else:
        # Nessun marcatore trovato: tutto il testo nell'anamnesi
        result["anamnesis"] = case_text.strip()
        result["confidence"] = 0.2
        result["uncertain"] = True
    
    # Pulizia delle sezioni: rimuovi intestazioni ripetute e de-stuttering
    for key in ["anamnesis", "discussion", "gold_standard_diagnosis"]:
        result[key] = clean_section_text(result[key])
        result[key] = de_stutter(result[key])

    # Rimuovi "Suggested Readings" e tutto ciò che segue dalla diagnosi
    diag = result["gold_standard_diagnosis"]
    if diag:
        # Markers comuni di fine diagnosi / inizio bibliografia
        markers = [
            r"Sug{1,2}ested\s+Readings?", 
            r"References?", 
            r"Bibliography", 
            r"Further\s+Readings?",
            r"SSuug{1,4}eesstt[^\s]*\s+RReeaadd[^\s]*", 
            r"RReeffeerr[^\s]*"
        ]
        trunc_regex = re.compile("|".join(markers), re.IGNORECASE)
        result["gold_standard_diagnosis"] = trunc_regex.split(diag)[0].strip()
            
    return result


def clean_section_text(text: str) -> str:
    """
    Pulisce il testo di una sezione rimuovendo artefatti del PDF.
    - Rimuove numeri di pagina isolati
    - Normalizza spazi e newline
    - Rimuove header/footer ripetuti
    """
    if not text:
        return ""
    
    lines = text.split("\n")
    cleaned_lines = []
    
    for line in lines:
        stripped = line.strip()
        
        # Ignora righe che sono solo numeri (numeri di pagina)
        if re.match(r"^\d+$", stripped):
            continue
        
        # Ignora righte molto corte che potrebbero essere artefatti
        if len(stripped) < 3 and stripped not in [".", "-", "•"]:
            continue
        
        cleaned_lines.append(line)
    
    # Normalizza i newline multipli consecutivi
    result = "\n".join(cleaned_lines)
    result = re.sub(r"\n{3,}", "\n\n", result)
    
    return result.strip()


def find_cases_in_pages(pages: list[dict]) -> list[dict]:
    """
    Identifica i confini dei casi clinici nel testo multipagina.
    Restituisce una lista di dizionari con testo e metadati di ogni caso.
    """
    # Concatena tutto il testo con marcatori di pagina
    full_text_parts = []
    page_map = []  # Mappa posizione → numero di pagina
    
    current_pos = 0
    for page in pages:
        text = page["text"]
        full_text_parts.append(text)
        page_map.append((current_pos, current_pos + len(text), page["page"]))
        current_pos += len(text) + 1  # +1 per il newline separatore
    
    full_text = "\n".join(full_text_parts)
    
    # Trova tutte le occorrenze di titoli di casi
    case_positions = []
    for pattern in CASE_TITLE_PATTERNS:
        for match in pattern.finditer(full_text):
            raw_case_num = match.group(1)
            # De-stuttering del numero caso e del titolo
            case_number = de_stutter_case_number(raw_case_num)
            case_title = match.group(2).strip() if len(match.groups()) > 1 else f"Case {case_number}"
            case_title = de_stutter(case_title)
                     
            # Determina il numero di pagina
            page_num = 1
            for start, end, pg in page_map:
                if start <= match.start() < end:
                    page_num = pg
                    break
            
            case_positions.append({
                "position": match.start(),
                "case_number": case_number,
                "title": case_title,
                "page": page_num,
            })
    
    # Rimuovi duplicati e ordina per posizione
    seen_positions = set()
    unique_positions = []
    for pos in sorted(case_positions, key=lambda x: x["position"]):
        if pos["position"] not in seen_positions:
            seen_positions.add(pos["position"])
            unique_positions.append(pos)
    
    logger.info(f"Trovati {len(unique_positions)} casi clinici nel PDF")
    
    # Estrai il testo di ogni caso (dall'inizio del caso al prossimo caso)
    cases = []
    for i, case_info in enumerate(unique_positions):
        start = case_info["position"]
        end = unique_positions[i + 1]["position"] if i + 1 < len(unique_positions) else len(full_text)
        case_text = full_text[start:end]
        
        cases.append({
            "case_number": case_info["case_number"],
            "title": case_info["title"],
            "page": case_info["page"],
            "raw_text": case_text,
        })
    
    return cases


def save_cases_to_db(cases_data: list[dict], db: Session, dry_run: bool = False) -> dict:
    """
    Salva i casi estratti nel database.
    Usa il numero caso come chiave per evitare duplicati.
    Restituisce statistiche sull'importazione.
    """
    stats = {
        "total": len(cases_data),
        "saved": 0,
        "skipped": 0,
        "uncertain": 0,
        "errors": 0,
    }
    
    for case_data in cases_data:
        try:
            # Dividi in sezioni
            sections = split_case_into_sections(case_data["raw_text"])
            
            # Segnala casi incerti
            if sections["uncertain"]:
                stats["uncertain"] += 1
                logger.warning(
                    f"Caso {case_data['case_number']} ({case_data['title'][:50]}): "
                    f"suddivisione incerta (confidenza: {sections['confidence']:.1f})"
                )
            
            if dry_run:
                logger.info(
                    f"[DRY RUN] Caso {case_data['case_number']}: '{case_data['title'][:60]}'"
                    f" | Anamnesi: {len(sections['anamnesis'])} chars"
                    f" | Discussione: {len(sections['discussion'])} chars"
                    f" | Diagnosi: {len(sections['gold_standard_diagnosis'])} chars"
                )
                stats["saved"] += 1
                continue
            
            # Controlla se il caso esiste già (upsert per numero caso)
            existing = db.query(DSM5Case).filter(
                DSM5Case.case_number == case_data["case_number"]
            ).first()
            
            if existing:
                logger.info(f"Caso {case_data['case_number']} già presente — aggiornamento")
                existing.title = case_data["title"]
                existing.anamnesis = sections["anamnesis"]
                existing.discussion = sections["discussion"]
                existing.gold_standard_diagnosis = sections["gold_standard_diagnosis"]
                existing.is_reviewed = not sections["uncertain"]
                existing.source_page = case_data["page"]
                existing.updated_at = datetime.utcnow()
                db.commit()
                stats["skipped"] += 1
            else:
                # Crea nuovo caso
                new_case = DSM5Case(
                    id=uuid.uuid4(),
                    case_number=case_data["case_number"],
                    title=case_data["title"],
                    anamnesis=sections["anamnesis"],
                    discussion=sections["discussion"],
                    gold_standard_diagnosis=sections["gold_standard_diagnosis"],
                    source_page=case_data["page"],
                    # Casi incerti vengono marcati per revisione manuale
                    is_reviewed=not sections["uncertain"],
                    review_notes=(
                        f"Estrazione automatica — confidenza: {sections['confidence']:.0%}"
                        if sections["uncertain"] else None
                    ),
                )
                db.add(new_case)
                db.commit()
                stats["saved"] += 1
                
        except Exception as e:
            logger.error(f"Errore salvataggio caso {case_data.get('case_number', '?')}: {e}")
            db.rollback()
            stats["errors"] += 1
    
    return stats


def main():
    parser = argparse.ArgumentParser(
        description="Estrae casi clinici dal PDF DSM-5-TR e li carica nel database"
    )
    parser.add_argument(
        "--pdf-path",
        type=str,
        required=True,
        help="Percorso al file PDF del DSM-5-TR",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Esegui senza salvare nel database (solo preview)",
    )
    parser.add_argument(
        "--max-cases",
        type=int,
        default=None,
        help="Numero massimo di casi da estrarre (per test)",
    )
    
    args = parser.parse_args()
    
    # Verifica esistenza del PDF
    if not Path(args.pdf_path).exists():
        logger.error(f"File PDF non trovato: {args.pdf_path}")
        logger.error("Posiziona il file DSM-5-TR in backend/data/dsm5_cases.pdf")
        sys.exit(1)
    
    logger.info(f"Inizio estrazione da: {args.pdf_path}")
    logger.info(f"Modalità dry-run: {args.dry_run}")
    
    # Estrai testo dal PDF
    pages = extract_text_from_pdf(args.pdf_path)
    
    if pages:
        logger.info(f"Anteprima testo estratto (pag 1):\n{pages[0]['text'][:500]}...")
    
    # Trova i casi
    cases = find_cases_in_pages(pages)
    
    if args.max_cases:
        cases = cases[:args.max_cases]
        logger.info(f"Limitato a {args.max_cases} casi come richiesto")
    
    # Salva nel database
    db = SessionLocal()
    try:
        Base.metadata.create_all(bind=engine)
        stats = save_cases_to_db(cases, db, dry_run=args.dry_run)
    finally:
        db.close()
    
    # Report finale
    logger.info(f"\n{'='*50}")
    logger.info("REPORT ESTRAZIONE DSM-5-TR")
    logger.info(f"{'='*50}")
    logger.info(f"Casi trovati nel PDF: {stats['total']}")
    logger.info(f"Casi salvati/aggiornati: {stats['saved']}")
    logger.info(f"Casi già presenti (skip): {stats['skipped']}")
    logger.info(f"Casi con suddivisione incerta: {stats['uncertain']}")
    logger.info(f"Errori: {stats['errors']}")
    if stats["uncertain"] > 0:
        logger.warning(
            f"Attenzione: {stats['uncertain']} casi hanno richiesto suddivisione euristica. "
            "Verifica e correggi dalla pagina /benchmark/cases nell'interfaccia."
        )
    logger.info(f"{'='*50}")


if __name__ == "__main__":
    main()
