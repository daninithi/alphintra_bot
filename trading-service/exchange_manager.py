"""
Exchange Manager for handling Bybit Mainnet (data) and Demo Trading (orders).
Provides separation between real market data and demo order execution.
Supports simulation mode for demo purposes without API keys.
"""
import ccxt
import time
from datetime import datetime
from typing import Optional, Dict, Any, List
from config import Config
from logger import setup_logger
import os
import psycopg2
from cryptography.fernet import Fernet
import base64

# Encryption Configuration - Use JWT_SECRET as base for encryption key
JWT_SECRET = os.getenv("JWT_SECRET", "zEseNVzJiNEFsxOKygzayk4hHjSp2UJMzHMwSjWWfqE=")
ENCRYPTION_KEY = base64.urlsafe_b64encode(base64.b64decode(JWT_SECRET)[:32])
cipher_suite = Fernet(ENCRYPTION_KEY)

def decrypt_credential(encrypted_credential) -> str:
    """Decrypt an encrypted credential or return plain text if not encrypted."""
    # Handle different types from PostgreSQL
    if encrypted_credential is None:
        return None
    
    # Convert memoryview to bytes
    if isinstance(encrypted_credential, memoryview):
        encrypted_credential = bytes(encrypted_credential)
    
    # If it's a string starting with \x, it's PostgreSQL hex format - convert to bytes
    if isinstance(encrypted_credential, str):
        if encrypted_credential.startswith('\\x'):
            # PostgreSQL hex format: \x67414141... -> convert to bytes
            hex_string = encrypted_credential[2:]  # Remove \x prefix
            try:
                encrypted_credential = bytes.fromhex(hex_string)
            except ValueError as e:
                # If conversion fails, might be plain text
                return encrypted_credential
        elif encrypted_credential.startswith('gAAAAA'):
            # Fernet token format - try to decrypt
            try:
                encrypted_credential = encrypted_credential.encode()
                return cipher_suite.decrypt(encrypted_credential).decode()
            except:
                return encrypted_credential
        else:
            # Plain text
            return encrypted_credential
    
    # If it's bytes, try to decrypt
    try:
        return cipher_suite.decrypt(encrypted_credential).decode()
    except Exception as e:
        # If decryption fails, try to decode as plain text
        try:
            return encrypted_credential.decode()
        except:
            return str(encrypted_credential)


