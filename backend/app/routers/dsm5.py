import os
import re
import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
import PyPDF2

from ..database import get_db
from ..models.dsm5 import DSM5Category
from ..schemas.dsm5 import DSM5CategoryResponse, DSM5CategoryCompare

router = APIRouter(prefix="/api/dsm5", tags=["DSM-5"])
logger = logging.getLogger(__name__)

DSM5_CONTENT_FIELDS = [
    "diagnostic_criteria",
    "diagnostic_features",
    "prevalence",
    "development_and_course",
    "risk_and_prognostic_factors",
    "culture_related_issues",
    "sex_gender_related_issues",
    "functional_consequences",
    "differential_diagnosis",
    "comorbidity",
]


DSM5_SECTION_FIELDS = [
    ("Diagnostic Criteria", "diagnostic_criteria"),
    ("Diagnostic Features", "diagnostic_features"),
    ("Prevalence", "prevalence"),
    ("Development and Course", "development_and_course"),
    ("Risk and Prognostic Factors", "risk_and_prognostic_factors"),
    ("Culture-Related Diagnostic Issues", "culture_related_issues"),
    ("Sex- and Gender-Related Diagnostic Issues", "sex_gender_related_issues"),
    ("Gender-Related Diagnostic Issues", "sex_gender_related_issues"),
    ("Diagnostic Markers", "diagnostic_features"),
    ("Association With Suicidal Thoughts or Behavior", "risk_and_prognostic_factors"),
    ("Functional Consequences", "functional_consequences"),
    ("Differential Diagnosis", "differential_diagnosis"),
    ("Comorbidity", "comorbidity"),
]

DSM5_SECTION_HEADINGS = [heading for heading, _ in DSM5_SECTION_FIELDS] + [
    "Associated Features Supporting Diagnosis",
    "Recording Procedures",
    "Specifiers",
    "Coding and Recording Procedures",
]


