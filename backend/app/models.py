from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True)  # e.g., "QQQ"
    code = Column(String)  # e.g., "379810" or "BIL"
    name = Column(String)
    source = Column(String)  # "KR" or "US"

    prices = relationship("DailyPrice", back_populates="asset")
    transactions = relationship("Transaction", back_populates="asset")

class DailyPrice(Base):
    __tablename__ = "daily_prices"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"))
    date = Column(Date, index=True)
    close = Column(Float)

    asset = relationship("Asset", back_populates="prices")

class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, index=True)
    total_value = Column(Float)
    cash_balance = Column(Float)
    invested_amount = Column(Float)
    daily_return = Column(Float, nullable=True)

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, default=datetime.utcnow)
    asset_id = Column(Integer, ForeignKey("assets.id"))
    type = Column(String)  # "BUY", "SELL", "DEPOSIT", "WITHDRAW"
    quantity = Column(Float)  # Shares
    price = Column(Float)     # Unit Price
    total_amount = Column(Float) # quantity * price

    asset = relationship("Asset", back_populates="transactions")
