"""
Script per l'estrazione e il seeding di TUTTE le categorie del DSM-5-TR dal PDF.
Scansiona le pagine dell'indice di classificazione (pagine 41-93 del PDF),
ricostruisce i codici ICD-10-CM e i titoli dei disturbi, e tenta di mapparli all'ICD-11.

USO:
    docker compose exec backend python scripts/extract_all_dsm5_categories.py
"""

import sys
import re
import logging
from pathlib import Path

# Aggiunge la directory root al path per i moduli condivisi
sys.path.insert(0, str(Path(__file__).parent.parent))

import PyPDF2
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models.dsm5 import DSM5Category
from app.models.icd11 import ICD11Category

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Capitoli del DSM-5-TR per il rilevamento
DSM5_CHAPTERS = [
    "Neurodevelopmental Disorders",
    "Schizophrenia Spectrum and Other Psychotic Disorders",
    "Bipolar and Related Disorders",
    "Depressive Disorders",
    "Anxiety Disorders",
    "Obsessive-Compulsive and Related Disorders",
    "Trauma- and Stressor-Related Disorders",
    "Dissociative Disorders",
    "Somatic Symptom and Related Disorders",
    "Feeding and Eating Disorders",
    "Elimination Disorders",
    "Sleep-Wake Disorders",
    "Sexual Dysfunctions",
    "Gender Dysphoria",
    "Disruptive, Impulse-Control, and Conduct Disorders",
    "Substance-Related and Addictive Disorders",
    "Neurocognitive Disorders",
    "Personality Disorders",
    "Paraphilic Disorders",
    "Other Mental Disorders and Additional Codes",
    "Medication-Induced Movement Disorders and Other Adverse Effects of Medication",
    "Other Conditions That May Be a Focus of Clinical Attention"
]
DSM5_CHAPTER_INDEX = {chapter: idx for idx, chapter in enumerate(DSM5_CHAPTERS)}


def detect_chapter_heading(line: str, current_chapter: str) -> str | None:
    """Rileva solo intestazioni di capitolo, evitando rimandi interni tipo "see Depressive Disorders"."""
    normalized = clean_title(line.replace("(", "").replace(")", ""))
    current_idx = DSM5_CHAPTER_INDEX.get(current_chapter, 0)

    for chapter in DSM5_CHAPTERS:
        chapter_idx = DSM5_CHAPTER_INDEX[chapter]
        if chapter_idx < current_idx:
            continue
        if normalized == chapter or normalized.startswith(f"{chapter} "):
            return chapter
    return None

def clean_title(title: str) -> str:
    """Rimuove parentesi residue con numeri di pagina o specifier."""
    # Rimuove numeri di pagina come ( 56 ) o (56) in coda
    title = re.sub(r'\(\s*\d+\s*\)$', '', title)
    title = title.strip()
    # Rimuove trattini o virgole in coda
    title = re.sub(r'[\s,-]+$', '', title)
    return title.strip()

SEVERITY_TERMS = [
    "mild",
    "moderate",
    "severe",
    "profound",
    "early remission",
    "sustained remission",
    "in partial remission",
    "in full remission",
    "with mild use disorder",
    "with moderate or severe use disorder",
]


def extract_severity(label: str) -> str | None:
    lowered = label.lower()
    for term in SEVERITY_TERMS:
        if term in lowered:
            return term.title()
    return None


def normalize_parent_category(parent_title: str, title: str) -> str | None:
    parent_title = clean_title(parent_title or "")
    if parent_title:
        return parent_title

    # Fallback per record gia appiattiti o righe con specifier nel titolo.
    if " - " in title:
        return clean_title(title.split(" - ", 1)[0])

    severity = extract_severity(title)
    if severity:
        candidate = clean_title(re.sub(re.escape(severity), "", title, flags=re.IGNORECASE))
        return candidate or None

    return None


def normalize_variant_label(parent_category: str | None, title: str) -> str | None:
    if parent_category and title.lower().startswith(parent_category.lower()):
        remainder = title[len(parent_category):].strip(" -,:;")
        return clean_title(remainder) if remainder else None
    if parent_category and " - " in title:
        return clean_title(title.split(" - ", 1)[1])
    if parent_category:
        return clean_title(title)
    return None


