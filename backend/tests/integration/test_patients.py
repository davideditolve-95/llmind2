import pytest
from uuid import uuid4, UUID
from unittest.mock import AsyncMock, patch, MagicMock
from app.models.patient import Patient
from app.models.benchmark import DSM5Case
from app.models.chat import ChatSession


@pytest.fixture
def mock_ollama_for_conversion():
    with patch("app.routers.patient.ollama_service") as mock_svc:
        mock_svc.default_model = "gemma-test"
        mock_svc.run_inference = AsyncMock(return_value={
            "content": '{"name": "Rossi Mario", "age": 45, "gender": "Male", "behaviors": "Anxiety, insomnia", "specific_traits": "Nervous, cooperative", "clinical_history": "Symptoms started 6 months ago"}',
            "model": "gemma-test",
            "latency_ms": 200,
            "success": True
        })
        yield mock_svc


def test_create_and_get_patient(client, db):
    payload = {
        "name": "Rossi Mario",
        "age": 45,
        "gender": "Male",
        "behaviors": "Soffre di ansia da prestazione",
        "specific_traits": "Perfezionista, collaborativo",
        "clinical_history": "Nessun trattamento pregresso"
    }

    # POST create
    response = client.post("/api/patients", json=payload)
    assert response.status_code == 201
    created = response.json()
    assert created["name"] == "Rossi Mario"
    assert created["age"] == 45
    assert "id" in created
    assert created["owner_email"] == "test@example.com"

    patient_uuid = created["id"]

    # GET details
    get_res = client.get(f"/api/patients/{patient_uuid}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Rossi Mario"


def test_list_and_search_patients(client, db):
    # Insert two patients
    p1 = Patient(owner_email="test@example.com", name="Rossi Mario", age=45, behaviors="Insomnia")
    p2 = Patient(owner_email="test@example.com", name="Bianchi Luigi", age=30, behaviors="Panic attacks")
    db.add_all([p1, p2])
    db.commit()

    # List all
    response = client.get("/api/patients")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2

    # Search by name
    res_search = client.get("/api/patients?search=Luigi")
    assert res_search.status_code == 200
    data_search = res_search.json()
    assert len(data_search) == 1
    assert data_search[0]["name"] == "Bianchi Luigi"


def test_update_and_delete_patient(client, db):
    p = Patient(owner_email="test@example.com", name="Rossi Mario", age=45)
    db.add(p)
    db.commit()
    db.refresh(p)

    # PUT update
    update_payload = {"age": 46, "gender": "Male"}
    put_res = client.put(f"/api/patients/{p.id}", json=update_payload)
    assert put_res.status_code == 200
    assert put_res.json()["age"] == 46
    assert put_res.json()["gender"] == "Male"

    # DELETE
    del_res = client.delete(f"/api/patients/{p.id}")
    assert del_res.status_code == 200
    assert del_res.json()["deleted"] is True

    # Get again -> 404
    get_res = client.get(f"/api/patients/{p.id}")
    assert get_res.status_code == 404


def test_patient_data_isolation(client, db):
    # Patient owned by someone else
    other_patient = Patient(owner_email="other@example.com", name="Stranger", age=50)
    db.add(other_patient)
    db.commit()
    db.refresh(other_patient)

    # test@example.com client tries to get details -> 403
    get_res = client.get(f"/api/patients/{other_patient.id}")
    assert get_res.status_code == 403

    # tries to update -> 403
    put_res = client.put(f"/api/patients/{other_patient.id}", json={"age": 51})
    assert put_res.status_code == 403

    # tries to delete -> 403
    del_res = client.delete(f"/api/patients/{other_patient.id}")
    assert del_res.status_code == 403


def test_convert_case_to_patient(client, db, mock_ollama_for_conversion):
    # Insert DSM-5 case
    case = DSM5Case(
        case_number="1.1",
        title="Depressive episode case",
        anamnesis="Patient exhibits deep sadness and lack of interest.",
        gold_standard_diagnosis="Major Depressive Disorder"
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    # POST conversion endpoint
    response = client.post(f"/api/patients/convert-from-case/{case.id}")
    assert response.status_code == 200
    patient_data = response.json()
    assert patient_data["name"] == "Rossi Mario"
    assert patient_data["age"] == 45
    assert patient_data["behaviors"] == "Anxiety, insomnia"
    assert patient_data["owner_email"] == "test@example.com"


def test_chat_context_patient_injection(client, db):
    # 1. Create Patient
    p = Patient(owner_email="test@example.com", name="Rossi Mario", age=45, behaviors="Panic attacks")
    db.add(p)
    db.commit()
    db.refresh(p)

    # 2. Create Chat Session
    session_id = uuid4()
    session = ChatSession(id=session_id, title="Panic session", mode="icd11", user_email="test@example.com")
    db.add(session)
    db.commit()

    # 3. Associate patient to session
    patch_res = client.patch(f"/api/chat/sessions/{session_id}?patient_id={p.id}")
    assert patch_res.status_code == 200
    assert patch_res.json()["patient_id"] == str(p.id)

    # 4. Fetch history and assert patient_id
    history_res = client.get(f"/api/chat/history/{session_id}")
    assert history_res.status_code == 200
    assert history_res.json()["patient_id"] == str(p.id)

    # 5. Call stream endpoint and verify context gets injected in system prompt
    payload = {
        "session_id": str(session_id),
        "message": "User query",
        "model_name": "gemma-test",
        "mode": "icd11",
        "patient_id": str(p.id)
    }

    mock_chat_stream = AsyncMock()
    async def mock_generator(*args, **kwargs):
        # Inspect system_prompt argument passed to chat_stream
        sys_prompt = kwargs.get("system_prompt", "")
        assert "CONTEXT CLINICO DEL PAZIENTE ATTIVO" in sys_prompt
        assert "Rossi Mario" in sys_prompt
        yield "Response"

    with patch("app.routers.chat.ollama_service") as mock_ollama_chat:
        mock_ollama_chat.chat_stream = mock_generator
        mock_ollama_chat.get_system_prompt = MagicMock(return_value="System prompt")
        response = client.post("/api/chat/stream", json=payload)
        assert response.status_code == 200
