"""
Configuration management for the trading bot.
Loads settings from environment variables with validation.
"""
import os
from typing import List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Config:
    """Central configuration class for the trading bot."""
    
    # Bot Settings
    BOT_NAME = os.getenv("BOT_NAME", "CryptoTradingBot")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    
    # Execution interval (in minutes) - how often the bot analyzes markets and executes trades
    EXECUTION_INTERVAL_MINUTES = int(os.getenv("EXECUTION_INTERVAL_MINUTES", "2"))
    
    # Binance Testnet (Fake orders)
    BINANCE_TESTNET_API_KEY = os.getenv("BINANCE_TESTNET_API_KEY", "")
    BINANCE_TESTNET_SECRET = os.getenv("BINANCE_TESTNET_SECRET", "")
    
    # Trading Configuration
    TRADING_PAIRS: List[str] = os.getenv(
        "TRADING_PAIRS", 
        "BTC/USDT,ETH/USDT,BNB/USDT,SOL/USDT,ADA/USDT,DOGE/USDT,XRP/USDT"
    ).split(",")
    
    TIMEFRAMES: List[str] = os.getenv(
        "TIMEFRAMES",
        "1m,15m,30m,1h,4h,1d"
    ).split(",")
    
    CANDLES_LIMIT = int(os.getenv("CANDLES_LIMIT", "200"))

    
    @classmethod
    def validate(cls) -> bool:
        """Validate that all required configuration is present."""
        required_vars = [
            ("BINANCE_TESTNET_API_KEY", cls.BINANCE_TESTNET_API_KEY),
            ("BINANCE_TESTNET_SECRET", cls.BINANCE_TESTNET_SECRET),
        ]
        
        missing = []
        for var_name, var_value in required_vars:
            if not var_value:
                missing.append(var_name)
        
        if missing:
            print(f"❌ Missing required environment variables: {', '.join(missing)}")
            return False
        
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
        print(f"Mainnet: Binance public data access (no API key required)")
        print(f"Mode: 🔴 BINANCE TESTNET (Fake orders on testnet.binance.vision)")
        print(f"Testnet API Key: {'*' * 20}{cls.BINANCE_TESTNET_API_KEY[-4:] if cls.BINANCE_TESTNET_API_KEY else 'NOT SET'}")
        
        # Try to fetch and display testnet balance
        try:
            import ccxt
            testnet_exchange = ccxt.binance({
                'apiKey': cls.BINANCE_TESTNET_API_KEY,
                'secret': cls.BINANCE_TESTNET_SECRET,
                'enableRateLimit': True,
            })
            testnet_exchange.set_sandbox_mode(True)
            testnet_exchange.options['adjustForTimeDifference'] = True
            testnet_exchange.options['recvWindow'] = 60000
            testnet_exchange.load_time_difference()
            balance = testnet_exchange.fetch_balance()
            usdt = balance.get('USDT', {})
            print(f"💰 Testnet Balance: ${usdt.get('free', 0):,.2f} USDT (Free) | ${usdt.get('total', 0):,.2f} USDT (Total)")
        except Exception as e:
            print(f"⚠️  Could not fetch testnet balance: {str(e)}")
        
        print("="*60 + "\n")
