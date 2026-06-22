"""
Router FastAPI per il chatbot AI.
Gestisce le conversazioni ICD-11 e Well-being con streaming SSE.
"""

import json
import uuid
import sqlalchemy
from datetime import datetime
from typing import List, Optional
from uuid import UUID
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..services.auth import verify_token

logger = logging.getLogger(__name__)

from ..database import get_db
from ..models.chat import ChatMessage, ChatSession
from ..schemas.chat import (
    ChatMessageRequest,
    ChatMessageResponse,
    ChatSessionResponse,
    ChatSessionHistory,
    AvailableModelsResponse,
    OllamaHealthResponse,
    ChatTestRequest,
    ChatTestResponse,
)
from ..services.ollama import ollama_service
import time

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.get("/health", response_model=OllamaHealthResponse)
async def get_ollama_health():
    """Verifica la connettività di Ollama e restituisce metriche di base."""
    start_time = time.time()
    try:
        models = await ollama_service.list_models()
        latency_ms = int((time.time() - start_time) * 1000)
        return OllamaHealthResponse(
            status="online",
            base_url=ollama_service.base_url,
            models_count=len(models),
            latency_ms=latency_ms,
        )
    except Exception as e:
        return OllamaHealthResponse(
            status="offline",
            base_url=ollama_service.base_url,
            models_count=0,
            latency_ms=0,
            error=str(e),
        )


@router.post("/test", response_model=ChatTestResponse)
async def test_ollama_inference(request: ChatTestRequest):
    """Esegue un'inferenza di test (Playground) senza salvare nulla nel database."""
    res = await ollama_service.run_inference(
        prompt=request.prompt,
        model=request.model_name,
        system_prompt=request.system_prompt
    )
    return ChatTestResponse(**res)


@router.get("/models", response_model=AvailableModelsResponse)
async def get_available_models():
    """
    Restituisce la lista dei modelli Ollama disponibili sull'host.
    Utilizzata dal selettore modello nell'interfaccia chatbot.
    """
    models = await ollama_service.list_models()
    return AvailableModelsResponse(
        models=models,
        default_model=ollama_service.default_model,
    )


@router.get("/sessions", response_model=List[ChatSessionResponse])
async def list_chat_sessions(
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_token),
):
    """Elenca tutte le sessioni di chat attive per l'utente corrente."""
    user_email = current_user.get("email")
    return (
        db.query(ChatSession)
        .filter(ChatSession.is_active == True, ChatSession.user_email == user_email)
        .order_by(ChatSession.is_pinned.desc(), ChatSession.is_starred.desc(), ChatSession.updated_at.desc())
        .all()
    )


@router.patch("/sessions/{session_id}", response_model=ChatSessionResponse)
async def update_session(
    session_id: UUID,
    title: Optional[str] = Query(default=None),
    is_pinned: Optional[bool] = Query(default=None),
    is_starred: Optional[bool] = Query(default=None),
    patient_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_token),
):
    """Aggiorna i parametri di una sessione di chat (titolo, pin, star, paziente)."""
    user_email = current_user.get("email")
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    
    if session.user_email != user_email:
        raise HTTPException(status_code=403, detail="Non hai i permessi per questa conversazione")
        
    if title is not None:
        session.title = title
    if is_pinned is not None:
        session.is_pinned = is_pinned
    if is_starred is not None:
        session.is_starred = is_starred
        
    if patient_id is not None:
        if patient_id.lower() in ("none", "null", "clear", ""):
            session.patient_id = None
        else:
            try:
                from ..models.patient import Patient
                pid = UUID(patient_id)
                patient = db.query(Patient).filter(Patient.id == pid, Patient.owner_email == user_email).first()
                if not patient:
                    raise HTTPException(status_code=404, detail="Paziente non trovato o non autorizzato")
                session.patient_id = pid
            except ValueError:
                raise HTTPException(status_code=400, detail="Formato UUID per patient_id non valido")
        
    db.commit()
    db.refresh(session)
    return session


