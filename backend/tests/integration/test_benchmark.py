import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, patch, MagicMock
from app.models.benchmark import DSM5Case, BenchmarkRun, ManualEvaluation

@pytest.fixture
def mock_services():
    with patch("app.routers.benchmark.ollama_service") as mock_ollama, \
         patch("app.routers.benchmark.embedding_service") as mock_embed:
        
        mock_ollama.build_benchmark_prompt = MagicMock(return_value="Mocked Prompt")
        mock_ollama.run_inference = AsyncMock(return_value={
            "content": "ICD-11 Diagnosis: Depression",
            "model": "gemma-test",
            "latency_ms": 250,
            "success": True
        })
        
        mock_embed.compute_cosine_similarity = MagicMock(return_value=0.85)
        
        yield mock_ollama, mock_embed

@pytest.fixture
def sample_case(db):
    case = DSM5Case(
        id=uuid4(),
        case_number="Case 1.1",
        title="Schizophrenia Study",
        anamnesis="Patient hears voices.",
        discussion="Rule out substance induced.",
        gold_standard_diagnosis="Schizophrenia (6A20)",
        is_reviewed=True
    )
    db.add(case)
    db.commit()
    return case

def test_run_benchmark(client, sample_case, mock_services):
    payload = {
        "case_ids": [str(sample_case.id)],
        "model_names": ["gemma-test"],
        "include_discussion": True,
        "prompt_language": "en"
    }
    
    # We call run_benchmark which spawns a background task
    response = client.post("/api/benchmark/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "batch_id" in data
    assert data["total_runs"] == 1
    
    # Check that a BenchmarkRun was created in pending state
    batch_id = data["batch_id"]
    history_response = client.get(f"/api/benchmark/history?batch_id={batch_id}")
    assert history_response.status_code == 200
    history_data = history_response.json()
    assert history_data["total"] == 1
    assert history_data["items"][0]["status"] in ["pending", "running", "completed"]

def test_retry_run(client, sample_case, db, mock_services):
    # Create a failed run manually
    run_id = uuid4()
    run = BenchmarkRun(
        id=run_id,
        case_id=sample_case.id,
        model_name="gemma-test",
        prompt_used="Old prompt",
        status="failed",
        error_message="Timeout error"
    )
    db.add(run)
    db.commit()
    
    response = client.post(f"/api/benchmark/runs/{run_id}/retry")
    assert response.status_code == 200
    assert response.json()["run_id"] == str(run_id)

def test_manual_evaluations(client, sample_case, db):
    # Create completed run
    run_id = uuid4()
    run = BenchmarkRun(
        id=run_id,
        case_id=sample_case.id,
        model_name="gemma-test",
        prompt_used="Prompt",
        status="completed",
        similarity_score=0.9
    )
    db.add(run)
    db.commit()

    # Add evaluation
    payload = {
        "evaluator_name": "Dr. Smith",
        "rating": 5,
        "notes": "Excellent clinical reasoning."
    }
    response = client.post(f"/api/benchmark/runs/{run_id}/evaluations", json=payload)
    assert response.status_code == 200
    eval_data = response.json()
    assert eval_data["evaluator_name"] == "Dr. Smith"
    assert eval_data["rating"] == 5
    eval_id = eval_data["id"]

    # Retrieve history to confirm evaluations are populated
    history_res = client.get(f"/api/benchmark/history?case_id={sample_case.id}")
    assert history_res.status_code == 200
    history_data = history_res.json()
    assert len(history_data["items"][0]["evaluations"]) == 1
    assert history_data["items"][0]["evaluations"][0]["evaluator_name"] == "Dr. Smith"

    # Delete evaluation
    del_res = client.delete(f"/api/benchmark/runs/{run_id}/evaluations/{eval_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

def test_kpis_dashboard(client, sample_case, db):
    # Create complete run with evaluation
    run_id = uuid4()
    run = BenchmarkRun(
        id=run_id,
        case_id=sample_case.id,
        model_name="gemma-test",
        prompt_used="Prompt",
        status="completed",
        similarity_score=0.8,
        latency_ms=300
    )
    db.add(run)
    db.flush()
    
    evaluation = ManualEvaluation(
        run_id=run_id,
        evaluator_name="Dr. Jones",
        rating=4,
        notes="Solid"
    )
    db.add(evaluation)
    db.commit()

    response = client.get("/api/benchmark/kpis")
    assert response.status_code == 200
    data = response.json()
    assert data["total_cases"] == 1
    assert data["total_runs"] == 1
    assert len(data["model_kpis"]) == 1
    assert data["model_kpis"][0]["model_name"] == "gemma-test"
    assert data["model_kpis"][0]["avg_similarity"] == 0.8
    assert data["model_kpis"][0]["avg_human_rating"] == 4.0

def test_export_data(client, sample_case, db):
    run_id = uuid4()
    run = BenchmarkRun(
        id=run_id,
        case_id=sample_case.id,
        model_name="gemma-test",
        prompt_used="Prompt",
        status="completed",
        similarity_score=0.8,
        latency_ms=300
    )
    db.add(run)
    db.commit()

    # JSON export
    response = client.get("/api/benchmark/export?format=json")
    assert response.status_code == 200
    assert "application/json" in response.headers["content-type"]
    
    # CSV export
    response_csv = client.get("/api/benchmark/export?format=csv")
    assert response_csv.status_code == 200
    assert "text/csv" in response_csv.headers["content-type"]
