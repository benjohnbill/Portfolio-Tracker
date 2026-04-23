from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, DateTime, Enum, JSON, Text, UniqueConstraint
from .types import JsonVariant
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from .database import Base

class SystemCache(Base):
    __tablename__ = "system_cache"
    
    key = Column(String, primary_key=True, index=True)
    payload = Column(JSON, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class AccountType(enum.Enum):
    ISA = "ISA"
    OVERSEAS = "OVERSEAS"
    PENSION = "PENSION"


class AccountSilo(enum.Enum):
    ISA_ETF = "ISA_ETF"
    OVERSEAS_ETF = "OVERSEAS_ETF"
    BRAZIL_BOND = "BRAZIL_BOND"

class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True)  # e.g., "QQQ"
    code = Column(String)  # e.g., "379810" or "BIL"
    name = Column(String)
    source = Column(String)  # "KR" or "US"
    account_type = Column(Enum(AccountType), default=AccountType.OVERSEAS)
    account_silo = Column(Enum(AccountSilo), nullable=True)

    prices = relationship("DailyPrice", back_populates="asset")
    transactions = relationship("Transaction", back_populates="asset")

class DailyPrice(Base):
    __tablename__ = "daily_prices"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"))
    date = Column(Date, index=True)
    close = Column(Float)

    asset = relationship("Asset", back_populates="prices")

class RawDailyPrice(Base):
    __tablename__ = "raw_daily_prices"
    date = Column(Date, primary_key=True)
    ticker = Column(String, primary_key=True)
    close_price = Column(Float)

class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"

    date = Column(Date, primary_key=True)
    total_value = Column(Float)
    invested_capital = Column(Float)
    cash_balance = Column(Float)


class PortfolioPerformanceSnapshot(Base):
    __tablename__ = "portfolio_performance_snapshots"

    date = Column(Date, primary_key=True)
    performance_value = Column(Float, nullable=False)
    benchmark_value = Column(Float, nullable=True)
    daily_return = Column(Float, nullable=True)
    alpha = Column(Float, nullable=True)
    coverage_start_date = Column(Date, nullable=False)
    coverage_status = Column(String, nullable=False, default="ready")
    source_version = Column(String, nullable=False, default="portfolio-performance-v1")
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    asset_id = Column(Integer, ForeignKey("assets.id"))
    type = Column(String)  # "BUY", "SELL", "DEPOSIT", "WITHDRAW"
    quantity = Column(Float)  # Shares
    price = Column(Float)     # Unit Price
    total_amount = Column(Float) # quantity * price
    account_type = Column(Enum(AccountType), default=AccountType.OVERSEAS)

    asset = relationship("Asset", back_populates="transactions")

class VXNHistory(Base):
    __tablename__ = "vxn_history"

    date = Column(Date, primary_key=True, index=True)
    close = Column(Float)

class MSTRCorporateAction(Base):
    __tablename__ = "mstr_corporate_actions"

    date = Column(Date, primary_key=True, index=True)
    btc_holdings = Column(Float)
    outstanding_shares = Column(Float)


class WeeklyReport(Base):
    __tablename__ = "weekly_reports"

    id = Column(Integer, primary_key=True, index=True)
    week_ending = Column(Date, index=True, unique=True, nullable=False)
    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    logic_version = Column(String, nullable=False, default="weekly-report-v0")
    status = Column(String, nullable=False, default="final")
    report_json = Column(JSON, nullable=False)
    llm_summary_json = Column(JSON, nullable=True)


class WeeklySnapshot(Base):
    __tablename__ = "weekly_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_date = Column(Date, index=True, unique=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    frozen_report = Column(JsonVariant, nullable=False)
    snapshot_metadata = Column("metadata", JsonVariant, nullable=False)
    # Phase D A7 — optional per-freeze observation (1-2 lines), surfaced on /archive.
    comment = Column(Text, nullable=True)
    # B4 — per-freeze precomputed risk metric snapshot (portfolio + SPY-KRW trailing-1Y).
    # Shape: see docs/superpowers/decisions/2026-04-20-phase-d-B4-B5-scope-lock.md
    risk_metrics = Column(JsonVariant, nullable=True)

    decisions = relationship("WeeklyDecision", back_populates="snapshot", cascade="all, delete-orphan")
    attributions = relationship("ScoringAttribution", back_populates="snapshot", cascade="all, delete-orphan")


