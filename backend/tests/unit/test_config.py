import os
import pytest
from app.config import get_settings, Settings

def test_settings_load():
    settings = get_settings()
    assert settings is not None
    assert isinstance(settings, Settings)

def test_settings_env_override(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "testing_env")
    monkeypatch.setenv("OLLAMA_DEFAULT_MODEL", "llama3")
    
    # Force reload settings by instantiating Settings directly or clearing cache if any
    # get_settings uses lru_cache, so let's check if we can clear it or if we test Settings class
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.environment == "testing_env"
    assert settings.ollama_default_model == "llama3"
    
    # Restore
    get_settings.cache_clear()
