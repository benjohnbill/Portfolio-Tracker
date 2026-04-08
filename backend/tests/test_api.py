from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to Portfolio Tracker API"}

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_get_portfolio_history_mock():
    # Test getting history (should return mock data as DB is empty)
    response = client.get("/api/portfolio/history?period=1y")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    
    # Check data structure
    first_item = data[0]
    assert "date" in first_item
    assert "total_value" in first_item
    assert "daily_return" in first_item
    assert "benchmark_value" in first_item
    assert "alpha" in first_item
    
    # Check values logic (mock data always starts at 10M)
    assert first_item["total_value"] > 0