@router.post("/stream")
async def chat_stream(
    request: ChatMessageRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_token),
):
    """
    Endpoint di chat con streaming SSE (Server-Sent Events).
    """
    user_email = current_user.get("email")
    try:
        # 1. Verifica/Crea Sessione (con rollback in caso di errore)
        session = db.query(ChatSession).filter(ChatSession.id == request.session_id).first()
        if not session:
            try:
                session = ChatSession(
                    id=request.session_id,
                    title="Nuova Conversazione",
                    mode=request.mode,
                    user_email=user_email,
                    patient_id=request.patient_id
                )
                db.add(session)
                db.commit()
            except Exception as e:
                db.rollback()
                logger.error(f"Errore critico creazione sessione: {e}")
                raise HTTPException(status_code=500, detail=f"Database error while creating session: {str(e)}")

        # 2. Auto-naming
        if session.title == "Nuova Conversazione":
            session.title = request.message[:40] + ("..." if len(request.message) > 40 else "")
            db.commit()

        # Verifica se la sessione ha o deve essere legata a un paziente per la contestualizzazione
        active_patient_id = request.patient_id or session.patient_id
        patient_context_prompt = ""
        if active_patient_id:
            from ..models.patient import Patient
            patient = db.query(Patient).filter(Patient.id == active_patient_id, Patient.owner_email == user_email).first()
            if patient:
                # Aggiorna l'associazione del paziente se non già legata
                if session.patient_id != patient.id:
                    session.patient_id = patient.id
                    db.commit()
                
                patient_context_prompt = f"""
[CONTEXT CLINICO DEL PAZIENTE ATTIVO]
Nome: {patient.name}
Età: {patient.age if patient.age is not None else 'Non specificata'}
Genere: {patient.gender if patient.gender else 'Non specificato'}
Comportamenti/Sintomi: {patient.behaviors if patient.behaviors else 'Nessuno registrato'}
Tratti Specifici/Personalità: {patient.specific_traits if patient.specific_traits else 'Nessuno registrato'}
Anamnesi/Storia Clinica: {patient.clinical_history if patient.clinical_history else 'Nessuna registrata'}
--------------------------------------------------
Focalizza le tue risposte, le valutazioni dei criteri ICD-11 e il ragionamento clinico specificamente sul profilo di questo paziente.
"""

        # Recupera cronologia
        history = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == request.session_id)
            .order_by(ChatMessage.created_at)
            .limit(20)
            .all()
        )

        messages = [{"role": msg.role, "content": msg.content} for msg in history]
        messages.append({"role": "user", "content": request.message})

        # Salva il messaggio dell'utente
        user_msg = ChatMessage(
            session_id=request.session_id,
            role="user",
            content=request.message,
            mode=request.mode,
        )
        db.add(user_msg)
        db.commit()

    except sqlalchemy.exc.ProgrammingError as e:
        logger.error(f"SCHEMA MISMATCH DETECTED: {e}")
        raise HTTPException(status_code=500, detail="Database schema mismatch. Please contact administrator to reset chat history.")
    except Exception as e:
        logger.error(f"Chat stream initial error: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

    system_prompt = ollama_service.get_system_prompt(request.mode)
    if patient_context_prompt:
        system_prompt = patient_context_prompt + "\n" + system_prompt
        
    full_response = []

    async def event_generator():
        try:
            async for chunk in ollama_service.chat_stream(
                messages=messages,
                model=request.model_name,
                system_prompt=system_prompt,
            ):
                full_response.append(chunk)
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            complete_response = "".join(full_response)
            if complete_response:
                assistant_msg = ChatMessage(
                    session_id=request.session_id,
                    role="assistant",
                    content=complete_response,
                    mode=request.mode,
                    model_name=request.model_name,
                )
                db.add(assistant_msg)
                # Forza l'aggiornamento del timestamp della sessione
                session.updated_at = datetime.utcnow()
                db.commit()
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disabilita buffering Nginx
        },
    )


@router.get("/history/{session_id}", response_model=ChatSessionHistory)
async def get_session_history(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_token),
):
    """Recupera la cronologia completa di una sessione di chat."""
    user_email = current_user.get("email")
    try:
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Sessione non trovata")

        if session.user_email != user_email:
            raise HTTPException(status_code=403, detail="Non hai i permessi per questa conversazione")

        messages = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at)
            .all()
        )

        return ChatSessionHistory(
            id=session.id,
            title=session.title,
            messages=[
                ChatMessageResponse(
                    id=msg.id,
                    session_id=msg.session_id,
                    role=msg.role,
                    content=msg.content,
                    mode=msg.mode,
                    model_name=msg.model_name,
                    icd11_codes_mentioned=msg.icd11_codes_mentioned,
                    created_at=msg.created_at,
                )
                for msg in messages
            ],
            mode=session.mode,
            patient_id=session.patient_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Errore recupero history per {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Impossibile recuperare la cronologia per errore database")


@router.delete("/history/{session_id}")
async def clear_session_history(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_token),
):
    """Cancella la cronologia di una sessione di chat."""
    user_email = current_user.get("email")
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")

    if session.user_email != user_email:
        raise HTTPException(status_code=403, detail="Non hai i permessi per questa conversazione")

    db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete()
    db.query(ChatSession).filter(ChatSession.id == session_id).delete()
    db.commit()
    return {"status": "success"}
