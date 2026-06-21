def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "llmind2-backend"

def test_root_endpoint(client):
    response = client.get("/")
    # Redirects to /docs or returns redirect
    assert response.status_code in [200, 307, 302, 303]
