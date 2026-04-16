"""
Client per l'API ICD-11 offline (container WHO).
Gestisce l'autenticazione OAuth e il recupero dei dati della gerarchia.
"""

import httpx
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import logging
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ICD11Client:
    """
    Client HTTP asincrono per il container ICD-11 offline WHO.
    Gestisce il token OAuth e le chiamate all'API di classificazione.
    """

    def __init__(self):
        self.base_url = settings.icd11_api_url
        self.client_id = settings.icd11_client_id
        self.client_secret = settings.icd11_client_secret
        self._token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None

    # ─── Autenticazione OAuth ────────────────────────────────────────────

    async def _get_token(self) -> Optional[str]:
        """
        Ottiene il token di accesso OAuth dal container offline.
        Il token viene memorizzato in cache fino alla scadenza.
        Se le credenziali non sono configurate, restituisce None (accesso anonimo).
        """
        # Se le credenziali non sono configurate, usa accesso anonimo
        if not self.client_id or not self.client_secret:
            return None

        # Controlla se il token in cache è ancora valido
        if self._token and self._token_expires_at and datetime.utcnow() < self._token_expires_at:
            return self._token

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/connect/token",
                    data={
                        "grant_type": "client_credentials",
                        "scope": "icdapi_access",
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                    },
                    headers={
                        "Content-Type": "application/x-www-form-urlencoded",
                        "API-Version": "v2"
                    },
                )
                response.raise_for_status()
                data = response.json()
                self._token = data["access_token"]
                # Scade 5 minuti prima del timeout reale per sicurezza
                expires_in = data.get("expires_in", 3600)
                self._token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in - 300)
                logger.info("Token OAuth ICD-11 ottenuto con successo")
                return self._token
        except Exception as e:
            logger.warning(f"Impossibile ottenere token OAuth ICD-11: {e}. Uso accesso anonimo.")
            return None

    def _build_headers(self, token: Optional[str], language: str = "en") -> Dict[str, str]:
        """Costruisce gli header HTTP per le richieste all'API ICD-11."""
        headers = {
            "Accept": "application/json",
            "Accept-Language": language,
            "API-Version": "v2",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    # ─── Metodi API ──────────────────────────────────────────────────────

    async def get_entity(self, uri: str, language: str = "en") -> Optional[Dict[str, Any]]:
        """
        Recupera un'entità ICD-11 tramite il suo URI.
        Supporta sia URI completi che codici relativi.
        """
        token = await self._get_token()
        headers = self._build_headers(token, language)

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                # Localizza l'URI se punta ai server ufficiali WHO
                target_url = uri
                if uri.startswith("http://id.who.int") or uri.startswith("https://id.who.int"):
                    target_url = uri.replace("https://id.who.int", self.base_url).replace("http://id.who.int", self.base_url)
                elif not uri.startswith("http"):
                    target_url = f"{self.base_url}{uri}"
                
                logger.debug(f"Richiesta ICD-11: {target_url}")
                response = await client.get(target_url, headers=headers)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"Errore HTTP recupero entità {uri}: {e.response.status_code}")
                return None
            except Exception as e:
                logger.error(f"Errore recupero entità {uri}: {e}")
                return None

    async def get_mms_root(self, language: str = "en") -> Optional[Dict[str, Any]]:
        """Recupera la radice della classificazione MMS (Linearizzazione ICD-11)."""
        return await self.get_entity(f"{self.base_url}/icd/release/11/mms", language)

    async def get_mms_entity(self, code_or_id: str, language: str = "en") -> Optional[Dict[str, Any]]:
        """Recupera un'entità MMS tramite il suo codice o ID numerico."""
        return await self.get_entity(f"{self.base_url}/icd/release/11/mms/{code_or_id}", language)

    async def search(self, query: str, language: str = "en", limit: int = 20) -> List[Dict[str, Any]]:
        """
        Ricerca full-text nell'ICD-11.
        Restituisce un elenco di entità corrispondenti alla query.
        """
        token = await self._get_token()
        headers = self._build_headers(token, language)
        headers["Accept"] = "application/json"

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/icd/release/11/mms/search",
                    params={
                        "q": query,
                        "useFlexisearch": True,
                        "flatResults": True,
                        "highlightingEnabled": False,
                        "limit": limit,
                    },
                    headers=headers,
                )
                response.raise_for_status()
                data = response.json()
                return data.get("destinationEntities", [])
            except Exception as e:
                logger.error(f"Errore ricerca ICD-11 '{query}': {e}")
                return []

    async def get_children_recursive(
        self,
        entity: Dict[str, Any],
        current_level: int = 0,
        max_level: int = 2,
        language: str = "en"
    ) -> List[Dict[str, Any]]:
        """
        Recupera ricorsivamente i figli di un'entità fino alla profondità massima specificata.
        Usato dallo script ETL per popolare il database.
        """
        if current_level >= max_level:
            return []

        children_uris = entity.get("child", [])
        results = []

        # Processa i figli in batch per evitare troppi request paralleli
        for i in range(0, len(children_uris), 5):
            batch = children_uris[i:i + 5]
            child_entities = await asyncio.gather(
                *[self.get_entity(uri, language) for uri in batch],
                return_exceptions=True
            )
            for child in child_entities:
                if isinstance(child, dict):
                    child["_level"] = current_level + 1
                    child["_children"] = await self.get_children_recursive(
                        child, current_level + 1, max_level, language
                    )
                    results.append(child)
            # Pausa breve per non sovraccaricare il container
            await asyncio.sleep(0.1)

        return results

    def extract_title(self, entity: Dict[str, Any], language: str = "en") -> str:
        """Estrae il titolo dell'entità in modo sicuro dal formato ICD-11."""
        title = entity.get("title", {})
        if isinstance(title, dict):
            return title.get("@value", title.get("value", "Untitled"))
        return str(title) if title else "Untitled"

    def extract_code(self, entity: Dict[str, Any]) -> Optional[str]:
        """Estrae il codice ICD-11 dall'entità."""
        return entity.get("code") or entity.get("classKind")

    def extract_uri(self, entity: Dict[str, Any]) -> Optional[str]:
        """Estrae l'URI foundation dal JSON-LD dell'entità."""
        return entity.get("@id") or entity.get("foundationChildElsewhere")

    def extract_list(self, entity: Dict[str, Any], key: str, language: str = "en") -> List[str]:
        """Estrae una lista di etichette da un campo (es. inclusion, exclusion)."""
        items = entity.get(key, [])
        results = []
        for item in items:
            label = item.get("label", {})
            if isinstance(label, dict):
                val = label.get("@value", label.get("value"))
                if val:
                    results.append(val)
            elif isinstance(label, str):
                results.append(label)
        return results


# Istanza singleton del client
icd11_client = ICD11Client()
