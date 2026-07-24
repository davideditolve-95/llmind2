import pytest
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models.icd11 import ICD11Category
from app.routers.datastore import get_descendants, format_category_node

# In-memory SQLite for testing helpers
engine = create_engine("sqlite://")
TestingSessionLocal = sessionmaker(bind=engine)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()

def test_format_category_node():
    node = ICD11Category(
        id=uuid.uuid4(),
        code="6A02",
        title_en="Autism spectrum disorder",
        description="Autism spectrum disorder is characterised by persistent deficits in initiating and sustaining social interaction...",
        level=2,
        inclusions=["Autistic disorder", "Infantile autism"],
        exclusions=["Rett syndrome"],
        index_terms=["ASD"],
        diagnostic_criteria="Essential Features: Deficits in social communication..."
    )
    
    formatted = format_category_node(node)
    
    assert "## 6A02 - Autism spectrum disorder" in formatted
    assert "Level: 2" in formatted
    assert "Description: Autism spectrum disorder is characterised by persistent deficits" in formatted
    assert "Inclusions: Autistic disorder; Infantile autism" in formatted
    assert "Exclusions: Rett syndrome" in formatted
    assert "Index terms: ASD" in formatted
    assert "Diagnostic criteria: Essential Features: Deficits in social communication..." in formatted

def test_get_descendants(db_session):
    # Setup test tree
    root_id = uuid.uuid4()
    sec_id1 = uuid.uuid4()
    sec_id2 = uuid.uuid4()
    child_id1 = uuid.uuid4()
    
    root = ICD11Category(id=root_id, code="06", title_en="Chapter 6", level=0)
    sec1 = ICD11Category(id=sec_id1, code="6A0", title_en="Section 1", level=1, parent_id=root_id)
    sec2 = ICD11Category(id=sec_id2, code="6B0", title_en="Section 2", level=1, parent_id=root_id)
    child1 = ICD11Category(id=child_id1, code="6A00", title_en="Sub child 1", level=2, parent_id=sec_id1)
    
    db_session.add_all([root, sec1, sec2, child1])
    db_session.commit()
    
    # Test descendants from root
    descendants = get_descendants(db_session, [root_id])
    assert len(descendants) == 4
    assert descendants[0].id == root_id
    assert descendants[1].id == sec1.id
    assert descendants[2].id == sec2.id
    assert descendants[3].id == child1.id
    
    # Test descendants from section 1
    desc_sec1 = get_descendants(db_session, [sec_id1])
    assert len(desc_sec1) == 2
    assert desc_sec1[0].id == sec1.id
    assert desc_sec1[1].id == child1.id


def test_fallback_ollama_embeddings(mocker):
    from app.services.embeddings import FallbackOllamaEmbeddings

    embedder = FallbackOllamaEmbeddings("gemma2:27b")
    mock_primary = mocker.MagicMock()
    mock_primary.embed_query.side_effect = Exception("HTTP code: 500 --embeddings not supported")
    embedder.primary = mock_primary

    mocker.patch.object(embedder.fallback, "embed_query", return_value=[0.1, 0.2, 0.3])

    result = embedder.embed_query("test query")
    assert result == [0.1, 0.2, 0.3]

