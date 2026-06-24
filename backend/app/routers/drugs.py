"""
Router FastAPI per la gestione e ricerca dei medicinali AIFA e associazione clinica.
"""

import math
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from ..database import get_db
from ..models.drugs import AIFADrug, DrugIndicationMapping
from ..models.icd11 import ICD11Category
from ..schemas.drugs import AIFADrugResponse, PaginatedDrugsResponse
from ..services.auth import verify_token

router = APIRouter(prefix="/api/drugs", tags=["Medicines"])


def map_english_drug_to_italian(eng_name: str) -> str:
    """
    Traduce e allinea il nome di un principio attivo in inglese (da MEDI-C)
    al corrispondente principio attivo in italiano (usato da AIFA).
    """
    name = eng_name.lower().strip()
    
    # Dizionario esplicito per le discrepanze maggiori o farmaci comuni
    direct_map = {
        "acetaminophen": "paracetamolo",
        "paracetamol": "paracetamolo",
        "valproic acid": "acido valproico",
        "valproate": "acido valproico",
        "lithium": "litio",
        "haloperidol": "aloperidolo",
        "chlordiazepoxide": "clordiazepossido",
        "clonazepam": "clonazepam",
        "diazepam": "diazepam",
        "lorazepam": "lorazepam",
        "alprazolam": "alprazolam",
        "bromazepam": "bromazepam",
        "midazolam": "midazolam",
        "levothyroxine": "levotiroxina",
        "acetylsalicylic acid": "acido acetilsalicilico",
        "aspirin": "acido acetilsalicilico",
        "ibuprofen": "ibuprofene",
        "ketoprofen": "ketoprofene",
        "diclofenac": "diclofenac",
        "naproxen": "naprossene",
        "amoxicillin": "amoxicillina",
        "ampicillin": "ampicillina",
        "metformin": "metformina",
        "insulin": "insulina",
        "caffeine": "caffeina",
        "morphine": "morfina",
        "codeine": "codeina",
        "fentanyl": "fentanyl",
        "methadone": "metadone",
        "buprenorphine": "buprenorfina",
        "naloxone": "naloxone",
        "naltrexone": "naltrexone",
        "disulfiram": "disulfiram",
        "acamprosate": "acamprosato",
        "sertraline": "sertralina",
        "fluoxetine": "fluoxetina",
        "citalopram": "citalopram",
        "escitalopram": "escitalopram",
        "fluvoxamine": "fluvoxamina",
        "paroxetine": "paroxetina",
        "venlafaxine": "venlafaxina",
        "duloxetine": "duloxetina",
        "mirtazapine": "mirtazapina",
        "trazodone": "trazodone",
        "amitriptyline": "amitriptilina",
        "clomipramine": "clomipramina",
        "imipramine": "imipramina",
        "nortriptyline": "nortriptilina",
        "quetiapine": "quetiapina",
        "olanzapine": "olanzapina",
        "risperidone": "risperidone",
        "aripiprazole": "aripiprazolo",
        "ziprasidone": "ziprasidone",
        "clozapine": "clozapina",
        "carbamazepine": "carbamazepina",
        "gabapentin": "gabapentin",
        "pregabalin": "pregabalin",
        "topiramate": "topirato",
        "lamotrigine": "lamotrigina",
        "methylphenidate": "metilfenidato",
        "atomoxetine": "atomoxetina",
        "donepezil": "donepezil",
        "rivastigmine": "rivastigmina",
        "galantamine": "galantamina",
        "memantine": "memantina",
    }
    
    if name in direct_map:
        return direct_map[name]
        
    # Regole morfologiche basate su suffissi
    if name.endswith("ine"):
        return name[:-3] + "ina"
    if name.endswith("olol"):
        return name[:-4] + "olo"
    if name.endswith("one"):
        return name
    if name.endswith("ate"):
        return name[:-3] + "ato"
    if name.endswith("ide"):
        return name[:-3] + "ido"
    if name.endswith("ic"):
        return name[:-2] + "ico"
    if name.endswith("item") or name.endswith("ium"):
        return name[:-3] + "io"
    if name.endswith("ole"):
        return name[:-3] + "olo"
    if name.endswith("il"):
        return name
    if name.endswith("an"):
        return name + "o"
    return name


