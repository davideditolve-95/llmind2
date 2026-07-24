"""
Router FastAPI per la gestione dei pazienti e l'estrazione assistita da LLM.
Tutti gli endpoint sono isolati per utente loggato tramite OIDC email.
"""

import json
import re
import logging
from uuid import UUID
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from ..database import get_db
from ..services.auth import verify_token
from ..services.ollama import ollama_service
from ..models.patient import Patient
from ..models.benchmark import DSM5Case
from ..schemas.patient import PatientCreate, PatientUpdate, PatientResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/patients", tags=["Patients"])

# System prompt specifico per l'estrazione guidata da LLM
SYSTEM_PROMPT_PATIENT_EXTRACTION = """You are a senior clinical psychologist and expert psychiatric data extraction assistant.
Your task is to analyze the provided DSM-5-TR clinical case presentation and extract an EXHAUSTIVE, RICH, HIGHLY DETAILED CLINICAL PROFILE to empower AI diagnostic chat simulations.

Extraction Guidelines:
1. "name": Extract the patient's real name if present (e.g. "Arthur P.", "Mary Smith"). If unmentioned, generate a realistic patient name suited to the case context. NEVER output generic titles like "Introduction" or "N/A".
2. "age": Integer age (e.g., 42), or null if not specified.
3. "gender": "Male", "Female", or "Other" (or null if not specified).
4. "specific_traits": EXHAUSTIVE description of specific psychological traits, personality features, defense mechanisms, affect, mood, cognitive status, and interpersonal dynamics described in the case. Include every detail.
5. "behaviors": EXHAUSTIVE, DETAILED breakdown of clinical behaviors, chief complaints, symptoms, habits, repetitiveness, compulsions, sleep patterns, substance use, and functional impairments. Do NOT omit any symptom.
6. "clinical_history": EXHAUSTIVE anamnesis, exact timeline of symptom onset, previous medical/psychiatric treatments, hospitalizations, family history, trauma background, and current episode duration.

Respond ONLY with a valid raw JSON object matching this schema:
{
  "name": "Extract real name or generate a realistic clinical patient name",
  "age": 42,
  "gender": "Male",
  "specific_traits": "Comprehensive, multi-paragraph description of traits and affect",
  "behaviors": "Comprehensive, multi-paragraph breakdown of symptoms and behaviors",
  "clinical_history": "Comprehensive, multi-paragraph clinical anamnesis and history"
}

Do not include conversational formatting or markdown text. Return ONLY raw valid JSON."""


def _clean_and_parse_json(content: str) -> dict:
    """Rimuove eventuali blocchi markdown e esegue il parsing JSON in modo robusto."""
    cleaned = content.strip()
    if not cleaned:
        return {}
    
    # Riconosce formati tipo ```json { ... } ```
    match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', cleaned, re.DOTALL)
    if match:
        cleaned = match.group(1)
    else:
        # Trova la prima parentesi graffa aperta e l'ultima chiusa
        start = cleaned.find('{')
        end = cleaned.rfind('}')
        if start != -1 and end != -1:
            cleaned = cleaned[start:end+1]
            
    try:
        return json.loads(cleaned)
    except Exception as e:
        logger.warning(f"Failed to parse JSON directly ({e}). Attempting regex field extraction...")
        res = {}
        for key in ["name", "age", "gender", "specific_traits", "behaviors", "clinical_history"]:
            pattern = rf'"{key}"\s*:\s*"([^"]+)"|"{key}"\s*:\s*(\d+)'
            kmatch = re.search(pattern, content, re.IGNORECASE)
            if kmatch:
                res[key] = kmatch.group(1) if kmatch.group(1) is not None else int(kmatch.group(2))
        return res


def _blank_to_none(value: Any) -> Any:
    """Converte stringhe vuote in None per distinguere dati mancanti da dati utili."""
    if isinstance(value, str):
        stripped = value.strip()
        return stripped if stripped else None
    return value


def _first_non_blank(data: dict, *keys: str) -> Any:
    for key in keys:
        value = _blank_to_none(data.get(key))
        if value is not None:
            return value
    return None


def _normalize_age(value: Any) -> Optional[int]:
    value = _blank_to_none(value)
    if value is None:
        return None
    if isinstance(value, int):
        return value if 0 <= value <= 150 else None
    if isinstance(value, str):
        match = re.search(r"\b(\d{1,3})\b", value)
        if match:
            age = int(match.group(1))
            return age if 0 <= age <= 150 else None
    return None


