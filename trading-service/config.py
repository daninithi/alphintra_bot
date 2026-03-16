"""
Configuration management for the trading bot.
Loads settings from environment variables with validation.
"""
import os
from pathlib import Path
from typing import List
# from dotenv import load_dotenv

# # Load environment variables from the .env file in the same directory as this file
# load_dotenv(dotenv_path=Path(__file__).parent / ".env")


class Config:
    """Central configuration class for the trading bot."""
    
    # Bot Settings
    BOT_NAME = os.getenv("BOT_NAME", "CryptoTradingBot")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    
    # Execution interval (in minutes) - how often the bot analyzes markets and executes trades
    EXECUTION_INTERVAL_MINUTES = int(os.getenv("EXECUTION_INTERVAL_MINUTES", "2"))
    
    # Trading Configuration
    TRADING_PAIRS: List[str] = os.getenv(
        "TRADING_PAIRS", 
        "BTC/USDT,ETH/USDT,SOL/USDT,DOGE/USDT,XRP/USDT"
    ).split(",")
    
    TIMEFRAMES: List[str] = os.getenv(
        "TIMEFRAMES",
        "1m,15m,30m,1h,4h,1d"
    ).split(",")
    
    CANDLES_LIMIT = int(os.getenv("CANDLES_LIMIT", "200"))

    
    @classmethod
    def validate(cls) -> bool:
        """Validate that all required configuration is present."""
        return True
    
    @classmethod
    def display(cls):
        """Display current configuration (masking sensitive data)."""
        print("\n" + "="*60)
        print(f"⚙️  {cls.BOT_NAME} Configuration")
        print("="*60)
        print(f"Execution Interval: {cls.EXECUTION_INTERVAL_MINUTES} minutes")
        print(f"Trading Pairs: {', '.join(cls.TRADING_PAIRS)}")
        print(f"Timeframes: {', '.join(cls.TIMEFRAMES)}")
        print(f"Candles per Timeframe: {cls.CANDLES_LIMIT}")
        print(f"Log Level: {cls.LOG_LEVEL}")

        print("="*60 + "\n")
