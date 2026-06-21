import pytest
from uuid import uuid4
from app.models.benchmark import DSM5Case

@pytest.fixture
def sample_cases(db):
    case1 = DSM5Case(
        id=uuid4(),
        case_number="Case 1.1",
        title="Schizophrenia Case Study",
        anamnesis="Patient exhibits delusions and auditory hallucinations.",
        discussion="Differential diagnosis includes schizophreniform disorder.",
        gold_standard_diagnosis="Schizophrenia (6A20)",
        source_page=12,
        is_reviewed=True
    )
    case2 = DSM5Case(
        id=uuid4(),
        case_number="Case 1.2",
        title="Major Depressive Case",
        anamnesis="Persistent low mood and fatigue for 3 weeks.",
        discussion="Must rule out bipolar disorder.",
        gold_standard_diagnosis="Major Depressive Disorder (6A70)",
        source_page=15,
        is_reviewed=False
    )
    db.add(case1)
    db.add(case2)
    db.commit()
    return [case1, case2]

def test_list_cases(client, sample_cases):
    response = client.get("/api/cases")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    
    # Check attributes of items
    titles = [item["title"] for item in data["items"]]
    assert "Schizophrenia Case Study" in titles
    assert "Major Depressive Case" in titles

def test_list_cases_filter_reviewed(client, sample_cases):
    response = client.get("/api/cases?reviewed_only=true")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Schizophrenia Case Study"

def test_list_cases_search(client, sample_cases):
    response = client.get("/api/cases?search=depressive")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Major Depressive Case"

def test_get_case_detail(client, sample_cases):
    case = sample_cases[0]
    response = client.get(f"/api/cases/{case.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Schizophrenia Case Study"
    assert data["anamnesis"] == "Patient exhibits delusions and auditory hallucinations."
    assert data["gold_standard_diagnosis"] == "Schizophrenia (6A20)"

def test_get_case_not_found(client):
    random_uuid = str(uuid4())
    response = client.get(f"/api/cases/{random_uuid}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Caso clinico non trovato"

def test_update_case(client, sample_cases):
    case = sample_cases[1]
    update_payload = {
        "title": "Updated Major Depressive Case",
        "is_reviewed": True,
        "review_notes": "Reviewed and verified."
    }
    response = client.put(f"/api/cases/{case.id}", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Major Depressive Case"
    assert data["is_reviewed"] is True
    assert data["review_notes"] == "Reviewed and verified."

def test_delete_case(client, sample_cases):
    case = sample_cases[0]
    response = client.delete(f"/api/cases/{case.id}")
    assert response.status_code == 200
    assert response.json()["deleted"] is True
    
    # Verify it was deleted
    verify_response = client.get(f"/api/cases/{case.id}")
    assert verify_response.status_code == 404

def test_get_cases_stats(client, sample_cases):
    response = client.get("/api/cases/stats/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_cases"] == 2
    assert data["reviewed"] == 1
    assert data["pending_review"] == 1
