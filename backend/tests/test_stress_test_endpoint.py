from unittest.mock import patch
from sqlalchemy import event
from app.models import Asset, Transaction


def test_stress_test_uses_single_asset_query(db_session, client):
    # Seed two holdings.
    a1 = Asset(symbol="AAA", source="US", name="A")
    a2 = Asset(symbol="BBB", source="US", name="B")
    db_session.add_all([a1, a2])
    db_session.commit()
    db_session.add_all([
        Transaction(asset_id=a1.id, type="BUY", quantity=10, price=100, total_amount=1000),
        Transaction(asset_id=a2.id, type="BUY", quantity=5, price=200, total_amount=1000),
    ])
    db_session.commit()

    query_count = {"n": 0}

    @event.listens_for(db_session.bind, "before_cursor_execute")
    def count(conn, cursor, statement, parameters, context, executemany):
        if "FROM assets" in statement or "FROM asset" in statement.lower():
            query_count["n"] += 1

    with patch(
        "app.services.price_service.PriceService.get_current_price",
        return_value=100.0,
    ), patch(
        "app.services.stress_service.StressService.run_simulation",
        return_value=[],
    ):
        response = client.get("/api/stress-test")

    assert response.status_code == 200
    # Endpoint must batch: one Asset query regardless of holding count.
    assert query_count["n"] <= 1, f"expected <=1 asset query, got {query_count['n']}"
