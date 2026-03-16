"""Test Binance connection using credentials stored in the wallet DB."""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

# Add trading-service to path so exchange_manager imports work
sys.path.insert(0, str(Path(__file__).parent))

from exchange_manager import ExchangeManager

def test_connection(user_id: int):
    print(f"\nTesting Binance connection for user_id={user_id}...")
    manager = ExchangeManager(user_id=user_id)
    success = manager.initialize()
    if success:
        print("✅ Connection successful!")
        balance = manager.get_testnet_balance()
        print(f"💰 USDT Balance: ${balance:,.2f}")
    else:
        print("❌ Connection failed. Make sure the user has connected their Binance account via the frontend.")
    manager.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_connection.py <user_id>")
        sys.exit(1)
    test_connection(int(sys.argv[1]))

