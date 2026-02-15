"""
Database models for trading bot execution tracking.
"""
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime, timezone
import os

# Use TRADING_DATABASE_URL first, fallback to DATABASE_URL, then default to trading DB
DATABASE_URL = os.getenv("TRADING_DATABASE_URL") or os.getenv("DATABASE_URL", "postgresql://alphintra:alphintra123@localhost:5432/alphintra_trading")

# If DATABASE_URL points to wallet DB, override it with trading DB
if "alphintra_wallet" in DATABASE_URL:
    DATABASE_URL = "postgresql://alphintra:alphintra123@localhost:5432/alphintra_trading"
    print(f"DATABASE_URL was pointing to wallet DB, overriding to trading DB")

Base = declarative_base()

class BotExecution(Base):
    """Track bot execution history."""
    __tablename__ = "bot_executions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    strategy_name = Column(String(100), nullable=False)
    coin = Column(String(50))  # e.g., "BTC/USDT" or "all"
    capital = Column(Float, nullable=False, default=10000)  # Allocated capital in USDT (calculated from percentage)
    status = Column(String(20), nullable=False)  # running, stopped, error
    last_run = Column(DateTime)  # Last execution time
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    stopped_at = Column(DateTime)
    error_message = Column(String(500))
    
    # Relationships
    orders = relationship("Order", back_populates="bot_execution", cascade="all, delete-orphan")
    positions = relationship("Position", back_populates="bot_execution", cascade="all, delete-orphan")
    trade_history = relationship("TradeHistory", back_populates="bot_execution", cascade="all, delete-orphan")
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "strategy_name": self.strategy_name,
            "coin": self.coin,
            "capital": float(self.capital),
            "status": self.status,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "stopped_at": self.stopped_at.isoformat() if self.stopped_at else None,
            "error_message": self.error_message
        }

class Order(Base):
    """Track pending and executed orders."""
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    bot_execution_id = Column(Integer, ForeignKey('bot_executions.id'), nullable=False)
    user_id = Column(Integer, nullable=False)
    order_id = Column(String(100), unique=True, nullable=False)  # Exchange order ID
    symbol = Column(String(50), nullable=False)  # e.g., "BTC/USDT"
    side = Column(String(10), nullable=False)  # BUY / SELL
    order_type = Column(String(20), nullable=False)  # MARKET / LIMIT / STOP_LOSS
    price = Column(Float)  # Order price (for limit orders)
    quantity = Column(Float, nullable=False)  # Amount
    filled_quantity = Column(Float, default=0.0)  # Amount filled
    status = Column(String(20), nullable=False)  # PENDING / FILLED / CANCELLED / FAILED
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    filled_at = Column(DateTime)
    
    # Relationship
    bot_execution = relationship("BotExecution", back_populates="orders")
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "order_id": self.order_id,
            "symbol": self.symbol,
            "side": self.side,
            "order_type": self.order_type,
            "price": float(self.price) if self.price else None,
            "quantity": float(self.quantity),
            "filled_quantity": float(self.filled_quantity),
            "status": self.status,
            "time": self.created_at.isoformat() if self.created_at else None,
            "filled_at": self.filled_at.isoformat() if self.filled_at else None
        }

class Position(Base):
    """Track open positions."""
    __tablename__ = "positions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    bot_execution_id = Column(Integer, ForeignKey('bot_executions.id'), nullable=False)
    user_id = Column(Integer, nullable=False)
    symbol = Column(String(50), nullable=False)  # e.g., "BTC/USDT"
    entry_price = Column(Float, nullable=False)  # Buy price
    quantity = Column(Float, nullable=False)  # Amount held
    current_price = Column(Float)  # Live price (updated periodically)
    unrealized_pnl = Column(Float, default=0.0)  # Profit / Loss
    stop_loss = Column(Float)  # Stop loss price level
    take_profit = Column(Float)  # Take profit price level
    opened_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relationship
    bot_execution = relationship("BotExecution", back_populates="positions")
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "symbol": self.symbol,
            "entry_price": float(self.entry_price),
            "current_price": float(self.current_price) if self.current_price else float(self.entry_price),
            "quantity": float(self.quantity),
            "unrealized_pnl": float(self.unrealized_pnl),
            "stop_loss": float(self.stop_loss) if self.stop_loss else None,
            "take_profit": float(self.take_profit) if self.take_profit else None,
            "opened_at": self.opened_at.isoformat() if self.opened_at else None
        }

class TradeHistory(Base):
    """Track completed trades."""
    __tablename__ = "trade_history"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    bot_execution_id = Column(Integer, ForeignKey('bot_executions.id'), nullable=False)
    user_id = Column(Integer, nullable=False)
    symbol = Column(String(50), nullable=False)  # e.g., "BTC/USDT"
    buy_price = Column(Float, nullable=False)  # Entry
    sell_price = Column(Float, nullable=False)  # Exit
    quantity = Column(Float, nullable=False)  # Trade size
    pnl = Column(Float, nullable=False)  # Final profit/loss in USDT
    result = Column(String(10), nullable=False)  # PROFIT / LOSS
    opened_at = Column(DateTime, nullable=False)  # Buy time
    closed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)  # Sell time
    
    # Relationship
    bot_execution = relationship("BotExecution", back_populates="trade_history")
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "symbol": self.symbol,
            "buy_price": float(self.buy_price),
            "sell_price": float(self.sell_price),
            "quantity": float(self.quantity),
            "pnl": float(self.pnl),
            "result": self.result,
            "opened_at": self.opened_at.isoformat() if self.opened_at else None,
            "closed_at": self.closed_at.isoformat() if self.closed_at else None
        }

# Create engine and session
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)

def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        return db
    finally:
        pass  # Don't close here, let caller close it