def derive_mild_neurocognitive_parent(title: str) -> str | None:
    """Ricostruisce la famiglia DSM-5 corretta per le varianti mild neurocognitive."""
    normalized = title.lower()
    if not normalized.startswith("mild neurocognitive disorder"):
        return None

    special_families = [
        ("alzheimer", "Major or Mild Neurocognitive Disorder Due to Alzheimer’s Disease"),
        ("frontotemporal", "Major or Mild Frontotemporal Neurocognitive Disorder"),
        ("lewy bodies", "Major or Mild Neurocognitive Disorder With Lewy Bodies"),
        ("vascular", "Major or Mild Vascular Neurocognitive Disorder"),
        ("traumatic brain injury", "Major or Mild Neurocognitive Disorder Due to Traumatic Brain Injury"),
        ("hiv infection", "Major or Mild Neurocognitive Disorder Due to HIV Infection"),
        ("prion disease", "Major or Mild Neurocognitive Disorder Due to Prion Disease"),
        ("parkinson", "Major or Mild Neurocognitive Disorder Due to Parkinson’s Disease"),
        ("huntington", "Major or Mild Neurocognitive Disorder Due to Huntington’s Disease"),
        ("another medical condition", "Major or Mild Neurocognitive Disorder Due to Another Medical Condition"),
        ("multiple etiologies", "Major or Mild Neurocognitive Disorder Due to Multiple Etiologies"),
    ]

    for marker, family in special_families:
        if marker in normalized:
            return family

    return clean_title(title.replace("Mild Neurocognitive Disorder", "Major or Mild Neurocognitive Disorder", 1))

def build_icd11_lookup(db: Session) -> tuple[dict[str, str], list[tuple[str, str]]]:
    rows = db.query(ICD11Category.code, ICD11Category.title_en).filter(ICD11Category.code.isnot(None)).all()
    exact = {title.lower(): code for code, title in rows if title}
    searchable = [(code, title.lower()) for code, title in rows if title]
    return exact, searchable


def search_icd11_mapping(title: str, exact_lookup: dict[str, str], searchable_titles: list[tuple[str, str]]) -> str | None:
    """Tenta di trovare una categoria ICD-11 corrispondente nel DB basandosi sul titolo."""
    exact = exact_lookup.get(title.lower())
    if exact:
        return exact
        
    # Se fallisce, prova a cercare parole chiave significative
    words = [w for w in re.split(r'[\s,-]+', title) if len(w) > 4 and w.lower() not in ['disorder', 'disorders', 'specified', 'unspecified']]
    if words:
        keywords = [w.lower() for w in words[:3]]
        for code, icd_title in searchable_titles:
            if all(keyword in icd_title for keyword in keywords):
                return code
            
    return None