class WeeklyDecision(Base):
    __tablename__ = "weekly_decisions"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(Integer, ForeignKey("weekly_snapshots.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    decision_type = Column(String, nullable=False)
    asset_ticker = Column(String, nullable=True)
    note = Column(Text, nullable=False)

    # Phase D A3 — 3-scalar confidence (1..10).
    # #1 primary risk-adjusted, #2 baseline vs cash, #3 stretch vs SPY-KRW pure return.
    # Historical rows hold only #1; #2 and #3 are NULL until recorded on new freezes.
    confidence_vs_spy_riskadj = Column(Integer, nullable=False)
    confidence_vs_cash = Column(Integer, nullable=True)
    confidence_vs_spy_pure = Column(Integer, nullable=True)

    # Phase D A4 — structured invalidation (enum coerced in app layer).
    invalidation = Column(Text, nullable=True)
    expected_failure_mode = Column(String, nullable=True)
    trigger_threshold = Column(Float, nullable=True)

    snapshot = relationship("WeeklySnapshot", back_populates="decisions")
    outcomes = relationship("DecisionOutcome", back_populates="decision", cascade="all, delete-orphan")
    slippage_entries = relationship("ExecutionSlippage", back_populates="decision", cascade="all, delete-orphan", order_by="ExecutionSlippage.created_at")


class ScoringAttribution(Base):
    __tablename__ = "scoring_attributions"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(Integer, ForeignKey("weekly_snapshots.id", ondelete="CASCADE"), nullable=False, index=True, unique=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Fit score decomposition (40 pts total, 5 buckets x 8 pts max)
    fit_score = Column(Float, nullable=False)
    fit_bucket_liquidity = Column(Float, nullable=True)
    fit_bucket_rates = Column(Float, nullable=True)
    fit_bucket_inflation = Column(Float, nullable=True)
    fit_bucket_growth = Column(Float, nullable=True)
    fit_bucket_stress = Column(Float, nullable=True)

    # Alignment score decomposition (35 pts total, 6 categories)
    alignment_score = Column(Float, nullable=False)
    alignment_ndx = Column(Float, nullable=True)
    alignment_dbmf = Column(Float, nullable=True)
    alignment_brazil = Column(Float, nullable=True)
    alignment_mstr = Column(Float, nullable=True)
    alignment_gldm = Column(Float, nullable=True)
    alignment_bonds_cash = Column(Float, nullable=True)

    # Posture/Diversification score (25 pts total)
    posture_score = Column(Float, nullable=False)
    posture_stress_resilience = Column(Float, nullable=True)
    posture_concentration = Column(Float, nullable=True)
    posture_diversifier_reserve = Column(Float, nullable=True)

    # Composite
    total_score = Column(Integer, nullable=False)

    # Regime snapshot at freeze time
    regime_snapshot = Column(JsonVariant, nullable=True)

    # Raw indicator values copied from frozen_report
    indicator_values = Column(JsonVariant, nullable=True)

    # Rules that fired this week with was_followed status
    rules_fired = Column(JsonVariant, nullable=True)

    snapshot = relationship("WeeklySnapshot", back_populates="attributions")


class DecisionOutcome(Base):
    __tablename__ = "decision_outcomes"
    __table_args__ = (
        UniqueConstraint("decision_id", "horizon", name="uq_decision_horizon"),
    )

    id = Column(Integer, primary_key=True, index=True)
    decision_id = Column(Integer, ForeignKey("weekly_decisions.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_id = Column(Integer, ForeignKey("weekly_snapshots.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    evaluated_at = Column(DateTime, nullable=True)

    horizon = Column(String, nullable=False)  # "1w", "1m", "3m", "6m", "1y"

    portfolio_value_at_decision = Column(Float, nullable=True)
    portfolio_value_at_horizon = Column(Float, nullable=True)
    score_at_decision = Column(Integer, nullable=True)
    score_at_horizon = Column(Integer, nullable=True)
    regime_at_decision = Column(String, nullable=True)
    regime_at_horizon = Column(String, nullable=True)

    outcome_delta_pct = Column(Float, nullable=True)
    score_delta = Column(Integer, nullable=True)
    regime_changed = Column(String, nullable=True)  # "true"/"false" as string for JSONB compat
    # B2 — SPY-KRW benchmark deltas populated by OutcomeEvaluatorService on matured outcomes.
    outcome_delta_vs_spy_pure = Column(Float, nullable=True)
    outcome_delta_calmar_vs_spy = Column(Float, nullable=True)

    decision = relationship("WeeklyDecision", back_populates="outcomes")
    snapshot = relationship("WeeklySnapshot")


class EventAnnotation(Base):
    __tablename__ = "event_annotations"

    id = Column(Integer, primary_key=True, index=True)
    week_ending = Column(Date, index=True, nullable=False)
    event_date = Column(Date, nullable=True)
    level = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default="active")
    title = Column(String, nullable=False)
    summary = Column(String, nullable=False)
    affected_buckets = Column(JSON, nullable=True)
    affected_sleeves = Column(JSON, nullable=True)
    duration = Column(String, nullable=True)
    decision_impact = Column(String, nullable=True)
    source = Column(String, nullable=False, default="manual")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class CronRunLog(Base):
    """Logs each cron job execution for operational monitoring."""
    __tablename__ = "cron_run_logs"

    id = Column(Integer, primary_key=True, index=True)
    job_name = Column(String, nullable=False, index=True)  # e.g., "update-signals"
    started_at = Column(DateTime, nullable=False)
    finished_at = Column(DateTime, nullable=True)
    status = Column(String, nullable=False, default="running")  # "running", "success", "failed"
    duration_seconds = Column(Float, nullable=True)
    error_message = Column(String, nullable=True)
    details_json = Column(JSON, nullable=True)  # Additional context: records processed, etc.


class ExecutionSlippage(Base):
    __tablename__ = "execution_slippage"

    id = Column(Integer, primary_key=True, index=True)
    decision_id = Column(Integer, ForeignKey("weekly_decisions.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    executed_at = Column(Date, nullable=True)
    executed_price = Column(Float, nullable=True)
    executed_qty = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)

    decision = relationship("WeeklyDecision", back_populates="slippage_entries")
