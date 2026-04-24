from __future__ import annotations

from datetime import date, datetime, time, timedelta

import pandas as pd
import pytest

from app.models import (
    AccountType,
    Asset,
    PortfolioPerformanceSnapshot,
    RawDailyPrice,
    Transaction,
)
from app.services.exchange_service import ExchangeService
from app.services.portfolio_service import PortfolioService


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


def _stub_fx(monkeypatch) -> None:
    monkeypatch.setattr(
        ExchangeService,
        "get_usd_krw_history",
        staticmethod(lambda _start, _end: pd.Series(dtype=float)),
    )


def _seed_prices(
    db_session,
    asset: Asset,
    price_by_date: dict[date, float],
    spy_by_date: dict[date, float] | None = None,
) -> None:
    spy_by_date = spy_by_date or {current_day: 500 for current_day in price_by_date}
    for current_day, price in price_by_date.items():
        _seed_raw_price(db_session, current_day, asset.code, price)
    for current_day, spy_price in spy_by_date.items():
        _seed_raw_price(db_session, current_day, "SPY", spy_price)


def _persist_performance_from_live_history(db_session) -> None:
    history = PortfolioService.get_equity_curve(db_session, period="all")
    coverage_start = None
    for day in history:
        if day.get("performance_coverage_status") != "ready" or day.get("performance_value") is None:
            continue
        row_date = date.fromisoformat(day["date"])
        coverage_start = coverage_start or row_date
        db_session.add(
            PortfolioPerformanceSnapshot(
                date=row_date,
                performance_value=float(day["performance_value"]),
                benchmark_value=float(day.get("benchmark_value") or 0),
                daily_return=float(day.get("performance_daily_return") or 0),
                alpha=float(day.get("performance_alpha") or 0),
                coverage_start_date=coverage_start,
                coverage_status="ready",
                source_version=PortfolioService.VALUATION_VERSION,
            )
        )
    db_session.commit()


def test_portfolio_performance_snapshot_model_exists():
    assert PortfolioPerformanceSnapshot.__tablename__ == "portfolio_performance_snapshots"
    columns = set(PortfolioPerformanceSnapshot.__table__.columns.keys())
    assert {
        "date",
        "performance_value",
        "benchmark_value",
        "daily_return",
        "alpha",
        "coverage_start_date",
        "coverage_status",
        "source_version",
    }.issubset(columns)


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

    _stub_fx(monkeypatch)

    response = client.get("/api/portfolio/history?period=all")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["period"] == "all"
    assert list(payload["archive"].keys()) == ["series"]
    assert isinstance(payload["archive"]["series"], list)
    assert payload["archive"]["series"]
    assert set(payload["performance"].keys()) == {"coverage_start", "status", "series"}
    assert payload["performance"]["status"] in {"ready", "partial", "unavailable"}


def test_history_performance_does_not_use_live_fallback_when_disabled(client, db_session, monkeypatch):
    today = date.today()
    start = today - timedelta(days=1)
    asset = _seed_asset(db_session, symbol="KRFALL", code="000779")
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
        when=start,
        total_amount=100000,
        asset=asset,
        quantity=1,
        price=100000,
        account_type=AccountType.ISA,
    )
    for current_day in [start, today]:
        _seed_raw_price(db_session, current_day, asset.code, 100000)
        _seed_raw_price(db_session, current_day, "SPY", 500)
    db_session.commit()

    _stub_fx(monkeypatch)

    response = client.get("/api/portfolio/history?period=all")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["archive"]["series"]
    assert payload["performance"] == {"coverage_start": None, "status": "unavailable", "series": []}

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
    _seed_prices(db_session, asset, {
        start: 100000,
        start + timedelta(days=1): 100000,
        today: 100000,
    })
    db_session.commit()

    _stub_fx(monkeypatch)
    _persist_performance_from_live_history(db_session)

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


