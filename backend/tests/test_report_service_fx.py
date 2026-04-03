import pandas as pd
from datetime import datetime, timedelta

from app.services.exchange_service import ExchangeService
from app.services.report_service import AlgoService, MacroService, ReportService
from app.services import report_service as report_module


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

    def query(self, model):
        model_name = getattr(model, "__name__", str(model))
        if model_name == "Transaction":
            return _FakeQuery(self._transactions)
        if model_name == "Asset":
            return _FakeQuery(self._assets)
        if model_name == "RawDailyPrice":
            return _FakeQuery(self._raw_prices)
        return _FakeQuery([])

    def commit(self):
        return None


def _build_fake_db() -> _FakeDB:
    today = pd.Timestamp.today().normalize().date()
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


def test_weekly_report_includes_fx_driven_valuation(monkeypatch):
    db = _build_fake_db()
    today = pd.Timestamp.today().normalize()
    monkeypatch.setattr(
        ExchangeService,
        "get_usd_krw_history",
        staticmethod(lambda start, end: pd.Series([1360.0, 1365.0], index=pd.to_datetime([today - pd.Timedelta(days=1), today]))),
    )
    monkeypatch.setattr(ExchangeService, "get_current_rate", staticmethod(lambda: 1365.0))
    monkeypatch.setattr(ReportService, "_ensure_report_tables", staticmethod(lambda: None))
    monkeypatch.setattr(MacroService, "get_macro_snapshot", staticmethod(lambda: {"knownAsOf": "2026-04-03"}))
    monkeypatch.setattr(AlgoService, "get_action_report", staticmethod(lambda db: {"signals": {"timestamp": "2026-04-03T00:00:00Z"}, "actions": []}))
    monkeypatch.setattr(report_module, "compute_alignment_score", lambda allocation: {"score": 0, "needsRebalance": False, "categories": []})
    monkeypatch.setattr(report_module, "compute_fit_score", lambda macro_snapshot, allocation: {"score": 50, "bucketBreakdown": [], "positives": [], "negatives": []})
    monkeypatch.setattr(report_module, "compute_posture_diversification_score", lambda db, allocation: {"score": 10, "stressResilience": {"scenarios": []}})
    monkeypatch.setattr(report_module, "build_target_deviation", lambda allocation: [])

    report = ReportService.build_weekly_report(db)

    assert report["portfolioSnapshot"]["totalValueKRW"] > 0
    assert report["dataFreshness"]["portfolioValuation"]["source"] == "live_equity_curve"
    assert report["dataFreshness"]["portfolioAsOf"] is not None
