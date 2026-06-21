"""
Router per l'integrazione live-ready con GCP Conversational Agents.
Espone un proxy sicuro verso Dialogflow CX senza pubblicare credenziali Google al frontend.
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from typing import Any
from uuid import uuid4

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..config import get_settings

router = APIRouter(prefix="/api/gcp-agents", tags=["GCP Conversational Agents"])


@dataclass(frozen=True)
class AgentDefinition:
    id: str
    name: str
    short_name: str
    description: str
    use_case: str
    datastore_scope: list[str]
    expected_inputs: list[str]
    expected_outputs: list[str]
    status: str = "ready-for-deploy"


AGENT_REGISTRY: list[AgentDefinition] = [
    AgentDefinition(
        id="clinical-intake",
        name="Clinical Intake Triage",
        short_name="Intake",
        description="Raccoglie una vignetta clinica, identifica dati mancanti e instrada verso l'agente piu adatto.",
        use_case="Usalo quando la richiesta parte da testo clinico non strutturato o quando serve una prima triage metodologica.",
        datastore_scope=["BigQuery agent_corpus_chunks", "LLMind2 research protocols"],
        expected_inputs=["presenting concern", "eta o fase evolutiva", "durata", "impairment", "rischio", "contesto medico"],
        expected_outputs=["neutral case summary", "missing information", "risk flags", "recommended route", "follow-up question"],
    ),
    AgentDefinition(
        id="icd11-coding",
        name="ICD-11 Coding Assistant",
        short_name="ICD-11",
        description="Mappa concetti clinici verso categorie ICD-11 con inclusioni, esclusioni e incertezza esplicita.",
        use_case="Usalo quando vuoi cercare categorie ICD-11 candidate o confrontare una label DSM con la tassonomia ICD-11.",
        datastore_scope=["BigQuery icd11_categories", "BigQuery agent_corpus_chunks", "ICD-11 CDDR datastore"],
        expected_inputs=["clinical concept", "candidate label", "duration", "functional impairment", "exclusions already checked"],
        expected_outputs=["candidate categories", "supporting features", "features against", "required exclusions", "coding confidence"],
    ),
    AgentDefinition(
        id="differential-supervisor",
        name="Differential Diagnosis Supervisor",
        short_name="Differential",
        description="Costruisce diagnosi differenziali trasparenti separando fatti, ipotesi, evidenze e dati mancanti.",
        use_case="Usalo quando il caso e abbastanza ricco e devi confrontare ipotesi concorrenti o condizioni da non perdere.",
        datastore_scope=["BigQuery agent_corpus_chunks", "ICD-11 CDDR", "DSM-5-TR cases"],
        expected_inputs=["structured vignette", "risk status", "course", "medical/substance context", "developmental context"],
        expected_outputs=["ranked differential table", "must-not-miss conditions", "exclusions to check", "uncertainty level", "next question"],
    ),
    AgentDefinition(
        id="benchmark-reviewer",
        name="Benchmark Case Reviewer",
        short_name="Benchmark",
        description="Controlla casi DSM estratti prima dei benchmark, con focus su leakage, artefatti OCR e gold standard.",
        use_case="Usalo quando stai preparando o validando casi sperimentali per benchmark riproducibili.",
        datastore_scope=["BigQuery dsm5_cases", "BigQuery agent_corpus_chunks"],
        expected_inputs=["case number", "introduction", "discussion", "diagnosis", "extraction version"],
        expected_outputs=["readiness status", "leakage risk", "artifact flags", "cleanup actions", "human review required"],
    ),
    AgentDefinition(
        id="protocol-navigator",
        name="Research Protocol Navigator",
        short_name="Protocol",
        description="Aiuta a navigare metodologia, roadmap di tesi, governance, metriche e minacce alla validita.",
        use_case="Usalo per progettare esperimenti, decidere metriche e distinguere scelte metodologiche da task ingegneristici.",
        datastore_scope=["LLMind2 research protocols", "BigQuery static corpus summaries"],
        expected_inputs=["research question", "dataset scope", "model setup", "evaluation target", "constraints"],
        expected_outputs=["evaluation protocol", "metrics", "human review plan", "validity threats", "next action"],
    ),
    AgentDefinition(
        id="safety-guardrail",
        name="Safety and Scope Guardrail",
        short_name="Safety",
        description="Gestisce rischio, privacy, uso fuori perimetro e richieste che sembrano cliniche operative.",
        use_case="Usalo quando compaiono rischio acuto, dati identificativi o richieste di diagnosi/trattamento operativo.",
        datastore_scope=["LLMind2 governance docs", "Safety playbook specification"],
        expected_inputs=["risk signal", "request type", "identifiability", "deployment context"],
        expected_outputs=["risk level", "safe response", "allowed research support", "required human review"],
    ),
]


class GcpAgentChatRequest(BaseModel):
    agent_id: str = Field(..., description="ID logico dell'agente LLMind da invocare.")
    message: str = Field(..., min_length=1, max_length=16000)
    session_id: str | None = None
    language_code: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)


class GcpAgentChatResponse(BaseModel):
    agent_id: str
    session_id: str
    answer: str
    response_messages: list[dict[str, Any]]
    match: dict[str, Any] | None = None
    diagnostic_info: dict[str, Any] | None = None


def _agent_by_id(agent_id: str) -> AgentDefinition | None:
    return next((agent for agent in AGENT_REGISTRY if agent.id == agent_id), None)


def _missing_settings() -> list[str]:
    settings = get_settings()
    missing = []
    if not settings.gcp_project_id:
        missing.append("GCP_PROJECT_ID")
    if not settings.gcp_location:
        missing.append("GCP_LOCATION")
    if not settings.gcp_dialogflow_agent_id and not settings.gcp_dialogflow_agent_map:
        missing.append("GCP_DIALOGFLOW_AGENT_ID o GCP_DIALOGFLOW_AGENT_MAP")
    return missing


def _agent_id_map() -> dict[str, str]:
    raw_map = get_settings().gcp_dialogflow_agent_map.strip()
    if not raw_map:
        return {}
    try:
        parsed = json.loads(raw_map)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"GCP_DIALOGFLOW_AGENT_MAP non e JSON valido: {exc}") from exc
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=500, detail="GCP_DIALOGFLOW_AGENT_MAP deve essere un oggetto JSON agent_id -> dialogflow_agent_id.")
    return {str(key): str(value) for key, value in parsed.items() if value}


def _dialogflow_agent_id(logical_agent_id: str) -> str:
    settings = get_settings()
    return _agent_id_map().get(logical_agent_id, settings.gcp_dialogflow_agent_id)


def _sanitize_session_id(session_id: str | None) -> str:
    value = session_id or f"llmind-{uuid4()}"
    value = re.sub(r"[^a-zA-Z0-9_-]", "-", value).strip("-")
    return value[:120] or f"llmind-{uuid4()}"


def _agent_resource(dialogflow_agent_id: str) -> str:
    settings = get_settings()
    return f"projects/{settings.gcp_project_id}/locations/{settings.gcp_location}/agents/{dialogflow_agent_id}"


def _session_resource(dialogflow_agent_id: str, session_id: str) -> str:
    settings = get_settings()
    agent_resource = _agent_resource(dialogflow_agent_id)
    if settings.gcp_dialogflow_environment_id:
        return f"{agent_resource}/environments/{settings.gcp_dialogflow_environment_id}/sessions/{session_id}"
    return f"{agent_resource}/sessions/{session_id}"


def _base_api_url() -> str:
    return get_settings().gcp_dialogflow_api_endpoint.rstrip("/")


def _access_token() -> str:
    settings = get_settings()
    try:
        import google.auth
        from google.auth.transport.requests import Request
        from google.oauth2 import service_account
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="Dipendenza google-auth assente. Installa le requirements del backend prima del deploy GCP.",
        ) from exc

    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    try:
        if settings.gcp_credentials_file:
            credentials = service_account.Credentials.from_service_account_file(
                settings.gcp_credentials_file,
                scopes=scopes,
            )
        else:
            credentials, _ = google.auth.default(scopes=scopes)
        credentials.refresh(Request())
        return credentials.token
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Credenziali GCP non disponibili o non valide: {exc}") from exc


def _auth_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_access_token()}",
        "Content-Type": "application/json",
    }


def _extract_text(response_payload: dict[str, Any]) -> str:
    messages = response_payload.get("queryResult", {}).get("responseMessages", [])
    texts: list[str] = []
    for message in messages:
        for text in message.get("text", {}).get("text", []) or []:
            if text:
                texts.append(str(text))
    return "\n\n".join(texts).strip()


@router.get("/agents")
async def list_agents():
    """Restituisce il catalogo degli agenti LLMind esposti in UI."""
    agent_map = _agent_id_map()
    default_agent = get_settings().gcp_dialogflow_agent_id
    return {
        "agents": [
            {
                **asdict(agent),
                "dialogflow_agent_configured": bool(agent_map.get(agent.id) or default_agent),
            }
            for agent in AGENT_REGISTRY
        ]
    }


@router.get("/status")
async def get_gcp_agents_status(live_check: bool = Query(False)):
    """Verifica configurazione locale e, opzionalmente, raggiungibilita dell'agente Dialogflow."""
    settings = get_settings()
    missing = _missing_settings()
    status: dict[str, Any] = {
        "configured": not missing,
        "online": False,
        "checked_live": live_check,
        "missing": missing,
        "project_id": settings.gcp_project_id,
        "location": settings.gcp_location,
        "agent_id_present": bool(settings.gcp_dialogflow_agent_id),
        "agent_map_present": bool(settings.gcp_dialogflow_agent_map),
        "environment_id_present": bool(settings.gcp_dialogflow_environment_id),
        "api_endpoint": settings.gcp_dialogflow_api_endpoint,
        "message": "Configura le variabili GCP per abilitare l'interazione live.",
    }
    if missing or not live_check:
        return status

    dialogflow_agent_id = _dialogflow_agent_id(AGENT_REGISTRY[0].id)
    url = f"{_base_api_url()}/v3/{_agent_resource(dialogflow_agent_id)}"
    try:
        async with httpx.AsyncClient(timeout=settings.gcp_agents_timeout_seconds) as client:
            response = await client.get(url, headers=_auth_headers())
        response.raise_for_status()
        payload = response.json()
        status["online"] = True
        status["message"] = f"Agente raggiungibile: {payload.get('displayName') or dialogflow_agent_id}"
    except HTTPException:
        raise
    except Exception as exc:
        status["message"] = f"Configurazione presente, ma live check non riuscito: {exc}"
    return status


