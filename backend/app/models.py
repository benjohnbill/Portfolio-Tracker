from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from .database import Base

class AccountType(enum.Enum):
    ISA = "ISA"
    OVERSEAS = "OVERSEAS"
    PENSION = "PENSION"

class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True)  # e.g., "QQQ"
    code = Column(String)  # e.g., "379810" or "BIL"
    name = Column(String)
    source = Column(String)  # "KR" or "US"
    account_type = Column(Enum(AccountType), default=AccountType.OVERSEAS)

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
