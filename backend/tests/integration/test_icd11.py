import pytest
from app.models.icd11 import ICD11Category
import uuid

@pytest.fixture
def populate_test_categories(db):
    # Clear any leftover data if any
    db.query(ICD11Category).delete()
    db.commit()

    chapter6 = ICD11Category(
        id=uuid.uuid4(),
        code="06",
        title_en="Mental, behavioural or neurodevelopmental disorders",
        level=0,
        has_children=True,
    )
    chapter7 = ICD11Category(
        id=uuid.uuid4(),
        code="07",
        title_en="Sleep-wake disorders",
        level=0,
        has_children=False,
    )
    db.add_all([chapter6, chapter7])
    db.commit()

    child6a = ICD11Category(
        id=uuid.uuid4(),
        code="6A00",
        title_en="Schizophrenia",
        title_it="Schizofrenia",
        level=1,
        parent_id=chapter6.id,
        diagnostic_criteria="Criteria for schizophrenia...",
        inclusions=["Schizophrenia inclusion"],
    )
    db.add(child6a)
    db.commit()
    return chapter6, chapter7, child6a

def test_get_chapters(client, db, populate_test_categories):
    response = client.get("/api/icd11/chapters")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["code"] == "06"
    assert data[1]["code"] == "07"

def test_get_codes_with_filters(client, db, populate_test_categories):
    chapter6, chapter7, child6a = populate_test_categories

    # Test chapter_id filter
    response = client.get(f"/api/icd11/codes?chapter_id={chapter6.id}")
    assert response.status_code == 200
    data = response.json()
    # It should return the chapter itself and its child
    codes = [item["code"] for item in data["items"]]
    assert "06" in codes
    assert "6A00" in codes
    assert "07" not in codes

    # Test has_criteria filter
    response = client.get("/api/icd11/codes?has_criteria=true")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["code"] == "6A00"

    # Test has_italian filter
    response = client.get("/api/icd11/codes?has_italian=true")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["title_it"] == "Schizofrenia"
