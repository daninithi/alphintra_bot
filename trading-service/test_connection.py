"""Test Binance Testnet connection."""
import ccxt
from dotenv import load_dotenv
import os

load_dotenv()

api_key = os.getenv('BINANCE_TESTNET_API_KEY')
secret = os.getenv('BINANCE_TESTNET_SECRET')

print(f"API Key: {api_key[:20]}...{api_key[-4:]}")
print(f"Secret: {secret[:20]}...{secret[-4:]}")

# Try to connect to testnet
exchange = ccxt.binance({
    'apiKey': api_key,
    'secret': secret,
    'enableRateLimit': True,
})

# Override URLs for testnet
exchange.urls['api']['public'] = 'https://testnet.binance.vision/api'
exchange.urls['api']['private'] = 'https://testnet.binance.vision/api'

print(f"\nPublic URL: {exchange.urls['api']['public']}")
print(f"Private URL: {exchange.urls['api']['private']}")

try:
    print("\nTesting connection...")
    balance = exchange.fetch_balance()
    print(f"✅ Connected successfully!")
    print(f"USDT Balance: {balance.get('USDT', {}).get('free', 0)}")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    
    # Try with different approach
    print("\n\nTrying alternative configuration...")
    exchange2 = ccxt.binance({
        'apiKey': api_key,
        'secret': secret,
        'enableRateLimit': True,
        'options': {
            'defaultType': 'spot',
        }
    })
    
    # Set hostname
    exchange2.hostname = 'testnet.binance.vision'
    
    try:
        balance2 = exchange2.fetch_balance()
        print(f"✅ Connected with alternative method!")
        print(f"USDT Balance: {balance2.get('USDT', {}).get('free', 0)}")
    except Exception as e2:
        print(f"❌ Alternative method also failed: {e2}")