class ExchangeManager:
    """
    Manages connections to Binance Mainnet (data) and Bybit Demo Trading (orders).
    - Binance Mainnet: For fetching real market data (read-only)
    - Bybit Demo: For placing orders in Bybit demo environment (realistic testing)
    """
    
    def __init__(self, environment: str = "testnet", user_id: int = None):
        self.logger = setup_logger("ExchangeManager", environment=environment)
        self.mainnet: Optional[ccxt.binance] = None
        self.demo: Optional[ccxt.binance] = None
        self.environment = environment  # Store environment ('production' or 'testnet')
        self.user_id = user_id  # User ID to fetch credentials from wallet database

    def initialize(self) -> bool:
        """
        Initialize both Mainnet and Demo exchange connections.
        
        Returns:
            bool: True if both connections successful, False otherwise
        """
        try:
            # Initialize Binance Mainnet (for public data - no API keys needed)
            self.mainnet = ccxt.binance({
                'enableRateLimit': True,
                'options': {
                    'defaultType': 'spot',
                    'adjustForTimeDifference': True,
                }
            })
            
            # Test Mainnet connection
            self.logger.info("🔄 Testing Binance Mainnet connection (public data)...")
            try:
                mainnet_status = self.mainnet.fetch_status()
                self.logger.info(f"✅ Binance Mainnet connected (public): {mainnet_status['status']}")
            except Exception as e:
                self.logger.warning(f"⚠️  Mainnet test failed, but continuing: {str(e)}")
            
            # Initialize Binance for orders (testnet or production based on environment)
            is_sandbox = self.environment.lower() == "testnet"
            env_display = "TESTNET" if is_sandbox else "PRODUCTION"
            
            self.logger.info(f"🌐 Initializing Binance {env_display} for trading...")
            
            # Fetch credentials from wallet database
            api_key, secret_key = self._get_credentials_from_wallet_db()
            
            if not api_key or not secret_key:
                self.logger.error("Failed to fetch credentials from wallet database")
                return False
            
            self.demo = ccxt.binance({
                'apiKey': api_key,
                'secret': secret_key,
                'enableRateLimit': True,
            })
            
            # Set sandbox mode based on environment
            self.demo.set_sandbox_mode(is_sandbox)
            
            # Sync time to prevent timestamp errors
            self.demo.options['adjustForTimeDifference'] = True
            self.demo.options['recvWindow'] = 60000  # Large window for timestamp tolerance
            self.demo.load_time_difference()
            
            self.logger.debug(f"🔍 Trading URLs: {self.demo.urls['api']}")
            self.logger.info(f"🔄 Testing Binance {env_display} connection...")
            
            demo_balance = self.demo.fetch_balance()
            usdt_balance = demo_balance.get('USDT', {})
            
            self.logger.info(f"✅ Binance {env_display} connected successfully!")
            self.logger.info(f"💰 USDT Balance:")
            self.logger.info(f"   Free: ${usdt_balance.get('free', 0):,.2f}")
            self.logger.info(f"   Used: ${usdt_balance.get('used', 0):,.2f}")
            self.logger.info(f"   Total: ${usdt_balance.get('total', 0):,.2f}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Failed to initialize exchanges: {str(e)}")
            return False
    
    def _get_credentials_from_wallet_db(self) -> tuple:
        """Fetch and decrypt API credentials from wallet database."""
        try:
            if not self.user_id:
                self.logger.warning("No user_id provided, using config credentials")
                return Config.BINANCE_TESTNET_API_KEY, Config.BINANCE_TESTNET_SECRET
            
            self.logger.info(f"Fetching credentials from wallet database for user {self.user_id}...")
            
            # Connect to wallet database
            wallet_db_url = os.getenv("WALLET_DATABASE_URL", "postgresql://myapp:alphintra123@localhost:5432/alphintra_wallet")
            conn = psycopg2.connect(wallet_db_url)
            cur = conn.cursor()
            
            cur.execute("""
                SELECT encrypted_api_key, encrypted_secret_key, exchange_environment
                FROM wallet_connections
                WHERE user_id = %s 
                  AND exchange_name = 'binance'
                  AND is_active = true
                ORDER BY created_at DESC
                LIMIT 1
            """, (self.user_id,))
            
            result = cur.fetchone()
            cur.close()
            conn.close()
            
            if not result:
                self.logger.error(f"No wallet connection found for user {self.user_id}")
                return None, None
            
            encrypted_api_key, encrypted_secret_key, db_environment = result
            self.logger.info(f"Found wallet connection, decrypting credentials...")
            self.logger.debug(f"API Key type: {type(encrypted_api_key)}, length: {len(encrypted_api_key) if encrypted_api_key else 0}")
            self.logger.debug(f"Secret Key type: {type(encrypted_secret_key)}, length: {len(encrypted_secret_key) if encrypted_secret_key else 0}")
            
            # Log first few bytes for debugging (not the whole key for security)
            if isinstance(encrypted_api_key, (bytes, memoryview)):
                self.logger.debug(f"API Key starts with (hex): {bytes(encrypted_api_key)[:20].hex()}")
            elif isinstance(encrypted_api_key, str):
                self.logger.debug(f"API Key starts with (str): {encrypted_api_key[:20]}")
            
            # Decrypt credentials
            try:
                api_key = decrypt_credential(encrypted_api_key)
                secret_key = decrypt_credential(encrypted_secret_key)
                self.logger.info("Successfully decrypted credentials")
                self.logger.debug(f"Decrypted API Key length: {len(api_key)}, starts with: {api_key[:10]}...")
                self.logger.debug(f"Decrypted Secret Key length: {len(secret_key)}")
                
                # Strip any whitespace that might have been added
                api_key = api_key.strip()
                secret_key = secret_key.strip()
                self.logger.debug(f"After strip - API Key length: {len(api_key)}")
            except Exception as decrypt_error:
                self.logger.error(f"Failed to decrypt credentials: {decrypt_error}")
                import traceback
                self.logger.error(traceback.format_exc())
                return None, None
            
            # Update environment from database if different
            if db_environment and db_environment != self.environment:
                self.logger.info(f"Updating environment from {self.environment} to {db_environment} (from database)")
                self.environment = db_environment
            
            self.logger.info(f"✅ Successfully fetched and decrypted credentials for user {self.user_id}")
            return api_key, secret_key
            
        except Exception as e:
            self.logger.error(f"Failed to fetch credentials from wallet database: {e}")
            import traceback
            self.logger.error(traceback.format_exc())
            return None, None
    
    def fetch_ohlcv(
        self, 
        symbol: str, 
        timeframe: str, 
        limit: int = 200
    ) -> Optional[List[List]]:
        """
        Fetch OHLCV data from Binance Mainnet (real market data).
        
        Args:
            symbol: Trading pair (e.g., 'BTC/USDT')
            timeframe: Candle timeframe (e.g., '15m', '1h', '1d')
            limit: Number of candles to fetch
        
        Returns:
            List of OHLCV candles or None if error
            Format: [[timestamp, open, high, low, close, volume], ...]
        """
        try:
            candles = self.mainnet.fetch_ohlcv(
                symbol=symbol,
                timeframe=timeframe,
                limit=limit
            )
            
            # Remove the last candle (current forming candle)
            if candles:
                candles = candles[:-1]
                self.logger.debug(
                    f"📊 Fetched {len(candles)} closed candles for {symbol} ({timeframe})"
                )
            
            return candles
            
        except Exception as e:
            self.logger.error(f"❌ Error fetching OHLCV for {symbol} ({timeframe}): {str(e)}")
            return None
    
    def get_ticker(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Get current ticker information from Mainnet.
        
        Args:
            symbol: Trading pair (e.g., 'BTC/USDT')
        
        Returns:
            Ticker data dictionary or None if error
        """
        try:
            ticker = self.mainnet.fetch_ticker(symbol)
            return ticker
        except Exception as e:
            self.logger.error(f"❌ Error fetching ticker for {symbol}: {str(e)}")
            return None
    
    def get_testnet_balance(self, currency: str = 'USDT') -> float:
        """Get balance on Testnet."""
        try:
            balance = self.demo.fetch_balance()
            return balance.get(currency, {}).get('free', 0.0)
        except Exception as e:
            self.logger.error(f"❌ Error fetching balance: {str(e)}")
            return 0.0
    
    def _simulate_partial_fills(self, symbol: str, side: str, amount: float, base_price: float, num_fills: int = 3) -> list:
        """
        Simulate partial fills for production-like testing.
        Breaks order into multiple fills with slight price slippage.
        
        Args:
            symbol: Trading pair
            side: 'buy' or 'sell'
            amount: Total amount to trade
            base_price: Base price for fills
            num_fills: Number of partial fills (default 3)
            
        Returns:
            List of partial fill events
        """
        fills = []
        remaining = amount
        
        for i in range(num_fills):
            # Last fill takes remaining amount
            if i == num_fills - 1:
                fill_amount = remaining
            else:
                # Each fill is roughly equal portion with slight variation
                base_portion = remaining / (num_fills - i)
                fill_amount = base_portion * (0.8 + (i * 0.1))  # 80-110% of equal portion
                remaining -= fill_amount
            
            # Simulate price slippage (worse prices as order progresses)
            if side == 'buy':
                # Buying: price increases slightly with each fill
                slippage = 1 + (i * 0.0003)  # 0.03% per fill
            else:
                # Selling: price decreases slightly with each fill
                slippage = 1 - (i * 0.0003)
            
            fill_price = base_price * slippage
            
            fills.append({
                'amount': fill_amount,
                'price': fill_price,
                'cost': fill_amount * fill_price,
                'timestamp': int(time.time() * 1000) + (i * 100),
                'fee': fill_amount * fill_price * 0.001  # 0.1% fee
            })
        
        return fills
    
    def place_market_order(
        self,
        symbol: str,
        side: str,
        amount: float
    ) -> Optional[Dict[str, Any]]:
        """
        Place a market order on Testnet.
        
        Args:
            symbol: Trading pair (e.g., 'BTC/USDT')
            side: 'buy' or 'sell'
            amount: Amount to buy/sell
        
        Returns:
            Order result dictionary or None if error
        """
        try:
            # Place testnet order
            self.logger.info(
                f"📝 Placing TESTNET {side.upper()} order: {amount} {symbol}"
            )
            
            order = self.demo.create_market_order(
                symbol=symbol,
                side=side,
                amount=amount
            )
            
            self.logger.info(
                f"✅ Order placed successfully! Order ID: {order.get('id')}"
            )
            self.logger.info(f"   Status: {order.get('status')}")
            self.logger.info(f"   Price: {order.get('price', 'N/A')}")
            self.logger.info(f"   Filled: {order.get('filled', 0)}")
            
            return order
            
        except Exception as e:
            self.logger.error(f"❌ Error placing order: {str(e)}")
            return None
    
    def get_open_orders(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get open orders from Testnet.
        
        Args:
            symbol: Optional trading pair to filter
        
        Returns:
            List of open orders
        """
        try:
            orders = self.demo.fetch_open_orders(symbol)
            return orders
        except Exception as e:
            self.logger.error(f"❌ Error fetching open orders: {str(e)}")
            return []
    
    def cancel_order(self, order_id: str, symbol: str) -> bool:
        """
        Cancel an order on Testnet.
        
        Args:
            order_id: Order ID to cancel
            symbol: Trading pair
        
        Returns:
            True if successful, False otherwise
        """
        try:
            self.demo.cancel_order(order_id, symbol)
            self.logger.info(f"✅ Order {order_id} cancelled successfully")
            return True
        except Exception as e:
            self.logger.error(f"❌ Error cancelling order: {str(e)}")
            return False
    
    def close(self):
        """Close exchange connections."""
        try:
            if self.mainnet and hasattr(self.mainnet, 'close'):
                self.mainnet.close()
        except Exception as e:
            self.logger.warning(f"Error closing mainnet connection: {str(e)}")
        
        try:
            if self.demo and hasattr(self.demo, 'close'):
                self.demo.close()
        except Exception as e:
            self.logger.warning(f"Error closing testnet connection: {str(e)}")
        
        self.logger.info("🔌 Exchange connections closed")