@router.post("/chat", response_model=GcpAgentChatResponse)
async def chat_with_gcp_agent(payload: GcpAgentChatRequest):
    """Invia un turno conversazionale al Dialogflow CX agent reale."""
    missing = _missing_settings()
    if missing:
        raise HTTPException(
            status_code=503,
            detail=f"Integrazione GCP non configurata. Variabili mancanti: {', '.join(missing)}",
        )

    logical_agent = _agent_by_id(payload.agent_id)
    if logical_agent is None:
        raise HTTPException(status_code=404, detail=f"Agente LLMind sconosciuto: {payload.agent_id}")

    settings = get_settings()
    dialogflow_agent_id = _dialogflow_agent_id(payload.agent_id)
    if not dialogflow_agent_id:
        raise HTTPException(status_code=503, detail=f"Nessun Dialogflow agent id configurato per {payload.agent_id}.")

    session_id = _sanitize_session_id(payload.session_id)
    language_code = payload.language_code or settings.gcp_agents_language_code
    session_resource = _session_resource(dialogflow_agent_id, session_id)
    request_body = {
        "queryInput": {
            "text": {"text": payload.message},
            "languageCode": language_code,
        },
        "queryParams": {
            "parameters": {
                **payload.parameters,
                "llmind_agent_route": payload.agent_id,
                "llmind_agent_name": logical_agent.name,
                "llmind_use_case": logical_agent.use_case,
            }
        },
    }

    url = f"{_base_api_url()}/v3/{session_resource}:detectIntent"
    try:
        async with httpx.AsyncClient(timeout=settings.gcp_agents_timeout_seconds) as client:
            response = await client.post(url, headers=_auth_headers(), json=request_body)
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Errore durante la chiamata a Dialogflow CX: {exc}") from exc

    response_payload = response.json()
    query_result = response_payload.get("queryResult", {})
    return GcpAgentChatResponse(
        agent_id=payload.agent_id,
        session_id=session_id,
        answer=_extract_text(response_payload),
        response_messages=query_result.get("responseMessages", []),
        match=query_result.get("match"),
        diagnostic_info=query_result.get("diagnosticInfo"),
    )
