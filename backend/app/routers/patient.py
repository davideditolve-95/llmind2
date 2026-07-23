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
SYSTEM_PROMPT_PATIENT_EXTRACTION = """You are an expert clinical psychologist and data extraction assistant.
Your task is to analyze the provided clinical case presentation and extract structured demographic and clinical information to build a patient profile.

You MUST respond ONLY with a valid JSON object matching this schema:
{
  "name": "Full Name (invent a realistic, standard name suited to the case context if not explicitly mentioned in the text)",
  "age": 42 (integer, or null if not specified or impossible to estimate),
  "gender": "Male/Female/Other (or null if not specified)",
  "specific_traits": "Detailed description of specific psychological traits, personality features, mood, or general attitude described in the case",
  "behaviors": "Description of clinical behaviors, symptoms, habits, repetitiveness, and functional impairments shown by the patient",
  "clinical_history": "Anamnesis, onset of symptoms, previous treatments, family history, and duration of the condition"
}

Do not include any conversational formatting, markdown blocks (like ```json), or explanatory text. Return ONLY the raw JSON object."""


def _clean_and_parse_json(content: str) -> dict:
    """Rimuove eventuali blocchi markdown e esegue il parsing JSON in modo robusto."""
    cleaned = content.strip()
    
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
            
    return json.loads(cleaned)


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


def _fallback_patient_name(case: DSM5Case) -> str:
    case_label = case.case_number or "Estratto"
    title = _blank_to_none(case.title)
    return f"Paziente da Caso {case_label}" if not title else f"Paziente da Caso {case_label}: {title}"


def _normalize_extracted_patient_data(extracted_data: dict, case: DSM5Case) -> dict:
    """
    Normalizza output LLM non perfetti e garantisce fallback dal caso DSM-5.
    Non modifica il caso benchmark: crea solo un profilo operativo per l'utente.
    """
    name = _first_non_blank(
        extracted_data,
        "name",
        "full_name",
        "patient_name",
        "nome",
    ) or _fallback_patient_name(case)

    age = _normalize_age(_first_non_blank(extracted_data, "age", "eta", "età"))
    gender = _first_non_blank(extracted_data, "gender", "sex", "sesso", "genere")

    behaviors = _first_non_blank(
        extracted_data,
        "behaviors",
        "behaviour",
        "clinical_behaviors",
        "symptoms",
        "sintomi",
        "presenting_symptoms",
    ) or _blank_to_none(case.anamnesis)

    specific_traits = _first_non_blank(
        extracted_data,
        "specific_traits",
        "specificTraits",
        "traits",
        "personality_traits",
        "clinical_traits",
        "tratti",
    ) or _blank_to_none(case.discussion) or _blank_to_none(case.gold_standard_diagnosis)

    clinical_history = _first_non_blank(
        extracted_data,
        "clinical_history",
        "clinicalHistory",
        "history",
        "anamnesis",
        "anamnesi",
        "medical_history",
        "case_history",
    ) or _blank_to_none(case.anamnesis)

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
        
    # Costruisci il prompt per l'analisi
    prompt = f"""ANALYSIS OF DSM-5-TR CLINICAL CASE:
Title: {case.title}
Anamnesis/Clinical Presentation:
{case.anamnesis}

Gold Standard Diagnosis Info:
{case.gold_standard_diagnosis}

Extract the patient's demographics, clinical history, behaviors, and traits. Respond ONLY with the requested JSON structure.
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