def _extract_patient_name(case: DSM5Case, extracted_data: dict) -> str:
    """Estrae o genera un nome paziente clinico valido senza mai usare etichette generiche come 'Introduction'."""
    raw_name = _first_non_blank(
        extracted_data,
        "name",
        "full_name",
        "patient_name",
        "nome",
    )
    
    generic_names = {"introduction", "case", "patient", "n/a", "unknown", "none", "case title", "full name", "dsm-5 case", "dsm5 case"}
    if raw_name and raw_name.lower().strip() not in generic_names and not raw_name.lower().startswith("case "):
        return raw_name.strip()

    # Tentativo estrazione regex dall'anamnesi (es. "Arthur P., a 45-year-old male", "Mr. Henderson")
    anamnesis = case.anamnesis or ""
    
    match_age = re.search(r'\b([A-Z][a-z]+(?:\s+[A-Z]\.|\s+[A-Z][a-z]+)?)\b(?=,\s*(?:a\s*)?\d{1,2}[-\s]*year[-\s]*old)', anamnesis)
    if match_age:
        extracted = match_age.group(1).strip()
        if len(extracted) > 2 and extracted.lower() not in generic_names:
            return extracted

    match_title = re.search(r'\b(Mr\.|Ms\.|Mrs\.|Dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b', anamnesis)
    if match_title:
        return f"{match_title.group(1)} {match_title.group(2)}"

    title = (case.title or "").strip()
    if title and title.lower() not in generic_names and not title.lower().startswith("introduction"):
        case_num = case.case_number or "DSM-5"
        return f"{title} (Caso {case_num})"

    case_label = case.case_number or str(case.id)[:8]
    return f"Paziente Clinico (Caso {case_label})"


def _normalize_extracted_patient_data(extracted_data: dict, case: DSM5Case) -> dict:
    """
    Normalizza l'estrazione LLM garantendo una ricchezza clinica completa per la Chat AI.
    Combina l'analisi sintetica LLM con l'anamnesi e la discussione originale del caso.
    """
    name = _extract_patient_name(case, extracted_data)
    age = _normalize_age(_first_non_blank(extracted_data, "age", "eta", "età"))
    gender = _first_non_blank(extracted_data, "gender", "sex", "sesso", "genere")

    llm_behaviors = _first_non_blank(extracted_data, "behaviors", "behaviour", "clinical_behaviors", "symptoms", "sintomi")
    llm_traits = _first_non_blank(extracted_data, "specific_traits", "specificTraits", "traits", "tratti")
    llm_history = _first_non_blank(extracted_data, "clinical_history", "clinicalHistory", "history", "anamnesi")

    case_anamnesis = _blank_to_none(case.anamnesis)
    case_discussion = _blank_to_none(case.discussion)
    case_diagnosis = _blank_to_none(case.gold_standard_diagnosis)

    # Includi sia l'estrazione che il testo anamnestico integrale per non perdere alcun dettaglio in chat
    if llm_behaviors and len(str(llm_behaviors).strip()) > 50:
        behaviors = f"{str(llm_behaviors).strip()}\n\n[Dettagli Anamnestici Integrali]\n{case_anamnesis}" if case_anamnesis else str(llm_behaviors).strip()
    else:
        behaviors = case_anamnesis or "Nessun dettaglio sintomatologico registrato."

    if llm_traits and len(str(llm_traits).strip()) > 50:
        specific_traits = f"{str(llm_traits).strip()}\n\n[Discussione Clinica e Ragionamento Diagnostico]\n{case_discussion or case_diagnosis}" if (case_discussion or case_diagnosis) else str(llm_traits).strip()
    else:
        specific_traits = case_discussion or case_diagnosis or "Nessun tratto specifico inserito."

    if llm_history and len(str(llm_history).strip()) > 50:
        clinical_history = f"{str(llm_history).strip()}\n\n[Storia Anamnestica Integrale]\n{case_anamnesis}" if case_anamnesis else str(llm_history).strip()
    else:
        clinical_history = case_anamnesis or "Nessuna anamnesi remota registrata."

    return {
        "name": name,
        "age": age,
        "gender": gender,
        "behaviors": behaviors,
        "specific_traits": specific_traits,
        "clinical_history": clinical_history,
    }


