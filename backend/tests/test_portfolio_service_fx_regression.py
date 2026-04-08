from datetime import date, datetime, timedelta

import pandas as pd

from app.services.exchange_service import ExchangeService
from app.services.portfolio_service import PortfolioService


class _Obj:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def order_by(self, *args, **kwargs):
        return self

    def filter(self, *args, **kwargs):
        return self

    def all(self):
        return self._rows

    def first(self):
        return self._rows[0] if self._rows else None


class _FakeDB:
    def __init__(self, transactions, assets, raw_prices):
        self._transactions = transactions
        self._assets = assets
        self._raw_prices = raw_prices

    def commit(self): pass
    def execute(self, stmt): pass

    def query(self, model):
        model_name = getattr(model, "__name__", str(model))
        if model_name == "SystemCache":
            return _FakeQuery([])
        if model_name == "Transaction":
            return _FakeQuery(self._transactions)
        if model_name == "Asset":
            return _FakeQuery(self._assets)
        if model_name == "RawDailyPrice":
            return _FakeQuery(self._raw_prices)
        return _FakeQuery([])

    def commit(self):
        return None


def _make_asset(asset_id, symbol, source="US", code=None, name=None):
    return _Obj(
        id=asset_id,
        symbol=symbol,
        code=code,
        name=name or f"{symbol} Asset",
        source=source,
        account_type=None,
        account_silo=None,
    )


def _make_transaction(tx_id, asset, tx_date, quantity, price):
    return _Obj(
        id=tx_id,
        date=datetime.combine(tx_date, datetime.min.time()),
        asset_id=asset.id,
        type="BUY",
        quantity=float(quantity),
        price=float(price),
        total_amount=float(quantity * price),
        asset=asset,
    )


def _make_raw_price(price_date, ticker, close_price):
    return _Obj(date=price_date, ticker=ticker, close_price=float(close_price))


def _build_fake_db() -> _FakeDB:
    today = date.today()
    start = today - timedelta(days=1)

    asset = _Obj(
        id=1,
        symbol="TEST",
        code=None,
        name="Test Asset",
        source="US",
        account_type=None,
        account_silo=None,
    )
    tx = _Obj(
        id=1,
        date=datetime.combine(start, datetime.min.time()),
        asset_id=1,
        type="BUY",
        quantity=10.0,
        price=100.0,
        total_amount=1000.0,
        asset=asset,
    )

    raw_prices = [
        _Obj(date=start, ticker="TEST", close_price=100.0),
        _Obj(date=today, ticker="TEST", close_price=101.0),
        _Obj(date=start, ticker="SPY", close_price=500.0),
        _Obj(date=today, ticker="SPY", close_price=502.0),
    ]

    return _FakeDB(transactions=[tx], assets=[asset], raw_prices=raw_prices)


def test_equity_curve_fx_fallback_when_fx_series_empty(monkeypatch):
    db = _build_fake_db()
    monkeypatch.setattr(
        ExchangeService,
        "get_usd_krw_history",
        staticmethod(lambda start, end: pd.Series(dtype=float)),
    )

    history = PortfolioService.get_equity_curve(db, period="1m")

    assert history
    assert all(point["fx_rate"] == 1400.0 for point in history)


def test_equity_curve_fx_fallback_when_fx_series_has_range_index(monkeypatch):
    db = _build_fake_db()
    monkeypatch.setattr(
        ExchangeService,
        "get_usd_krw_history",
        staticmethod(lambda start, end: pd.Series([1300.0, 1310.0])),
    )

    history = PortfolioService.get_equity_curve(db, period="1m")

    assert history
    assert all(point["fx_rate"] == 1400.0 for point in history)


def test_equity_curve_fx_happy_path_with_datetime_index(monkeypatch):
    today = date.today()
    start = today - timedelta(days=1)
    asset = _make_asset(1, "TEST")
    db = _FakeDB(
        transactions=[_make_transaction(1, asset, start, 10, 100)],
        assets=[asset],
        raw_prices=[
            _make_raw_price(start, "TEST", 100.0),
            _make_raw_price(today, "TEST", 101.0),
            _make_raw_price(start, "SPY", 500.0),
            _make_raw_price(today, "SPY", 502.0),
        ],
    )
    fx_history = pd.Series(
        [1300.0, 1350.0],
        index=pd.to_datetime([start, today]),
    )
    monkeypatch.setattr(
        ExchangeService,
        "get_usd_krw_history",
        staticmethod(lambda start, end: fx_history),
    )

    history = PortfolioService.get_equity_curve(db, period="1m")

    assert history
    assert [point["fx_rate"] for point in history] == [1300.0, 1350.0]


def test_equity_curve_fx_conversion_us_vs_kr_assets(monkeypatch):
    today = date.today()
    start = today - timedelta(days=1)
    us_asset = _make_asset(1, "US_ETF", source="US")
    kr_asset = _make_asset(2, "KR_ETF", source="KR", code="000001")
    db = _FakeDB(
        transactions=[
            _make_transaction(1, us_asset, start, 10, 100),
            _make_transaction(2, kr_asset, start, 5, 200),
        ],
        assets=[us_asset, kr_asset],
        raw_prices=[
            _make_raw_price(start, "US_ETF", 100.0),
            _make_raw_price(today, "US_ETF", 100.0),
            _make_raw_price(start, "000001", 200.0),
            _make_raw_price(today, "000001", 200.0),
            _make_raw_price(start, "SPY", 500.0),
            _make_raw_price(today, "SPY", 502.0),
        ],
    )
    monkeypatch.setattr(
        ExchangeService,
        "get_usd_krw_history",
        staticmethod(lambda start, end: pd.Series([1350.0, 1350.0], index=pd.to_datetime([start, today]))),
    )

    history = PortfolioService.get_equity_curve(db, period="1m")

    assert history
    assert history[-1]["fx_rate"] == 1350.0
    assert history[-1]["total_value"] == int((10 * 100 * 1350.0) + (5 * 200))


def test_equity_curve_fx_multi_day_changing_rates(monkeypatch):
    today = date.today()
    start = today - timedelta(days=2)
    asset = _make_asset(1, "TEST")
    db = _FakeDB(
        transactions=[_make_transaction(1, asset, start, 10, 100)],
        assets=[asset],
        raw_prices=[
            _make_raw_price(start, "TEST", 100.0),
            _make_raw_price(start + timedelta(days=1), "TEST", 101.0),
            _make_raw_price(today, "TEST", 102.0),
            _make_raw_price(start, "SPY", 500.0),
            _make_raw_price(start + timedelta(days=1), "SPY", 501.0),
            _make_raw_price(today, "SPY", 502.0),
        ],
    )
    fx_history = pd.Series(
        [1300.0, 1350.0, 1400.0],
        index=pd.to_datetime([start, start + timedelta(days=1), today]),
    )
    monkeypatch.setattr(
        ExchangeService,
        "get_usd_krw_history",
        staticmethod(lambda start, end: fx_history),
    )

    history = PortfolioService.get_equity_curve(db, period="1m")

    assert history
    assert [point["fx_rate"] for point in history] == [1300.0, 1350.0, 1400.0]