def extract_and_seed_all():
    pdf_path = "data/dsm5.pdf"
    if not Path(pdf_path).exists():
        logger.error(f"File PDF non trovato in: {pdf_path}")
        return
        
    db: Session = SessionLocal()
    try:
        # Assicuriamoci che la tabella esista
        Base.metadata.create_all(bind=engine)
        
        logger.info("Caricamento del PDF in corso...")
        reader = PyPDF2.PdfReader(pdf_path)
        exact_lookup, searchable_titles = build_icd11_lookup(db)
        
        chapter = "Neurodevelopmental Disorders" # Capitolo iniziale di default
        parent_title = ""
        candidate_parent_title = ""
        categories_dict = {}
        
        # Pagine della classificazione (dalla pagina 41 alla 93 del PDF, indici 40-92)
        start_page_idx = 40
        end_page_idx = 92
        
        code_pat = re.compile(r'^[A-Z]\d{2}(?:\.\d+)?$')
        
        logger.info(f"Scansione pagine classificazione ({start_page_idx + 1} - {end_page_idx + 1})...")
        sort_order = 0
        for idx in range(start_page_idx, end_page_idx + 1):
            text = reader.pages[idx].extract_text()
            if not text:
                continue
                
            raw_lines = [l.strip() for l in text.split('\n') if l.strip()]
            
            # Preprocessing: unisce righe spezzate da numeri di pagina tra parentesi
            lines = []
            i = 0
            while i < len(raw_lines):
                line = raw_lines[i]
                if line.endswith('(') and i + 2 < len(raw_lines) and raw_lines[i+1].isdigit() and raw_lines[i+2] == ')':
                    lines.append(f"{line[:-1].strip()} ({raw_lines[i+1]})")
                    i += 3
                elif line.endswith('(') and i + 1 < len(raw_lines) and raw_lines[i+1] == ')':
                    lines.append(line[:-1].strip())
                    i += 2
                else:
                    lines.append(line)
                    i += 1
            
            # Parsing delle linee pre-elaborate
            i = 0
            while i < len(lines):
                line = lines[i]
                
                # Rileva cambio capitolo
                detected_chapter = detect_chapter_heading(line, chapter)
                if detected_chapter:
                    chapter = detected_chapter
                    parent_title = ""
                    candidate_parent_title = ""
                    i += 1
                    continue
                    
                # Rileva segnaposto per specificazioni parent (es. ___.__)
                if '___.__' in line:
                    parent_title = line.replace('___.__', '').strip()
                    parent_title = clean_title(parent_title)
                    candidate_parent_title = parent_title
                    i += 1
                    continue
                    
                # Rileva codici ICD-10-CM
                if code_pat.match(line):
                    code = line
                    title = lines[i+1] if i + 1 < len(lines) else 'Unknown'
                    title = clean_title(title)
                    sort_order += 1
                    effective_parent = parent_title
                    neurocognitive_parent = derive_mild_neurocognitive_parent(title)
                    if neurocognitive_parent:
                        effective_parent = neurocognitive_parent
                    if not effective_parent and extract_severity(title) and candidate_parent_title:
                        effective_parent = candidate_parent_title
                    
                    # Combina con il titolo genitore se è un sottotipo (es. "F70 Mild" sotto "Intellectual Disability")
                    full_title = f"{effective_parent} - {title}" if effective_parent and title.lower() not in effective_parent.lower() else title
                    if effective_parent and effective_parent.lower() in title.lower():
                        full_title = title

                    parent_category = normalize_parent_category(effective_parent, full_title)
                    variant_label = normalize_variant_label(parent_category, full_title)
                        
                    record_key = "|".join([
                        code,
                        chapter,
                        parent_category or "",
                        variant_label or "",
                        full_title,
                    ])
                    if record_key not in categories_dict:
                        categories_dict[record_key] = {
                            "code": code,
                            "title": full_title,
                            "chapter": chapter,
                            "parent_category": parent_category,
                            "variant_label": variant_label,
                            "severity": extract_severity(title) or extract_severity(full_title),
                            "sort_order": sort_order,
                        }
                    i += 2
                else:
                    # Rileva se è una categoria parent senza codice esplicito
                    if line.endswith(')') and '(' in line and not line.startswith('F') and len(line) > 10:
                        parent_title = clean_title(line)
                        candidate_parent_title = parent_title
                    elif (
                        len(line) > 10
                        and not line.isdigit()
                        and "DSM-5" not in line
                        and "Classification" not in line
                        and not extract_severity(line)
                        and not parent_title
                    ):
                        candidate_parent_title = clean_title(line)
                    i += 1
                    
        categories_to_seed = list(categories_dict.values())
        logger.info(f"Trovate {len(categories_to_seed)} categorie uniche nel PDF.")

        extracted_codes = {item["code"] for item in categories_to_seed}
        extracted_identities = {
            (item["code"], item["title"], item.get("parent_category"))
            for item in categories_to_seed
        }
        stale_rows = db.query(DSM5Category).filter(DSM5Category.code.in_(extracted_codes)).all()
        deleted_count = 0
        for row in stale_rows:
            identity = (row.code, row.title, row.parent_category)
            if identity not in extracted_identities:
                db.delete(row)
                deleted_count += 1
        if deleted_count:
            db.flush()
            logger.info(f"Pulizia tassonomia legacy: {deleted_count} record DSM-5 obsoleti rimossi.")
        
        # Inserimento nel database
        inserted_count = 0
        updated_count = 0
        mapped_count = 0
        
        for item in categories_to_seed:
            # Rileva mappatura ICD-11
            icd11_code = search_icd11_mapping(item["title"], exact_lookup, searchable_titles)
            if icd11_code:
                mapped_count += 1
                
            existing = db.query(DSM5Category).filter(
                DSM5Category.code == item["code"],
                DSM5Category.title == item["title"],
                DSM5Category.parent_category == item.get("parent_category"),
            ).first()
            if existing:
                existing.title = item["title"]
                existing.chapter = item["chapter"]
                existing.parent_category = item.get("parent_category")
                existing.variant_label = item.get("variant_label")
                existing.severity = item.get("severity")
                existing.sort_order = item.get("sort_order")
                if icd11_code and not existing.icd11_code:
                    existing.icd11_code = icd11_code
                updated_count += 1
            else:
                new_cat = DSM5Category(
                    code=item["code"],
                    title=item["title"],
                    chapter=item["chapter"],
                    parent_category=item.get("parent_category"),
                    variant_label=item.get("variant_label"),
                    severity=item.get("severity"),
                    sort_order=item.get("sort_order"),
                    icd10_code=item["code"], # I codici estratti Fxx.x sono codici ICD-10-CM
                    icd11_code=icd11_code,
                    diagnostic_criteria=None # Verrà popolato al volo tramite PDF fallback
                )
                db.add(new_cat)
                inserted_count += 1
                
        db.commit()
        logger.info(f"Salvataggio completato: {inserted_count} record inseriti, {updated_count} aggiornati. {mapped_count} mappati all'ICD-11.")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Errore durante l'estrazione e il seeding: {e}", exc_info=True)
    finally:
        db.close()

if __name__ == "__main__":
    extract_and_seed_all()
