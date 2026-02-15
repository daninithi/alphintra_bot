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


class ExchangeManager:
    """
    Manages connections to Binance Mainnet (data) and Bybit Demo Trading (orders).
    - Binance Mainnet: For fetching real market data (read-only)
    - Bybit Demo: For placing orders in Bybit demo environment (realistic testing)
    """
    
    def __init__(self):
        self.logger = setup_logger("ExchangeManager", Config.LOG_LEVEL)
        self.mainnet: Optional[ccxt.binance] = None
        self.demo: Optional[ccxt.binance] = None

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
            
            # Initialize Binance Testnet (for orders)
            self.demo = ccxt.binance({
                'apiKey': Config.BINANCE_TESTNET_API_KEY,
                'secret': Config.BINANCE_TESTNET_SECRET,
                'enableRateLimit': True,
            })
            
            # CRITICAL: Enable testnet mode
            self.demo.set_sandbox_mode(True)
            
            # Sync time to prevent timestamp errors
            self.demo.options['adjustForTimeDifference'] = True
            self.demo.options['recvWindow'] = 60000  # Large window for timestamp tolerance
            self.demo.load_time_difference()
            
            self.logger.info(f"🔍 Testnet URLs: {self.demo.urls['api']}")
            self.logger.info("🔄 Testing Binance Testnet connection...")
            
            demo_balance = self.demo.fetch_balance()
            usdt_balance = demo_balance.get('USDT', {})
            
            self.logger.info(f"✅ Binance Testnet connected successfully!")
            self.logger.info(f"💰 USDT Balance:")
            self.logger.info(f"   Free: ${usdt_balance.get('free', 0):,.2f}")
            self.logger.info(f"   Used: ${usdt_balance.get('used', 0):,.2f}")
            self.logger.info(f"   Total: ${usdt_balance.get('total', 0):,.2f}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Failed to initialize exchanges: {str(e)}")
            return False
    
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
