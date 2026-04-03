from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, DateTime, Enum, JSON, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from .database import Base

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
    frozen_report = Column(JSONB, nullable=False)
    snapshot_metadata = Column("metadata", JSONB, nullable=False)

    decisions = relationship("WeeklyDecision", back_populates="snapshot", cascade="all, delete-orphan")


class WeeklyDecision(Base):
    __tablename__ = "weekly_decisions"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(Integer, ForeignKey("weekly_snapshots.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    decision_type = Column(String, nullable=False)
    asset_ticker = Column(String, nullable=True)
    note = Column(Text, nullable=False)
    confidence = Column(Integer, nullable=False)
    invalidation = Column(Text, nullable=True)

    snapshot = relationship("WeeklySnapshot", back_populates="decisions")


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
