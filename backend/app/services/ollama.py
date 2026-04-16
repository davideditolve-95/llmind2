"""
Servizio per la comunicazione con Ollama (LLM esterno).
Gestisce chiamate REST, streaming SSE e inferenza multi-modello.
"""

import httpx
import json
import time
import logging
from typing import AsyncGenerator, Optional, List, Dict, Any
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ─── System Prompts ────────────────────────────────────────────────────────

SYSTEM_PROMPT_ICD11 = """You are an expert clinical informatics assistant specialized in the ICD-11 (International Classification of Diseases, 11th Revision) by the World Health Organization.

Your role is to:
1. Answer questions about ICD-11 codes, diagnostic categories, and clinical definitions
2. Help clinicians and researchers navigate the classification system
3. Provide accurate, evidence-based information from the ICD-11 framework
4. Suggest relevant ICD-11 codes when symptoms or diagnoses are described

Always cite specific ICD-11 codes when relevant (format: XY00.XX).
Keep answers concise and clinically accurate.
If you are unsure, say so clearly rather than guessing."""

SYSTEM_PROMPT_WELLBEING = """You are a rigorous Clinical Psychologist Supervisor with 20+ years of experience, specializing in differential diagnosis using ICD-11 criteria.

Your role in this clinical consultation:
1. LISTEN carefully to the clinical case presented
2. ANALYZE symptoms systematically, mapping them to ICD-11 diagnostic criteria
3. DIFFERENTIAL DIAGNOSIS: When symptoms are ambiguous or incomplete, DO NOT provide a definitive diagnosis immediately. Instead, ask targeted questions to rule out competing diagnoses
4. STRUCTURE your reasoning: list hypotheses and what would confirm or exclude each
5. Only provide a provisional ICD-11 diagnosis when you have sufficient information
6. Always note if further assessment (e.g., structured interviews, neuropsychological testing) would be required in real clinical practice

Clinical supervision principles:
- Prioritize patient safety and clinical accuracy over speed
- Acknowledge diagnostic uncertainty when present
- Consider comorbidities and differential diagnoses
- Reference ICD-11 criteria specifically (codes and specifiers)

Begin each response by acknowledging what you've heard, then proceed systematically."""

DIFFERENTIAL_REMINDER = """
Remember: If the clinical picture is ambiguous, ask ONE targeted question at a time to clarify the differential diagnosis before concluding. Do not rush to a diagnosis."""


class OllamaService:
    """
    Servizio asincrono per interagire con il server Ollama esterno.
    Supporta modelli multipli e streaming della risposta.
    """

    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.default_model = settings.ollama_default_model

    async def list_models(self) -> List[str]:
        """Recupera la lista dei modelli disponibili su Ollama."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                data = response.json()
                return [m["name"] for m in data.get("models", [])]
        except Exception as e:
            logger.warning(f"Impossibile recuperare lista modelli Ollama: {e}")
            return [self.default_model]

    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Invia una richiesta di chat ad Ollama con streaming della risposta.
        Yields token di testo man mano che vengono generati.
        """
        model_name = model or self.default_model

        # Costruisce la lista messaggi con system prompt opzionale
        full_messages = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)

        payload = {
            "model": model_name,
            "messages": full_messages,
            "stream": True,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
            }
        }

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, read=120.0)) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/chat",
                    json=payload,
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if line.strip():
                            try:
                                chunk = json.loads(line)
                                if "message" in chunk and "content" in chunk["message"]:
                                    yield chunk["message"]["content"]
                                if chunk.get("done", False):
                                    break
                            except json.JSONDecodeError:
                                continue
        except httpx.ConnectError:
            yield "\n\n[Errore: Impossibile connettersi a Ollama. Verificare che il servizio sia attivo.]"
        except httpx.TimeoutException:
            yield "\n\n[Errore: Timeout nella risposta di Ollama. Riprovare.]"
        except Exception as e:
            logger.error(f"Errore streaming Ollama: {e}")
            yield f"\n\n[Errore: {str(e)}]"

    async def run_inference(
        self,
        prompt: str,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Inferenza singola non-streaming per il benchmarking.
        Restituisce la risposta completa con metriche di latenza.
        """
        model_name = model or self.default_model
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model_name,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.3,  # Più deterministico per il benchmark
                "top_p": 0.85,
            }
        }

        start_time = time.time()
        import logging
        logging.info(f"OLLAMA DIAGNOSTIC: Calling {self.base_url}/api/chat for model {model_name}")
        
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0, read=300.0)) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                latency_ms = int((time.time() - start_time) * 1000)

                return {
                    "content": data.get("message", {}).get("content", ""),
                    "model": model_name,
                    "latency_ms": latency_ms,
                    "success": True,
                }
        except httpx.ConnectError:
            return {
                "content": "",
                "model": model_name,
                "latency_ms": int((time.time() - start_time) * 1000),
                "success": False,
                "error": "Connessione a Ollama non riuscita",
            }
        except Exception as e:
            logger.error(f"Errore inferenza Ollama ({model_name}): {e}")
            return {
                "content": "",
                "model": model_name,
                "latency_ms": int((time.time() - start_time) * 1000),
                "success": False,
                "error": str(e),
            }

    def build_benchmark_prompt(
        self,
        case_title: str,
        anamnesis: str,
        discussion: Optional[str] = None,
        language: str = "en",
    ) -> str:
        """
        Costruisce il prompt per il benchmark diagnostico.
        Include anamnesi e opzionalmente la discussione clinica.
        """
        if language == "it":
            prompt_parts = [
                f"CASO CLINICO: {case_title}",
                "\n## ANAMNESI E PRESENTAZIONE CLINICA",
                anamnesis,
            ]
            if discussion:
                prompt_parts += ["\n## DISCUSSIONE CLINICA", discussion]
            prompt_parts.append(
                "\n## RICHIESTA\nBasandoti sul caso clinico presentato, fornisci una diagnosi secondo i criteri ICD-11. "
                "Specifica il codice ICD-11, il nome della diagnosi e una breve giustificazione clinica."
            )
        else:
            prompt_parts = [
                f"CLINICAL CASE: {case_title}",
                "\n## ANAMNESIS AND CLINICAL PRESENTATION",
                anamnesis,
            ]
            if discussion:
                prompt_parts += ["\n## CLINICAL DISCUSSION", discussion]
            prompt_parts.append(
                "\n## TASK\nBased on the clinical case above, provide a diagnosis according to ICD-11 criteria. "
                "Specify the ICD-11 code, diagnosis name, and brief clinical justification."
            )

        return "\n".join(prompt_parts)

    def get_system_prompt(self, mode: str) -> str:
        """Restituisce il system prompt appropriato per la modalità di chat."""
        if mode == "wellbeing":
            return SYSTEM_PROMPT_WELLBEING
        return SYSTEM_PROMPT_ICD11


# Istanza singleton del servizio
ollama_service = OllamaService()
