from __future__ import annotations

from datetime import date, datetime, time, timedelta

import pandas as pd

from app.models import AccountType, Asset, RawDailyPrice, Transaction
from app.services.exchange_service import ExchangeService


def _seed_raw_price(db_session, when: date, ticker: str, close_price: float) -> None:
    db_session.add(RawDailyPrice(date=when, ticker=ticker, close_price=close_price))


def _seed_asset(db_session, symbol: str = "KRFUND", code: str = "000001") -> Asset:
    asset = Asset(
        symbol=symbol,
        code=code,
        name="KR Fund",
        source="KR",
        account_type=AccountType.ISA,
    )
    db_session.add(asset)
    db_session.flush()
    return asset


def _seed_transaction(
    db_session,
    *,
    tx_type: str,
    when: date,
    total_amount: float,
    asset: Asset | None = None,
    quantity: float | None = None,
    price: float | None = None,
    account_type: AccountType = AccountType.OVERSEAS,
) -> None:
    db_session.add(
        Transaction(
            date=datetime.combine(when, time.min),
            asset=asset,
            asset_id=asset.id if asset else None,
            type=tx_type,
            quantity=quantity,
            price=price,
            total_amount=total_amount,
            account_type=account_type,
        )
    )


def test_create_transaction_accepts_cashflow_union_contract(client):
    response = client.post(
        "/api/transactions",
        json={
            "type": "DEPOSIT",
            "total_amount": 500000,
            "date": "2026-04-01",
            "account_type": "OVERSEAS",
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["type"] == "DEPOSIT"
    assert payload["total_amount"] == 500000
    assert payload.get("quantity") is None
    assert payload.get("price") is None


def test_portfolio_history_returns_split_archive_and_performance_payload(client, db_session, monkeypatch):
    today = date.today()
    start = today - timedelta(days=2)
    asset = _seed_asset(db_session)
    _seed_transaction(
        db_session,
        tx_type="DEPOSIT",
        when=start,
        total_amount=100000,
        account_type=AccountType.ISA,
    )
    _seed_transaction(
        db_session,
        tx_type="BUY",
        when=start + timedelta(days=1),
        total_amount=100000,
        asset=asset,
        quantity=1,
        price=100000,
        account_type=AccountType.ISA,
    )
    for day in range(3):
        current_day = start + timedelta(days=day)
        _seed_raw_price(db_session, current_day, asset.code, 100000)
        _seed_raw_price(db_session, current_day, "SPY", 500)
    db_session.commit()

    monkeypatch.setattr(
        ExchangeService,
        "get_usd_krw_history",
        staticmethod(lambda _start, _end: pd.Series(dtype=float)),
    )

    response = client.get("/api/portfolio/history?period=all")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["period"] == "all"
    assert list(payload["archive"].keys()) == ["series"]
    assert isinstance(payload["archive"]["series"], list)
    assert payload["archive"]["series"]
    assert set(payload["performance"].keys()) == {"coverage_start", "status", "series"}
    assert payload["performance"]["status"] in {"ready", "partial", "unavailable"}



def test_deposit_only_day_increases_archive_without_improving_performance(client, db_session, monkeypatch):
    today = date.today()
    start = today - timedelta(days=2)
    asset = _seed_asset(db_session, symbol="KRDEP", code="000777")
    _seed_transaction(
        db_session,
        tx_type="DEPOSIT",
        when=start,
        total_amount=100000,
        account_type=AccountType.ISA,
    )
    _seed_transaction(
        db_session,
        tx_type="BUY",
        when=start + timedelta(days=1),
        total_amount=100000,
        asset=asset,
        quantity=1,
        price=100000,
        account_type=AccountType.ISA,
    )
    _seed_transaction(
        db_session,
        tx_type="DEPOSIT",
        when=today,
        total_amount=50000,
        account_type=AccountType.ISA,
    )
    for current_day in [start, start + timedelta(days=1), today]:
        _seed_raw_price(db_session, current_day, asset.code, 100000)
        _seed_raw_price(db_session, current_day, "SPY", 500)
    db_session.commit()

    monkeypatch.setattr(
        ExchangeService,
        "get_usd_krw_history",
        staticmethod(lambda _start, _end: pd.Series(dtype=float)),
    )

    response = client.get("/api/portfolio/history?period=all")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["performance"]["status"] == "ready"

    archive_series = payload["archive"]["series"]
    performance_series = payload["performance"]["series"]

    assert archive_series[-1]["absolute_wealth"] - archive_series[-2]["absolute_wealth"] == 50000
    assert performance_series[-1]["performance_value"] == performance_series[-2]["performance_value"]
    assert performance_series[-1]["daily_return"] == 0
    assert performance_series[-1]["alpha"] == 0



def test_missing_cashflow_coverage_blocks_performance_series(client, db_session, monkeypatch):
    today = date.today()
    start = today - timedelta(days=1)
    asset = _seed_asset(db_session, symbol="KRMISS", code="000778")
    _seed_transaction(
        db_session,
        tx_type="BUY",
        when=start,
        total_amount=100000,
        asset=asset,
        quantity=1,
        price=100000,
        account_type=AccountType.ISA,
    )
    for current_day, price in [(start, 100000), (today, 101000)]:
        _seed_raw_price(db_session, current_day, asset.code, price)
        _seed_raw_price(db_session, current_day, "SPY", 500)
    db_session.commit()

    monkeypatch.setattr(
        ExchangeService,
        "get_usd_krw_history",
        staticmethod(lambda _start, _end: pd.Series(dtype=float)),
    )

    response = client.get("/api/portfolio/history?period=all")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["performance"]["status"] == "unavailable"
    assert payload["performance"]["coverage_start"] is None
    assert payload["performance"]["series"] == []
    assert len(payload["archive"]["series"]) >= 1
