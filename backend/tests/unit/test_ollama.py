import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.ollama import OllamaService, SYSTEM_PROMPT_WELLBEING, SYSTEM_PROMPT_ICD11

@pytest.fixture
def ollama_service():
    with patch("app.services.ollama.settings") as mock_settings:
        mock_settings.ollama_base_url = "http://mock-ollama:11434"
        mock_settings.ollama_default_model = "gemma-test"
        yield OllamaService()

def test_get_system_prompt(ollama_service):
    assert ollama_service.get_system_prompt("wellbeing") == SYSTEM_PROMPT_WELLBEING
    assert ollama_service.get_system_prompt("icd11") == SYSTEM_PROMPT_ICD11
    assert ollama_service.get_system_prompt("other") == SYSTEM_PROMPT_ICD11

def test_build_benchmark_prompt(ollama_service):
    # Test Italian
    prompt_it = ollama_service.build_benchmark_prompt("Titolo", "Anamnesi", "Discussione", "it")
    assert "CASO CLINICO: Titolo" in prompt_it
    assert "## ANAMNESI E PRESENTAZIONE CLINICA" in prompt_it
    assert "Anamnesi" in prompt_it
    assert "## DISCUSSIONE CLINICA" in prompt_it
    assert "Discussione" in prompt_it
    assert "criteri ICD-11" in prompt_it

    # Test English
    prompt_en = ollama_service.build_benchmark_prompt("Title", "Anamnesis", None, "en")
    assert "CLINICAL CASE: Title" in prompt_en
    assert "## ANAMNESIS AND CLINICAL PRESENTATION" in prompt_en
    assert "Anamnesis" in prompt_en
    assert "## CLINICAL DISCUSSION" not in prompt_en
    assert "ICD-11 criteria" in prompt_en

@pytest.mark.asyncio
@patch("httpx.AsyncClient.get", new_callable=AsyncMock)
async def test_list_models_success(mock_get, ollama_service):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "models": [{"name": "model1"}, {"name": "model2"}]
    }
    mock_get.return_value = mock_response

    models = await ollama_service.list_models()
    assert models == ["model1", "model2"]
    mock_get.assert_called_once_with("http://mock-ollama:11434/api/tags")

@pytest.mark.asyncio
@patch("httpx.AsyncClient.get", new_callable=AsyncMock)
async def test_list_models_failure(mock_get, ollama_service):
    mock_get.side_effect = Exception("Connection refused")
    models = await ollama_service.list_models()
    assert models == ["gemma-test"]

@pytest.mark.asyncio
@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_run_inference_success(mock_post, ollama_service):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "message": {"content": "Clinical response"}
    }
    mock_post.return_value = mock_response

    res = await ollama_service.run_inference("Hello prompt")
    assert res["success"] is True
    assert res["content"] == "Clinical response"
    assert res["model"] == "gemma-test"
    assert "latency_ms" in res

@pytest.mark.asyncio
@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_run_inference_connect_error(mock_post, ollama_service):
    mock_post.side_effect = httpx.ConnectError("Cannot connect")
    res = await ollama_service.run_inference("Hello prompt")
    assert res["success"] is False
    assert res["content"] == ""
    assert "Connessione a Ollama" in res["error"]

@pytest.mark.asyncio
@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_run_inference_general_error(mock_post, ollama_service):
    mock_post.side_effect = Exception("Unknown")
    res = await ollama_service.run_inference("Hello prompt")
    assert res["success"] is False
    assert res["error"] == "Unknown"

@pytest.mark.asyncio
async def test_chat_stream_success(ollama_service):
    mock_lines = [
        b'{"message": {"content": "Hello "}, "done": false}',
        b'{"message": {"content": "world"}, "done": true}'
    ]
    
    class MockResponse:
        def __init__(self):
            self.status_code = 200
        async def aiter_lines(self):
            for line in mock_lines:
                yield line.decode("utf-8")
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass
        def raise_for_status(self):
            pass

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass
        def stream(self, *args, **kwargs):
            return MockResponse()

    with patch("httpx.AsyncClient", MockAsyncClient):
        chunks = []
        async for chunk in ollama_service.chat_stream([{"role": "user", "content": "hi"}], "test-model"):
            chunks.append(chunk)
        assert chunks == ["Hello ", "world"]

@pytest.mark.asyncio
async def test_chat_stream_connect_error(ollama_service):
    class MockResponseWithError:
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass
        async def aiter_lines(self):
            raise httpx.ConnectError("Connection failed")
            yield ""  # Make it a generator
        def raise_for_status(self):
            pass

    class MockFailureClient:
        def __init__(self, *args, **kwargs):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass
        def stream(self, *args, **kwargs):
            return MockResponseWithError()
    
    with patch("httpx.AsyncClient", MockFailureClient):
        chunks = []
        async for chunk in ollama_service.chat_stream([{"role": "user", "content": "hi"}], "test-model"):
            chunks.append(chunk)
        assert len(chunks) == 1
        assert "Impossibile connettersi a Ollama" in chunks[0]