def test_withdrawal_only_day_decreases_archive_without_hurting_performance(client, db_session, monkeypatch):
    today = date.today()
    start = today - timedelta(days=2)
    asset = _seed_asset(db_session, symbol="KRWDR", code="000781")
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
        tx_type="WITHDRAW",
        when=today,
        total_amount=25000,
        account_type=AccountType.ISA,
    )
    _seed_prices(db_session, asset, {
        start: 100000,
        start + timedelta(days=1): 100000,
        today: 100000,
    })
    db_session.commit()

    _stub_fx(monkeypatch)
    _persist_performance_from_live_history(db_session)

    response = client.get("/api/portfolio/history?period=all")

    assert response.status_code == 200, response.text
    payload = response.json()
    archive_series = payload["archive"]["series"]
    performance_series = payload["performance"]["series"]

    assert archive_series[-1]["absolute_wealth"] - archive_series[-2]["absolute_wealth"] == -25000
    assert performance_series[-1]["performance_value"] == performance_series[-2]["performance_value"]
    assert performance_series[-1]["daily_return"] == 0
    assert performance_series[-1]["alpha"] == 0


def test_price_move_after_buy_changes_performance_without_cashflow(client, db_session, monkeypatch):
    today = date.today()
    start = today - timedelta(days=2)
    asset = _seed_asset(db_session, symbol="KRMOV", code="000782")
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
        when=start,
        total_amount=100000,
        asset=asset,
        quantity=1,
        price=100000,
        account_type=AccountType.ISA,
    )
    _seed_prices(db_session, asset, {
        start: 100000,
        start + timedelta(days=1): 100000,
        today: 110000,
    })
    db_session.commit()

    _stub_fx(monkeypatch)
    _persist_performance_from_live_history(db_session)

    response = client.get("/api/portfolio/history?period=all")

    assert response.status_code == 200, response.text
    performance_series = response.json()["performance"]["series"]
    assert performance_series[-1]["performance_value"] == pytest.approx(110000)
    assert performance_series[-1]["daily_return"] == pytest.approx(0.1)
    assert performance_series[-1]["alpha"] == pytest.approx(0.1)


def test_benchmark_alpha_uses_neutralized_performance_not_cashflow(client, db_session, monkeypatch):
    today = date.today()
    start = today - timedelta(days=2)
    asset = _seed_asset(db_session, symbol="KRBEN", code="000783")
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
        when=start,
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
    _seed_prices(
        db_session,
        asset,
        {start: 100000, start + timedelta(days=1): 100000, today: 100000},
        {start: 500, start + timedelta(days=1): 500, today: 550},
    )
    db_session.commit()

    _stub_fx(monkeypatch)
    _persist_performance_from_live_history(db_session)

    response = client.get("/api/portfolio/history?period=all")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["archive"]["series"][-1]["absolute_wealth"] == 150000
    assert payload["performance"]["series"][-1]["performance_value"] == 100000
    assert payload["performance"]["series"][-1]["benchmark_value"] == 110000
    assert payload["performance"]["series"][-1]["alpha"] == pytest.approx(-0.1)


def test_summary_metrics_do_not_use_absolute_total_value_for_performance(client, db_session, monkeypatch):
    today = date.today()
    start = today - timedelta(days=2)
    asset = _seed_asset(db_session, symbol="KRSUM", code="000780")
    _seed_transaction(db_session, tx_type="DEPOSIT", when=start, total_amount=100000, account_type=AccountType.ISA)
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
    _seed_transaction(db_session, tx_type="DEPOSIT", when=today, total_amount=50000, account_type=AccountType.ISA)
    for current_day in [start, start + timedelta(days=1), today]:
        _seed_raw_price(db_session, current_day, asset.code, 100000)
        _seed_raw_price(db_session, current_day, "SPY", 500)
    db_session.commit()

    monkeypatch.setattr(
        ExchangeService,
        "get_usd_krw_history",
        staticmethod(lambda _start, _end: pd.Series(dtype=float)),
    )

    response = client.get("/api/portfolio/summary")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["performance_metrics_status"] == "unavailable"
    assert payload["metrics"]["total_return"] == 0



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
