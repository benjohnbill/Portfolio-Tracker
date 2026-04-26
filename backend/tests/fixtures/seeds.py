"""Function-based seed helpers for C (sqlite) and D (postgres) tests."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models import (
    AccountSilo,
    AccountType,
    Asset,
    DailyPrice,
    WeeklyDecision,
    WeeklyReport,
    WeeklySnapshot,
)


def seed_asset(
    db: Session,
    *,
    symbol: str = "QQQ",
    code: str | None = None,
    name: str = "Test Asset",
    source: str = "US",
    account_type: AccountType = AccountType.OVERSEAS,
    account_silo: AccountSilo | None = AccountSilo.OVERSEAS_ETF,
) -> Asset:
    asset = Asset(
        symbol=symbol,
        code=code or symbol,
        name=name,
        source=source,
        account_type=account_type,
        account_silo=account_silo,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def seed_daily_price(
    db: Session,
    *,
    asset: Asset,
    price_date: date,
    close: float = 100.0,
) -> DailyPrice:
    row = DailyPrice(asset_id=asset.id, date=price_date, close=close)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def seed_weekly_report(
    db: Session,
    *,
    week_ending: date = date(2026, 4, 17),
    status: str = "final",
    report_json: dict[str, Any] | None = None,
    llm_summary_json: dict[str, Any] | None = None,
) -> WeeklyReport:
    report = WeeklyReport(
        week_ending=week_ending,
        generated_at=datetime.now(timezone.utc),
        logic_version="weekly-report-v0",
        status=status,
        report_json=report_json or {"score": 92, "regime": "neutral"},
        llm_summary_json=llm_summary_json,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def seed_weekly_snapshot(
    db: Session,
    *,
    snapshot_date: date = date(2026, 4, 17),
    comment: str | None = None,
    frozen_report: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> WeeklySnapshot:
    snap = WeeklySnapshot(
        snapshot_date=snapshot_date,
        created_at=datetime.now(timezone.utc),
        frozen_report=frozen_report or {"status": "final"},
        snapshot_metadata=metadata or {},
        comment=comment,
    )
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return snap


def seed_decision(
    db: Session,
    *,
    snapshot: WeeklySnapshot,
    decision_type: str = "hold",
    asset_ticker: str = "KODEX_1X",
    note: str = "seeded test decision",
    confidence_vs_spy_riskadj: int = 5,
    confidence_vs_cash: int | None = 5,
    confidence_vs_spy_pure: int | None = 5,
    invalidation: str | None = None,
    expected_failure_mode: str | None = None,
    trigger_threshold: float | None = None,
) -> WeeklyDecision:
    decision = WeeklyDecision(
        snapshot_id=snapshot.id,
        decision_type=decision_type,
        asset_ticker=asset_ticker,
        note=note,
        confidence_vs_spy_riskadj=confidence_vs_spy_riskadj,
        confidence_vs_cash=confidence_vs_cash,
        confidence_vs_spy_pure=confidence_vs_spy_pure,
        invalidation=invalidation,
        expected_failure_mode=expected_failure_mode,
        trigger_threshold=trigger_threshold,
        created_at=datetime.now(timezone.utc),
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)
    return decision