@router.get("", response_model=PaginatedDrugsResponse)
async def get_drugs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=10, le=200),
    search: Optional[str] = Query(default=None, description="Cerca per nome commerciale o principio attivo"),
    active_ingredient: Optional[str] = Query(default=None, description="Filtra per principio attivo specifico"),
    manufacturer: Optional[str] = Query(default=None, description="Filtra per produttore/titolare AIC"),
    atc_code: Optional[str] = Query(default=None, description="Filtra per codice ATC"),
    category_class: Optional[str] = Query(default=None, description="Filtra per classe (Classe A, Classe H, Equivalenti)"),
    min_price: Optional[float] = Query(default=None, description="Prezzo minimo"),
    max_price: Optional[float] = Query(default=None, description="Prezzo massimo"),
    db: Session = Depends(get_db),
):
    """
    Restituisce un elenco paginato di farmaci AIFA.
    Supporta filtraggio avanzato per molteplici parametri clinici ed economici.
    """
    query = db.query(AIFADrug)

    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(AIFADrug.commercial_name).like(search_term),
                func.lower(AIFADrug.active_ingredient).like(search_term),
                func.lower(AIFADrug.aic_code).like(search_term),
            )
        )

    if active_ingredient:
        query = query.filter(func.lower(AIFADrug.active_ingredient) == active_ingredient.lower().strip())

    if manufacturer:
        query = query.filter(func.lower(AIFADrug.manufacturer).like(f"%{manufacturer.lower()}%"))

    if atc_code:
        query = query.filter(func.lower(AIFADrug.atc_code).like(f"%{atc_code.lower()}%"))

    if category_class:
        query = query.filter(AIFADrug.category_class == category_class)

    if min_price is not None:
        query = query.filter(AIFADrug.price >= min_price)

    if max_price is not None:
        query = query.filter(AIFADrug.price <= max_price)

    # Conteggio per la paginazione
    total = query.count()
    total_pages = math.ceil(total / page_size)

    # Ordinamento alfabetico per principio attivo e poi nome commerciale
    items = (
        query.order_by(AIFADrug.active_ingredient, AIFADrug.commercial_name)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedDrugsResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/by-disorder/{icd11_code}", response_model=List[AIFADrugResponse])
async def get_drugs_by_disorder(
    icd11_code: str,
    db: Session = Depends(get_db),
):
    """
    Dato un codice ICD-11, identifica il codice ICD-10 corrispondente nel database,
    interroga il mapping MEDI-C, traduce i principi attivi in italiano,
    e restituisce tutti i farmaci commerciali AIFA associati disponibili.
    """
    # 1. Trova la categoria ICD-11
    category = db.query(ICD11Category).filter(ICD11Category.code == icd11_code).first()
    if not category:
        # Prova a cercare un match parziale o rimuovi postcoordinazioni scale se presenti
        clean_code = icd11_code.split('&')[0].split('/')[0].strip()
        category = db.query(ICD11Category).filter(ICD11Category.code == clean_code).first()
        
    if not category:
        raise HTTPException(status_code=404, detail=f"Categoria ICD-11 '{icd11_code}' non trovata nel database.")

    # Se non c'è codice ICD-10, non possiamo fare il match
    icd10_code = category.icd10_code
    if not icd10_code:
        return []

    # 2. Ottieni i farmaci MEDI-C associati a questo codice ICD-10
    # Può essere un codice esatto (es. "F84.0") o con prefisso (es. "F84")
    mappings = (
        db.query(DrugIndicationMapping)
        .filter(
            or_(
                func.lower(DrugIndicationMapping.icd10_code) == icd10_code.lower(),
                func.lower(DrugIndicationMapping.icd10_code).like(f"{icd10_code.lower()}.%"),
                # Se l'icd10 memorizzato ha un sottopunto ma nel mapping c'è solo la macro-categoria
                func.lower(DrugIndicationMapping.icd10_code) == icd10_code.split('.')[0].lower()
            )
        )
        .all()
    )

    if not mappings:
        return []

    # Estrarre i nomi unici dei farmaci (in inglese)
    english_drug_names = list(set(m.drug_name for m in mappings))

    # 3. Tradurre i nomi dei farmaci in italiano
    italian_active_ingredients = list(set(map_english_drug_to_italian(name) for name in english_drug_names))

    if not italian_active_ingredients:
        return []

    # 4. Trovare i farmaci commerciali AIFA per questi principi attivi
    aifa_drugs = (
        db.query(AIFADrug)
        .filter(func.lower(AIFADrug.active_ingredient).in_([ing.lower() for ing in italian_active_ingredients]))
        .order_by(AIFADrug.active_ingredient, AIFADrug.price.asc())
        .limit(150)  # Limita per non sovraccaricare il frontend in caso di troppi equivalenti
        .all()
    )

    return aifa_drugs


@router.get("/{drug_id}", response_model=AIFADrugResponse)
async def get_drug_details(
    drug_id: UUID,
    db: Session = Depends(get_db),
):
    """Restituisce i dettagli di un singolo farmaco AIFA."""
    drug = db.query(AIFADrug).filter(AIFADrug.id == drug_id).first()
    if not drug:
        raise HTTPException(status_code=404, detail="Medicinale AIFA non trovato")
    return drug
