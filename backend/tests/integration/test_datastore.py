import pytest
import uuid
import os
import shutil
from unittest.mock import MagicMock, patch
from pathlib import Path
from app.models.icd11 import ICD11Category
from app.models.datastore import Datastore

@pytest.fixture
def sample_icd_categories(db):
    # Setup test tree
    root_id = uuid.uuid4()
    sec_id1 = uuid.uuid4()
    sec_id2 = uuid.uuid4()
    child_id1 = uuid.uuid4()
    
    root = ICD11Category(
        id=root_id,
        code="06",
        title_en="Mental, behavioural or neurodevelopmental disorders",
        level=0
    )
    sec1 = ICD11Category(
        id=sec_id1,
        code="6A0",
        title_en="Neurodevelopmental disorders",
        level=1,
        parent_id=root_id
    )
    sec2 = ICD11Category(
        id=sec_id2,
        code="6B0",
        title_en="Schizophrenia or other primary psychotic disorders",
        level=1,
        parent_id=root_id
    )
    child1 = ICD11Category(
        id=child_id1,
        code="6A02",
        title_en="Autism spectrum disorder",
        level=2,
        parent_id=sec_id1,
        description="Test description for autism"
    )
    
    db.add_all([root, sec1, sec2, child1])
    db.commit()
    return {
        "root": root,
        "sec1": sec1,
        "sec2": sec2,
        "child1": child1
    }

@pytest.fixture
def mock_ingestion():
    with patch("app.routers.datastore.ingestion_service") as mock_svc:
        mock_svc.create_datastore = MagicMock()
        yield mock_svc

def test_create_datastore_full_chapter_6(client, db, sample_icd_categories, mock_ingestion):
    payload = {
        "name": "Test Full Chapter 6",
        "model_name": "gemma",
        "preset_id": "icd11_standard",
        "icd_scope": "chapter_6",
        "icd_section_ids": ""
    }
    
    # Run creation
    response = client.post("/api/datastore/create", data=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Full Chapter 6"
    assert "chapter_6" in data["description"]
    
    # Verify file was generated on disk
    datastore_id = data["id"]
    gen_dir = Path(os.getenv("DATA_DIR", "/app/data")) / "generated_datastore_sources" / datastore_id
    gen_file_path = gen_dir / "icd11_chapter_6_scope.txt"
    assert gen_file_path.exists()
    
    # Read the file to check nodes content
    with open(gen_file_path, "r", encoding="utf-8") as f:
        content = f.read()
        assert "Nodes: 4" in content
        assert "## 06 - Mental, behavioural or neurodevelopmental disorders" in content
        assert "## 6A02 - Autism spectrum disorder" in content
        
    # Clean up generated dir
    shutil.rmtree(gen_dir, ignore_errors=True)

def test_create_datastore_selected_sections(client, db, sample_icd_categories, mock_ingestion):
    sec1 = sample_icd_categories["sec1"]
    payload = {
        "name": "Test Selected Section",
        "model_name": "gemma",
        "preset_id": "icd11_standard",
        "icd_scope": "sections",
        "icd_section_ids": str(sec1.id)
    }
    
    # Run creation
    response = client.post("/api/datastore/create", data=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Selected Section"
    
    # Verify file was generated on disk
    datastore_id = data["id"]
    gen_dir = Path(os.getenv("DATA_DIR", "/app/data")) / "generated_datastore_sources" / datastore_id
    gen_file_path = gen_dir / "icd11_chapter_6_scope.txt"
    assert gen_file_path.exists()
    
    # Read the file to check nodes content (should only include sec1 and its children, total 2)
    with open(gen_file_path, "r", encoding="utf-8") as f:
        content = f.read()
        assert "Nodes: 2" in content
        assert "## 6A0 - Neurodevelopmental disorders" in content
        assert "## 6A02 - Autism spectrum disorder" in content
        assert "Schizophrenia" not in content  # sec2 is excluded
        
    # Clean up generated dir
    shutil.rmtree(gen_dir, ignore_errors=True)

def test_list_and_delete_datastore(client, db, mock_ingestion):
    # Manually insert a datastore
    ds_id = uuid.uuid4()
    datastore = Datastore(
        id=ds_id,
        name="Manual DS",
        description="Manual description",
        model_name="gemma",
        source_file="manual.txt",
        vector_path="/tmp/ds_vector",
        status="ready"
    )
    db.add(datastore)
    db.commit()
    
    # List
    response = client.get("/api/datastore/list")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(ds["id"] == str(ds_id) for ds in data)
    
    # Delete
    del_response = client.delete(f"/api/datastore/{ds_id}")
    assert del_response.status_code == 200
    assert "deleted" in del_response.json()["message"].lower()
    
    # Verify deleted
    response = client.get("/api/datastore/list")
    data = response.json()
    assert not any(ds["id"] == str(ds_id) for ds in data)
