from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

Base = declarative_base()

class WalletConnection(Base):
    """Store encrypted exchange API credentials"""
    __tablename__ = "wallet_connections"
    
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)  # Reference to user in auth-service
    
    # Exchange information
    exchange_name = Column(String(50), nullable=False)  # 'binance', 'coinbase', etc.
    exchange_environment = Column(String(20), default='testnet')  # 'testnet', 'mainnet'
    
    # Encrypted credentials (using Fernet encryption)
    encrypted_api_key = Column(Text, nullable=False)
    encrypted_secret_key = Column(Text, nullable=False)
    
    # Connection metadata
    connection_name = Column(String(255))  # User-friendly name
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime)
    
    # Status tracking
    connection_status = Column(String(20), default='connected')  # 'connected', 'error', 'disabled'
    last_error = Column(Text)
    
    # Security
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())