def clean_dsm5_extracted_text(text: str) -> str:
    """Normalizza testo PDF DSM-5: rimuove sillabazioni e a capo OCR dentro frase."""
    text = re.sub(r"-\s*\n\s*", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    lines = [line.strip() for line in text.splitlines()]
    paragraphs: list[str] = []
    current = ""

    for line in lines:
        if not line:
            if current:
                paragraphs.append(current.strip())
                current = ""
            continue

        is_list_line = bool(re.match(r"^([A-Z]\.|[0-9]+\.|\([a-z0-9]+\))\s+", line))
        if is_list_line:
            if current:
                paragraphs.append(current.strip())
            current = line
            continue

        if not current:
            current = line
            continue

        previous_ends_sentence = bool(re.search(r"[.!?:;)]$", current))
        starts_heading_like = line in DSM5_SECTION_HEADINGS or bool(re.match(r"^[A-Z][A-Za-z -]{3,}$", line))
        if previous_ends_sentence or starts_heading_like:
            paragraphs.append(current.strip())
            current = line
        else:
            current = f"{current} {line}"

    if current:
        paragraphs.append(current.strip())

    cleaned = "\n\n".join(paragraphs)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def extract_dsm5_sections_fallback(disorder_name: str, code: str) -> dict[str, str]:
    """
    Estrae sezioni descrittive DSM-5 dal PDF locale per un dato disturbo.
    Restituisce solo sezioni trovate; il chiamante decide quali campi aggiornare.
    """
    pdf_path = "data/dsm5.pdf"
    if not os.path.exists(pdf_path):
        logger.warning(f"File PDF del DSM-5 non trovato a: {pdf_path}. Fallback non disponibile.")
        return {}

    try:
        logger.info(f"Avvio estrazione sezioni PDF per: {disorder_name} (codice: {code})")
        reader = PyPDF2.PdfReader(pdf_path)
        
        # Scannerizza principalmente la Sezione II (pagine 35-1000 del PDF per efficienza)
        start_page = 35
        end_page = min(1000, len(reader.pages))
        
        found_page_idx = -1
        search_title = disorder_name.lower().replace(" ", "").replace("-", "")
        
        for idx in range(start_page, end_page):
            page = reader.pages[idx]
            text = page.extract_text()
            if not text:
                continue
                
            text_lower = text.lower()
            # Confronta titolo o codice evitando di dipendere da una singola heading.
            text_clean = text_lower.replace(" ", "").replace("-", "")
            if (code and code.lower().replace(" ", "") in text_clean) or (search_title in text_clean):
                found_page_idx = idx
                break
                    
        if found_page_idx != -1:
            logger.info(f"Disturbo trovato a pagina {found_page_idx + 1}")
            extracted_text = []
            
            # Estrae una finestra piu ampia per catturare sezioni descrittive successive.
            for offset in range(6):
                p_idx = found_page_idx + offset
                if p_idx < len(reader.pages):
                    p_text = reader.pages[p_idx].extract_text()
                    if p_text:
                        extracted_text.append(p_text)
            
            full_text = "\n\n".join(extracted_text)
            return split_dsm5_sections(full_text)
            
    except Exception as e:
        logger.error(f"Errore durante l'estrazione PDF di {disorder_name}: {e}")
        
    return {}


def split_dsm5_sections(text: str) -> dict[str, str]:
    """Segmenta una finestra PDF DSM-5 in sezioni cliniche note."""
    normalized = text.replace("\r", "\n")
    sections: dict[str, str] = {}
    heading_pattern = "|".join(re.escape(heading) for heading in DSM5_SECTION_HEADINGS)
    matches = list(re.finditer(rf"(?im)^\s*({heading_pattern})\s*$", normalized))

    for index, match in enumerate(matches):
        heading = match.group(1).strip()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(normalized)
        raw_section = normalized[start:end].strip()
        field = next((field_name for section_name, field_name in DSM5_SECTION_FIELDS if section_name.lower() == heading.lower()), None)
        if field and raw_section:
            cleaned = clean_dsm5_extracted_text(raw_section)
            if cleaned:
                sections[field] = f"### {heading}\n\n{cleaned}"

    # Fallback: se l'OCR non mette le heading su righe separate, prova un taglio piu permissivo.
    if not sections:
        inline_pattern = "|".join(re.escape(heading) for heading in DSM5_SECTION_HEADINGS)
        inline_matches = list(re.finditer(rf"(?i)({inline_pattern})", normalized))
        for index, match in enumerate(inline_matches):
            heading = match.group(1).strip()
            start = match.end()
            end = inline_matches[index + 1].start() if index + 1 < len(inline_matches) else len(normalized)
            raw_section = normalized[start:end].strip()
            field = next((field_name for section_name, field_name in DSM5_SECTION_FIELDS if section_name.lower() == heading.lower()), None)
            if field and raw_section:
                cleaned = clean_dsm5_extracted_text(raw_section)
                if cleaned:
                    sections[field] = f"### {heading}\n\n{cleaned}"

    return sections


def enrich_dsm5_category_from_pdf(category: DSM5Category, db: Session) -> DSM5Category:
    """Popola le sezioni DSM-5 mancanti dal PDF locale, se disponibili."""
    if all(getattr(category, field, None) for field in DSM5_CONTENT_FIELDS):
        return category

    sections = extract_dsm5_sections_fallback(category.title, category.code)
    changed = False
    for field, value in sections.items():
        if field in DSM5_CONTENT_FIELDS and value and not getattr(category, field, None):
            setattr(category, field, value)
            changed = True

    if changed:
        db.commit()
        db.refresh(category)

    return category


@router.get("/chapters", response_model=List[str])
async def list_chapters(db: Session = Depends(get_db)):
    """Ritorna l'elenco dei capitoli del DSM-5 disponibili nel database."""
    chapters = db.query(DSM5Category.chapter).distinct().order_by(DSM5Category.chapter).all()
    return [c[0] for c in chapters if c[0]]


@router.get("/categories", response_model=List[DSM5CategoryResponse])
async def list_categories(
    chapter: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    search_type: str = Query(default="standard", pattern="^(standard|criteria|all)$"),
    has_criteria: Optional[bool] = Query(default=None),
    has_icd10: Optional[bool] = Query(default=None),
    has_icd11: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db)
):
    """Elenca le categorie diagnostiche DSM-5 con filtri avanzati."""
    query = db.query(DSM5Category)
    
    if chapter:
        query = query.filter(DSM5Category.chapter == chapter)
        
    if search:
        term = f"%{search.lower()}%"
        standard_filters = [
            func.lower(DSM5Category.title).like(term),
            func.lower(DSM5Category.code).like(term),
            func.lower(DSM5Category.chapter).like(term),
            func.lower(DSM5Category.parent_category).like(term),
            func.lower(DSM5Category.variant_label).like(term),
            func.lower(DSM5Category.severity).like(term),
            func.lower(DSM5Category.icd10_code).like(term),
            func.lower(DSM5Category.icd11_code).like(term),
        ]
        criteria_filters = [
            func.lower(DSM5Category.diagnostic_criteria).like(term),
            func.lower(DSM5Category.diagnostic_features).like(term),
            func.lower(DSM5Category.prevalence).like(term),
            func.lower(DSM5Category.development_and_course).like(term),
            func.lower(DSM5Category.risk_and_prognostic_factors).like(term),
            func.lower(DSM5Category.culture_related_issues).like(term),
            func.lower(DSM5Category.sex_gender_related_issues).like(term),
            func.lower(DSM5Category.functional_consequences).like(term),
            func.lower(DSM5Category.differential_diagnosis).like(term),
            func.lower(DSM5Category.comorbidity).like(term),
        ]
        if search_type == "criteria":
            query = query.filter(or_(*criteria_filters))
        elif search_type == "all":
            query = query.filter(or_(*(standard_filters + criteria_filters)))
        else:
            query = query.filter(or_(*standard_filters))

    if has_criteria is not None:
        if has_criteria:
            query = query.filter(DSM5Category.diagnostic_criteria.isnot(None), DSM5Category.diagnostic_criteria != "")
        else:
            query = query.filter(or_(DSM5Category.diagnostic_criteria.is_(None), DSM5Category.diagnostic_criteria == ""))

    if has_icd10 is not None:
        if has_icd10:
            query = query.filter(DSM5Category.icd10_code.isnot(None), DSM5Category.icd10_code != "")
        else:
            query = query.filter(or_(DSM5Category.icd10_code.is_(None), DSM5Category.icd10_code == ""))

    if has_icd11 is not None:
        if has_icd11:
            query = query.filter(DSM5Category.icd11_code.isnot(None), DSM5Category.icd11_code != "")
        else:
            query = query.filter(or_(DSM5Category.icd11_code.is_(None), DSM5Category.icd11_code == ""))
        
    return query.order_by(
        DSM5Category.chapter,
        DSM5Category.parent_category,
        DSM5Category.sort_order,
        DSM5Category.code,
    ).all()