@router.get("", response_model=List[PatientResponse])
async def list_patients(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_token),
):
    """Elenca tutti i pazienti dell'utente corrente, con supporto alla ricerca per nome o sintomi."""
    user_email = current_user.get("email")
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email utente non disponibile nel token di sessione"
        )
        
    query = db.query(Patient).filter(Patient.owner_email == user_email)
    
    if search:
        term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(Patient.name).like(term),
                func.lower(Patient.behaviors).like(term),
                func.lower(Patient.specific_traits).like(term)
            )
        )
        
    return query.order_by(Patient.updated_at.desc()).all()


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_token),
):
    """Dettaglio di un singolo paziente."""
    user_email = current_user.get("email")
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Paziente non trovato")
        
    if patient.owner_email != user_email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai i permessi per accedere ai dati di questo paziente"
        )
        
    return patient


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    payload: PatientCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_token),
):
    """Crea manualmente un nuovo paziente."""
    user_email = current_user.get("email")
    if not user_email:
        raise HTTPException(status_code=401, detail="Non autorizzato")
        
    patient = Patient(
        owner_email=user_email,
        name=payload.name,
        age=payload.age,
        gender=payload.gender,
        behaviors=payload.behaviors,
        specific_traits=payload.specific_traits,
        clinical_history=payload.clinical_history
    )
    
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@router.put("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: UUID,
    payload: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_token),
):
    """Aggiorna i dettagli di un paziente."""
    user_email = current_user.get("email")
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Paziente non trovato")
        
    if patient.owner_email != user_email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai i permessi per modificare questo paziente"
        )
        
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(patient, key, value)
        
    db.commit()
    db.refresh(patient)
    return patient


@router.delete("/{patient_id}", status_code=status.HTTP_200_OK)
async def delete_patient(
    patient_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_token),
):
    """Elimina un paziente."""
    user_email = current_user.get("email")
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Paziente non trovato")
        
    if patient.owner_email != user_email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai i permessi per eliminare questo paziente"
        )
        
    db.delete(patient)
    db.commit()
    return {"deleted": True, "patient_id": str(patient_id)}


@router.post("/convert-from-case/{case_id}", response_model=PatientResponse)
async def convert_case_to_patient(
    case_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_token),
):
    """
    Estrae le informazioni cliniche da un caso DSM-5-TR tramite LLM
    e crea un record Paziente per l'utente loggato.
    """
    user_email = current_user.get("email")
    if not user_email:
        raise HTTPException(status_code=401, detail="Non autorizzato")
        
    # Recupera il caso clinico
    case = db.query(DSM5Case).filter(DSM5Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Caso clinico Gold Standard non trovato")
        
    # Costruisci il prompt per l'analisi clinica esaustiva
    prompt = f"""EXHAUSTIVE CLINICAL EXTRACTION OF DSM-5-TR CASE:
Title: {case.title}
Case Number: {case.case_number or 'N/A'}

[SECTION 1: CLINICAL PRESENTATION & ANAMNESIS]
{case.anamnesis}

[SECTION 2: CLINICAL DISCUSSION & DIAGNOSTIC REASONING]
{case.discussion}

[SECTION 3: GOLD STANDARD DIAGNOSIS & CRITERIA]
{case.gold_standard_diagnosis}

INSTRUCTION: Extract an exhaustive, highly detailed patient profile containing all symptoms, behaviors, timeline, and psychological traits. Return ONLY the requested JSON structure.
"""
    
    try:
        # Esegui inferenza singola non-streaming
        inference = await ollama_service.run_inference(
            prompt=prompt,
            system_prompt=SYSTEM_PROMPT_PATIENT_EXTRACTION
        )
        
        if not inference.get("success"):
            raise HTTPException(
                status_code=502,
                detail=f"Errore durante l'interrogazione dell'assistente LLM: {inference.get('error')}"
            )
            
        raw_content = inference.get("content", "").strip()
        logger.info(f"Ollama extraction response raw: {raw_content[:500]}")
        
        extracted_data = _normalize_extracted_patient_data(
            _clean_and_parse_json(raw_content),
            case,
        )
        
        # Crea il nuovo paziente nel DB
        patient = Patient(
            owner_email=user_email,
            name=extracted_data["name"],
            age=extracted_data.get("age"),
            gender=extracted_data.get("gender"),
            behaviors=extracted_data.get("behaviors"),
            specific_traits=extracted_data.get("specific_traits"),
            clinical_history=extracted_data.get("clinical_history")
        )
        
        db.add(patient)
        db.commit()
        db.refresh(patient)
        
        return patient
        
    except Exception as e:
        logger.error(f"Errore nella conversione del caso clinico in paziente: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Errore durante la conversione del caso in paziente: {str(e)}"
        )
