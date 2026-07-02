import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException, status
from jose import jwt

from app.config import get_settings
from app.services import auth
from app.services.auth import (
    _get_jwks_url,
    get_jwks,
    verify_token,
    HTTPAuthorizationCredentials
)

@pytest.fixture(autouse=True)
def clear_jwks_cache():
    auth._jwks_cache = None
    yield
    auth._jwks_cache = None

def test_get_jwks_url_explicit():
    settings = get_settings()
    with patch.object(settings, "keycloak_jwks_url", "http://explicit-jwks/certs"):
        with patch.object(settings, "keycloak_issuer", "http://some-issuer"):
            assert _get_jwks_url() == "http://explicit-jwks/certs"

def test_get_jwks_url_derived():
    settings = get_settings()
    with patch.object(settings, "keycloak_jwks_url", ""):
        with patch.object(settings, "keycloak_issuer", "http://some-issuer"):
            assert _get_jwks_url() == "http://some-issuer/protocol/openid-connect/certs"

@pytest.mark.asyncio
async def test_get_jwks_success():
    settings = get_settings()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"keys": [{"kid": "1", "kty": "RSA"}]}

    with patch.object(settings, "keycloak_issuer", "http://issuer"):
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_response
            jwks = await get_jwks()
            assert jwks == {"keys": [{"kid": "1", "kty": "RSA"}]}
            mock_get.assert_called_once()
            
            # Test cache hits next call
            jwks_cached = await get_jwks()
            assert jwks_cached == jwks
            # httpx.get was only called once due to caching
            mock_get.assert_called_once()

@pytest.mark.asyncio
async def test_get_jwks_failure():
    settings = get_settings()
    mock_response = MagicMock()
    mock_response.status_code = 500

    with patch.object(settings, "keycloak_issuer", "http://issuer"):
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_response
            jwks = await get_jwks()
            assert jwks is None

@pytest.mark.asyncio
@patch("app.services.auth.get_jwks")
@patch("jose.jwt.get_unverified_header")
@patch("jose.jwt.get_unverified_claims")
@patch("jose.jwt.decode")
async def test_verify_token_success(mock_decode, mock_claims, mock_header, mock_get_jwks):
    settings = get_settings()
    mock_get_jwks.return_value = {
        "keys": [{"kid": "key-id-1", "kty": "RSA", "use": "sig"}]
    }
    mock_header.return_value = {"kid": "key-id-1"}
    mock_claims.return_value = {"iss": "http://issuer", "exp": 9999999999}
    mock_decode.return_value = {"sub": "user123", "iss": "http://issuer"}

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="mocked-jwt-token")
    
    with patch.object(settings, "keycloak_issuer", "http://issuer"):
        payload = await verify_token(credentials)
        assert payload == {"sub": "user123", "iss": "http://issuer"}

@pytest.mark.asyncio
@patch("app.services.auth.get_jwks")
@patch("jose.jwt.get_unverified_header")
@patch("jose.jwt.get_unverified_claims")
async def test_verify_token_issuer_mismatch(mock_claims, mock_header, mock_get_jwks):
    settings = get_settings()
    mock_get_jwks.return_value = {
        "keys": [{"kid": "key-id-1", "kty": "RSA", "use": "sig"}]
    }
    mock_header.return_value = {"kid": "key-id-1"}
    mock_claims.return_value = {"iss": "http://wrong-issuer", "exp": 9999999999}

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="mocked-jwt-token")
    
    with patch.object(settings, "keycloak_issuer", "http://expected-issuer"):
        with patch("jose.jwt.decode") as mock_decode:
            mock_decode.return_value = {"iss": "http://wrong-issuer"}
            with pytest.raises(HTTPException) as exc_info:
                await verify_token(credentials)
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "Claims non validi" in exc_info.value.detail

@pytest.mark.asyncio
@patch("app.services.auth.get_jwks")
@patch("jose.jwt.get_unverified_header")
@patch("jose.jwt.get_unverified_claims")
@patch("jose.jwt.decode")
async def test_verify_token_expired(mock_decode, mock_claims, mock_header, mock_get_jwks):
    settings = get_settings()
    mock_get_jwks.return_value = {
        "keys": [{"kid": "key-id-1", "kty": "RSA", "use": "sig"}]
    }
    mock_header.return_value = {"kid": "key-id-1"}
    mock_claims.return_value = {"iss": "http://issuer", "exp": 1000}
    mock_decode.side_effect = jwt.ExpiredSignatureError("Signature has expired")

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="mocked-jwt-token")
    
    with patch.object(settings, "keycloak_issuer", "http://issuer"):
        with pytest.raises(HTTPException) as exc_info:
            await verify_token(credentials)
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Sessione scaduta" in exc_info.value.detail

@pytest.mark.asyncio
async def test_verify_token_without_credentials_uses_local_identity_in_development():
    settings = get_settings()
    with patch.object(settings, "environment", "development"):
        payload = await verify_token(None)
        assert payload["sub"] == "local-development-user"
        assert payload["email"] == "local-dev@llmind.local"

@pytest.mark.asyncio
async def test_verify_token_without_credentials_fails_in_production():
    settings = get_settings()
    with patch.object(settings, "environment", "production"):
        with pytest.raises(HTTPException) as exc_info:
            await verify_token(None)
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN

@pytest.mark.asyncio
@patch("app.services.auth.get_jwks")
async def test_verify_token_missing_jwks_fails_in_production(mock_get_jwks):
    settings = get_settings()
    mock_get_jwks.return_value = None
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="mocked-jwt-token")

    with patch.object(settings, "environment", "production"):
        with pytest.raises(HTTPException) as exc_info:
            await verify_token(credentials)
        assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

@pytest.mark.asyncio
@patch("app.services.auth.get_jwks")
async def test_verify_token_missing_jwks_uses_local_identity_in_development(mock_get_jwks):
    settings = get_settings()
    mock_get_jwks.return_value = None
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="mocked-jwt-token")

    with patch.object(settings, "environment", "development"):
        payload = await verify_token(credentials)
        assert payload["sub"] == "local-development-user"

@pytest.mark.asyncio
@patch("app.services.auth.get_jwks")
@patch("jose.jwt.get_unverified_header")
async def test_verify_token_missing_kid_is_rejected(mock_header, mock_get_jwks):
    mock_get_jwks.return_value = {"keys": [{"kid": "key-id-1", "kty": "RSA", "use": "sig"}]}
    mock_header.return_value = {}
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="mocked-jwt-token")

    with pytest.raises(HTTPException) as exc_info:
        await verify_token(credentials)
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "kid mancante" in exc_info.value.detail
