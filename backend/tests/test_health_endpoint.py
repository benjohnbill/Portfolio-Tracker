from fastapi.testclient import TestClient
from app.main import app


def test_healthz_returns_200_without_db():
    client = TestClient(app)
    response = client.get("/api/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