@router.get("/categories/{identifier}", response_model=DSM5CategoryResponse)
async def get_category(identifier: str, db: Session = Depends(get_db)):
    """Recupera il dettaglio di una categoria DSM-5 per id riga o, per compatibilita, per codice."""
    category = None
    try:
        category_id = uuid.UUID(identifier)
        category = db.query(DSM5Category).filter(DSM5Category.id == category_id).first()
    except ValueError:
        category = db.query(DSM5Category).filter(DSM5Category.code == identifier).first()

    if not category:
        raise HTTPException(status_code=404, detail="Categoria DSM-5 non trovata")
        
    return enrich_dsm5_category_from_pdf(category, db)


@router.get("/compare/{icd11_code}", response_model=DSM5CategoryCompare)
async def get_comparison(icd11_code: str, db: Session = Depends(get_db)):
    """
    Ritorna la categoria DSM-5 associata a un codice ICD-11 per confronto diretto.
    Include anche i dettagli dell'ICD-11 per l'integrazione del frontend.
    """
    dsm5_cat = db.query(DSM5Category).filter(DSM5Category.icd11_code == icd11_code).first()
    if not dsm5_cat:
        raise HTTPException(status_code=404, detail="Nessuna analogia DSM-5 trovata per questo codice ICD-11")
        
    dsm5_cat = enrich_dsm5_category_from_pdf(dsm5_cat, db)
            
    # Recupera info ICD-11
    from ..models.icd11 import ICD11Category
    icd11_cat = db.query(ICD11Category).filter(ICD11Category.code == icd11_code).first()
    
    icd11_data = None
    if icd11_cat:
        icd11_data = {
            "id": str(icd11_cat.id),
            "code": icd11_cat.code,
            "title_en": icd11_cat.title_en,
            "title_it": icd11_cat.title_it,
            "description": icd11_cat.description,
            "diagnostic_criteria": icd11_cat.diagnostic_criteria
        }
        
    return {
        "dsm5": dsm5_cat,
        "icd11": icd11_data
    }
