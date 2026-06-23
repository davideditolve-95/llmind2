import pytest
import json
from uuid import uuid4
from unittest.mock import AsyncMock, patch, MagicMock
from app.models.chat import ChatSession, ChatMessage

@pytest.fixture
def mock_ollama_in_router():
    with patch("app.routers.chat.ollama_service") as mock_svc:
        mock_svc.base_url = "http://mock-ollama:11434"
        mock_svc.default_model = "gemma-test"
        mock_svc.list_models = AsyncMock(return_value=["gemma-test", "llama3"])
        mock_svc.run_inference = AsyncMock(return_value={
            "content": "Test inference response",
            "model": "gemma-test",
            "latency_ms": 150,
            "success": True
        })
        async def mock_chat_stream(*args, **kwargs):
            yield "Hello "
            yield "from "
            yield "mock "
            yield "chat!"
        mock_svc.chat_stream = mock_chat_stream
        mock_svc.get_system_prompt = MagicMock(return_value="System prompt")
        yield mock_svc

def test_chat_health(client, mock_ollama_in_router):
    response = client.get("/api/chat/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["models_count"] == 2
    assert "latency_ms" in data

def test_chat_models(client, mock_ollama_in_router):
    response = client.get("/api/chat/models")
    assert response.status_code == 200
    data = response.json()
    assert data["models"] == ["gemma-test", "llama3"]
    assert data["default_model"] == "gemma-test"

def test_test_inference(client, mock_ollama_in_router):
    payload = {
        "prompt": "Explain depression",
        "model_name": "gemma-test",
        "system_prompt": "You are a psychologist"
    }
    response = client.post("/api/chat/test", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "Test inference response"
    assert data["success"] is True

def test_sessions_crud(client, db):
    # Create session
    session_id = uuid4()
    session = ChatSession(id=session_id, title="Test Session", mode="icd11", is_active=True, user_email="test@example.com")
    db.add(session)
    db.commit()

    # List sessions
    response = client.get("/api/chat/sessions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(s["id"] == str(session_id) for s in data)

    # Update session title
    patch_response = client.patch(f"/api/chat/sessions/{session_id}?title=New Title")
    assert patch_response.status_code == 200
    assert patch_response.json()["title"] == "New Title"

def test_chat_stream_and_history(client, db, mock_ollama_in_router):
    session_id = str(uuid4())
    payload = {
        "session_id": session_id,
        "message": "User query",
        "model_name": "gemma-test",
        "mode": "icd11"
    }
    
    # 1. Call the stream endpoint
    response = client.post("/api/chat/stream", json=payload)
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    
    # Parse SSE output
    lines = [line for line in response.iter_lines() if line]
    data_events = [line for line in lines if line.startswith("data:")]
    assert len(data_events) >= 5 # 4 chunks + DONE
    
    # 2. Verify history contains the user message and assistant's response
    history_response = client.get(f"/api/chat/history/{session_id}")
    assert history_response.status_code == 200
    history_data = history_response.json()
    assert len(history_data["messages"]) == 2
    assert history_data["messages"][0]["role"] == "user"
    assert history_data["messages"][0]["content"] == "User query"
    assert history_data["messages"][1]["role"] == "assistant"
    assert history_data["messages"][1]["content"] == "Hello from mock chat!"

    # 3. Clear history
    delete_response = client.delete(f"/api/chat/history/{session_id}")
    assert delete_response.status_code == 200
    
    # Session shouldn't exist anymore
    verify_response = client.get(f"/api/chat/history/{session_id}")
    assert verify_response.status_code == 404
