import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.main import app
from app.services.auth import verify_token

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID

# Compile rules to map PostgreSQL-specific types to SQLite equivalents during tests
@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

@compiles(PG_UUID, "sqlite")
def compile_uuid_sqlite(type_, compiler, **kw):
    return "CHAR(36)"

# In-memory SQLite database for fast isolated testing
DATABASE_URL = "sqlite://"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    # Import all models to ensure they are registered on Base.metadata
    from app.models import icd11, benchmark, chat, datastore
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="function")
def mock_user():
    return {
        "sub": "user-uuid-12345",
        "email": "test@example.com",
        "name": "Test User",
        "preferred_username": "testuser",
        "email_verified": True
    }

@pytest.fixture(scope="function")
def client(db, mock_user):
    # Override get_db to use testing session
    def override_get_db():
        try:
            yield db
        finally:
            pass
            
    # Override verify_token to bypass Keycloak signature check
    def override_verify_token():
        return mock_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[verify_token] = override_verify_token
    
    with TestClient(app) as test_client:
        yield test_client
        
    app.dependency_overrides.clear()
