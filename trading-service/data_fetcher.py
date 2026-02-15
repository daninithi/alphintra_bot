"""
Data Fetcher module for retrieving and organizing market data.
Handles multi-timeframe OHLCV data collection.
"""
import pandas as pd
from typing import Dict, List, Optional
from datetime import datetime
from exchange_manager import ExchangeManager
from config import Config
from logger import setup_logger


class DataFetcher:
    """
    Fetches and organizes market data from the exchange.
    Supports multiple symbols and timeframes.
    """
    
    def __init__(self, exchange_manager: ExchangeManager):
        self.exchange = exchange_manager
        self.logger = setup_logger("DataFetcher", Config.LOG_LEVEL)
    
    def fetch_multi_timeframe_data(
        self,
        symbol: str,
        timeframes: Optional[List[str]] = None,
        limit: int = 200
    ) -> Dict[str, pd.DataFrame]:
        """
        Fetch OHLCV data for multiple timeframes.
        
        Args:
            symbol: Trading pair (e.g., 'BTC/USDT')
            timeframes: List of timeframes (e.g., ['15m', '1h', '1d'])
            limit: Number of candles to fetch per timeframe
        
        Returns:
            Dictionary mapping timeframe to DataFrame
            Example: {'15m': DataFrame, '1h': DataFrame, ...}
        """
        if timeframes is None:
            timeframes = Config.TIMEFRAMES
        
        data = {}
        
        self.logger.info(f"📥 Fetching data for {symbol} across {len(timeframes)} timeframes...")
        
        for timeframe in timeframes:
            try:
                candles = self.exchange.fetch_ohlcv(
                    symbol=symbol,
                    timeframe=timeframe,
                    limit=limit
                )
                
                if candles:
                    df = self._convert_to_dataframe(candles)
                    data[timeframe] = df
                    
                    self.logger.debug(
                        f"   ✓ {timeframe}: {len(df)} candles "
                        f"({df['timestamp'].min()} to {df['timestamp'].max()})"
                    )
                else:
                    self.logger.warning(f"   ⚠️  No data for {timeframe}")
                    
            except Exception as e:
                self.logger.error(f"   ❌ Error fetching {timeframe} data: {str(e)}")
        
        self.logger.info(f"✅ Fetched data for {len(data)}/{len(timeframes)} timeframes")
        
        return data
    
    def fetch_all_symbols_data(
        self,
        symbols: Optional[List[str]] = None,
        timeframes: Optional[List[str]] = None,
        limit: int = 200
    ) -> Dict[str, Dict[str, pd.DataFrame]]:
        """
        Fetch OHLCV data for multiple symbols and timeframes.
        
        Args:
            symbols: List of trading pairs
            timeframes: List of timeframes
            limit: Number of candles to fetch
        
        Returns:
            Nested dictionary: {symbol: {timeframe: DataFrame}}
            Example: {'BTC/USDT': {'15m': DataFrame, '1h': DataFrame}, ...}
        """
        if symbols is None:
            symbols = Config.TRADING_PAIRS
        
        if timeframes is None:
            timeframes = Config.TIMEFRAMES
        
        all_data = {}
        
        self.logger.info(
            f"📥 Fetching data for {len(symbols)} symbols × {len(timeframes)} timeframes..."
        )
        
        for symbol in symbols:
            symbol_data = self.fetch_multi_timeframe_data(
                symbol=symbol,
                timeframes=timeframes,
                limit=limit
            )
            all_data[symbol] = symbol_data
        
        self.logger.info(f"✅ Data fetch complete for all symbols")
        
        return all_data
    
    def _convert_to_dataframe(self, candles: List[List]) -> pd.DataFrame:
        """
        Convert raw OHLCV candles to a pandas DataFrame.
        
        Args:
            candles: List of [timestamp, open, high, low, close, volume]
        
        Returns:
            DataFrame with columns: timestamp, open, high, low, close, volume
        """
        df = pd.DataFrame(
            candles,
            columns=['timestamp', 'open', 'high', 'low', 'close', 'volume']
        )
        
        # Convert timestamp to datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        
        # Ensure numeric types
        for col in ['open', 'high', 'low', 'close', 'volume']:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        return df
    
    def get_latest_price(self, symbol: str) -> Optional[float]:
        """
        Get the latest price for a symbol.
        
        Args:
            symbol: Trading pair
        
        Returns:
            Latest price or None
        """
        ticker = self.exchange.get_ticker(symbol)
        if ticker:
            return ticker.get('last')
        return None
    
    def get_data_summary(self, data: Dict[str, Dict[str, pd.DataFrame]]) -> str:
        """
        Generate a summary of fetched data.
        
        Args:
            data: Nested dictionary of symbol->timeframe->DataFrame
        
        Returns:
            Summary string
        """
        summary = "\n" + "="*60 + "\n"
        summary += "📊 Data Summary\n"
        summary += "="*60 + "\n"
        
        for symbol, timeframes_data in data.items():
            summary += f"\n{symbol}:\n"
            for timeframe, df in timeframes_data.items():
                if not df.empty:
                    latest = df.iloc[-1]
                    summary += f"  {timeframe:>4s}: {len(df):>3d} candles | "
                    summary += f"Latest: ${latest['close']:,.2f} | "
                    summary += f"Volume: {latest['volume']:,.2f}\n"
        
        summary += "="*60 + "\n"
        
        return summary
