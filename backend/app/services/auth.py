import logging
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

security = HTTPBearer(auto_error=False)

# Cache per le chiavi JWKS
_jwks_cache = None


def _local_development_identity() -> dict:
    return {
        "sub": "local-development-user",
        "preferred_username": "local-dev",
        "email": "local-dev@llmind.local",
    }


def _get_jwks_url() -> str:
    """
    Restituisce la JWKS URL.
    Se KEYCLOAK_JWKS_URL è esplicitamente configurato, lo usa.
    Altrimenti lo deriva dall'issuer Keycloak:
      <issuer>/protocol/openid-connect/certs
    """
    if settings.keycloak_jwks_url:
        return settings.keycloak_jwks_url.rstrip("/")
    if settings.keycloak_issuer:
        base = settings.keycloak_issuer.rstrip("/")
        return f"{base}/protocol/openid-connect/certs"
    return ""


async def get_jwks():
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    jwks_url = _get_jwks_url()
    if not jwks_url:
        logger.warning("KEYCLOAK_JWKS_URL / KEYCLOAK_ISSUER_URL non configurato.")
        return None

    try:
        async with httpx.AsyncClient(verify=settings.auth_verify_ssl) as client:
            response = await client.get(jwks_url, timeout=10.0)
            if response.status_code == 200:
                _jwks_cache = response.json()
                logger.info(f"JWKS caricato correttamente da Keycloak: {jwks_url}")
                return _jwks_cache
            else:
                logger.error(f"Impossibile caricare JWKS da Keycloak: status {response.status_code}")
    except Exception as e:
        logger.error(f"Errore durante il caricamento di JWKS: {e}")

    return None


def _handle_missing_credentials() -> dict:
    if settings.environment != "production":
        logger.warning("Autenticazione disabilitata in ambiente locale development.")
        return _local_development_identity()
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authenticated",
    )


def _handle_missing_jwks() -> dict:
    if settings.environment == "production":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Servizio di autenticazione non disponibile (JWKS mancante)"
        )
    logger.warning("JWKS non disponibile in locale: uso identità di sviluppo controllata.")
    return _local_development_identity()


def _get_token_kid(token: str) -> str:
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token non valido (kid mancante)"
        )
    return kid


def _invalidate_jwks_cache() -> None:
    global _jwks_cache
    _jwks_cache = None


def _find_rsa_key(jwks: dict, kid: str) -> dict:
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return {
                "kty": key.get("kty"),
                "kid": key.get("kid"),
                "use": key.get("use"),
                "n": key.get("n"),
                "e": key.get("e"),
            }

    logger.warning("Chiave pubblica non trovata per kid=%s — JWKS potrebbe essere scaduto. Invalido cache.", kid)
    _invalidate_jwks_cache()
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Chiave pubblica non trovata per la firma del token (kid non corrisponde)"
    )


def _validate_issuer(payload: dict) -> None:
    token_iss = payload.get("iss", "").rstrip("/")
    expected_iss = settings.keycloak_issuer.rstrip("/")
    if token_iss != expected_iss:
        logger.warning(f"Issuer non valido: atteso={expected_iss}, ricevuto={token_iss}")
        raise jwt.JWTClaimsError(f"Invalid issuer: expected {expected_iss}, got {token_iss}")


def _decode_validated_token(token: str, rsa_key: dict) -> dict:
    # Keycloak emette tokens con audience = client_id oppure "account"; l'issuer resta validato manualmente.
    payload = jwt.decode(
        token,
        rsa_key,
        algorithms=["RS256"],
        options={"verify_aud": False},
    )
    _validate_issuer(payload)
    return payload


async def verify_token(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> dict:
    """
    Verifica il token JWT ricevuto nell'header Authorization Bearer.
    Valida la firma tramite JWKS Keycloak, la scadenza e l'issuer.
    """
    if credentials is None:
        return _handle_missing_credentials()

    token = credentials.credentials
    jwks = await get_jwks()

    if not jwks:
        return _handle_missing_jwks()

    try:
        kid = _get_token_kid(token)
        rsa_key = _find_rsa_key(jwks, kid)
        return _decode_validated_token(token, rsa_key)

    except jwt.ExpiredSignatureError as e:
        logger.warning(f"Token scaduto: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessione scaduta (token scaduto)"
        )
    except jwt.JWTClaimsError as e:
        logger.warning(f"Claims non validi nel token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Claims non validi: {str(e)}"
        )
    except jwt.JWTError as e:
        logger.warning(f"Errore JWT generale: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token non valido: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Errore imprevisto verifica token: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Errore di autenticazione"
        )
