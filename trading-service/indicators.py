"""
Technical Indicators module using pandas-ta.
Provides common trading indicators for strategy analysis.
"""
import pandas as pd
import pandas_ta as ta
from typing import Dict, Optional
from logger import setup_logger
from config import Config


class TechnicalIndicators:
    """
    Calculate technical indicators for trading analysis.
    Supports RSI, MACD, EMA, SMA, Bollinger Bands, etc.
    """
    
    def __init__(self):
        self.logger = setup_logger("TechnicalIndicators", Config.LOG_LEVEL)
    
    def add_all_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Add all common technical indicators to a DataFrame.
        
        Args:
            df: DataFrame with OHLCV data
        
        Returns:
            DataFrame with added indicator columns
        """
        if df.empty or len(df) < 50:
            self.logger.warning("⚠️  Insufficient data for indicators (need at least 50 candles)")
            return df
        
        df = df.copy()
        
        # Trend Indicators
        df = self.add_ema(df, periods=[9, 20, 21, 50, 200])
        df = self.add_sma(df, periods=[20, 50, 200])
        
        # Momentum Indicators
        df = self.add_rsi(df, period=14)
        df = self.add_macd(df)
        df = self.add_stochastic(df)
        
        # Volatility Indicators
        df = self.add_bollinger_bands(df)
        df = self.add_atr(df)
        
        # Volume Indicators
        df = self.add_volume_sma(df, period=20)
        
        return df
    
    def add_rsi(self, df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
        """
        Add Relative Strength Index (RSI).
        
        Args:
            df: DataFrame with 'close' column
            period: RSI period (default 14)
        
        Returns:
            DataFrame with 'rsi' column
        """
        df = df.copy()
        df['rsi'] = ta.rsi(df['close'], length=period)
        return df
    
    def add_macd(
        self,
        df: pd.DataFrame,
        fast: int = 12,
        slow: int = 26,
        signal: int = 9
    ) -> pd.DataFrame:
        """
        Add MACD (Moving Average Convergence Divergence).
        
        Args:
            df: DataFrame with 'close' column
            fast: Fast EMA period
            slow: Slow EMA period
            signal: Signal line period
        
        Returns:
            DataFrame with 'macd', 'macd_signal', 'macd_histogram' columns
        """
        df = df.copy()
        macd = ta.macd(df['close'], fast=fast, slow=slow, signal=signal)
        
        if macd is not None:
            df['macd'] = macd[f'MACD_{fast}_{slow}_{signal}']
            df['macd_signal'] = macd[f'MACDs_{fast}_{slow}_{signal}']
            df['macd_histogram'] = macd[f'MACDh_{fast}_{slow}_{signal}']
        
        return df
    
    def add_ema(
        self,
        df: pd.DataFrame,
        periods: list = [9, 20, 50, 200]
    ) -> pd.DataFrame:
        """
        Add Exponential Moving Averages (EMA).
        
        Args:
            df: DataFrame with 'close' column
            periods: List of EMA periods
        
        Returns:
            DataFrame with 'ema_{period}' columns
        """
        df = df.copy()
        for period in periods:
            df[f'ema_{period}'] = ta.ema(df['close'], length=period)
        return df
    
    def add_sma(
        self,
        df: pd.DataFrame,
        periods: list = [20, 50, 200]
    ) -> pd.DataFrame:
        """
        Add Simple Moving Averages (SMA).
        
        Args:
            df: DataFrame with 'close' column
            periods: List of SMA periods
        
        Returns:
            DataFrame with 'sma_{period}' columns
        """
        df = df.copy()
        for period in periods:
            df[f'sma_{period}'] = ta.sma(df['close'], length=period)
        return df
    
    def add_bollinger_bands(
        self,
        df: pd.DataFrame,
        period: int = 20,
        std: float = 2.0
    ) -> pd.DataFrame:
        """
        Add Bollinger Bands.
        
        Args:
            df: DataFrame with 'close' column
            period: Moving average period
            std: Standard deviation multiplier
        
        Returns:
            DataFrame with 'bb_upper', 'bb_middle', 'bb_lower' columns
        """
        df = df.copy()
        bb = ta.bbands(df['close'], length=period, std=std)
        
        if bb is not None:
            # Handle both old and new naming conventions
            if f'BBL_{period}_{std}' in bb.columns:
                df['bb_lower'] = bb[f'BBL_{period}_{std}']
                df['bb_middle'] = bb[f'BBM_{period}_{std}']
                df['bb_upper'] = bb[f'BBU_{period}_{std}']
            elif f'BBL_{period}_{int(std)}' in bb.columns:
                df['bb_lower'] = bb[f'BBL_{period}_{int(std)}']
                df['bb_middle'] = bb[f'BBM_{period}_{int(std)}']
                df['bb_upper'] = bb[f'BBU_{period}_{int(std)}']
            else:
                # Try to find columns with BBL, BBM, BBU prefix
                bbl_cols = [col for col in bb.columns if col.startswith('BBL_')]
                bbm_cols = [col for col in bb.columns if col.startswith('BBM_')]
                bbu_cols = [col for col in bb.columns if col.startswith('BBU_')]
                if bbl_cols and bbm_cols and bbu_cols:
                    df['bb_lower'] = bb[bbl_cols[0]]
                    df['bb_middle'] = bb[bbm_cols[0]]
                    df['bb_upper'] = bb[bbu_cols[0]]
        
        return df
    
    def add_atr(self, df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
        """
        Add Average True Range (ATR) - volatility indicator.
        
        Args:
            df: DataFrame with 'high', 'low', 'close' columns
            period: ATR period
        
        Returns:
            DataFrame with 'atr' column
        """
        df = df.copy()
        df['atr'] = ta.atr(df['high'], df['low'], df['close'], length=period)
        return df
    
    def add_stochastic(
        self,
        df: pd.DataFrame,
        k_period: int = 14,
        d_period: int = 3
    ) -> pd.DataFrame:
        """
        Add Stochastic Oscillator.
        
        Args:
            df: DataFrame with 'high', 'low', 'close' columns
            k_period: %K period
            d_period: %D period
        
        Returns:
            DataFrame with 'stoch_k', 'stoch_d' columns
        """
        df = df.copy()
        stoch = ta.stoch(df['high'], df['low'], df['close'], k=k_period, d=d_period)
        
        if stoch is not None:
            df['stoch_k'] = stoch[f'STOCHk_{k_period}_{d_period}_3']
            df['stoch_d'] = stoch[f'STOCHd_{k_period}_{d_period}_3']
        
        return df
    
    def add_volume_sma(self, df: pd.DataFrame, period: int = 20) -> pd.DataFrame:
        """
        Add Volume Simple Moving Average.
        
        Args:
            df: DataFrame with 'volume' column
            period: SMA period
        
        Returns:
            DataFrame with 'volume_sma' column
        """
        df = df.copy()
        df['volume_sma'] = ta.sma(df['volume'], length=period)
        return df
    
    def get_trend_direction(self, df: pd.DataFrame) -> str:
        """
        Determine overall trend direction based on EMAs.
        
        Args:
            df: DataFrame with EMA columns
        
        Returns:
            'UPTREND', 'DOWNTREND', or 'SIDEWAYS'
        """
        if df.empty or len(df) < 50:
            return "UNKNOWN"
        
        latest = df.iloc[-1]
        
        # Check if EMAs exist
        if 'ema_20' not in df.columns or 'ema_50' not in df.columns:
            return "UNKNOWN"
        
        price = latest['close']
        ema_20 = latest['ema_20']
        ema_50 = latest['ema_50']
        
        if pd.isna(ema_20) or pd.isna(ema_50):
            return "UNKNOWN"
        
        # Strong uptrend: price > EMA20 > EMA50
        if price > ema_20 > ema_50:
            return "UPTREND"
        
        # Strong downtrend: price < EMA20 < EMA50
        elif price < ema_20 < ema_50:
            return "DOWNTREND"
        
        else:
            return "SIDEWAYS"
    
    def get_rsi_signal(self, df: pd.DataFrame) -> str:
        """
        Get RSI-based signal.
        
        Args:
            df: DataFrame with 'rsi' column
        
        Returns:
            'OVERSOLD', 'OVERBOUGHT', or 'NEUTRAL'
        """
        if df.empty or 'rsi' not in df.columns:
            return "UNKNOWN"
        
        latest_rsi = df.iloc[-1]['rsi']
        
        if pd.isna(latest_rsi):
            return "UNKNOWN"
        
        if latest_rsi < 30:
            return "OVERSOLD"
        elif latest_rsi > 70:
            return "OVERBOUGHT"
        else:
            return "NEUTRAL"
    
    def get_macd_signal(self, df: pd.DataFrame) -> str:
        """
        Get MACD-based signal.
        
        Args:
            df: DataFrame with MACD columns
        
        Returns:
            'BULLISH', 'BEARISH', or 'NEUTRAL'
        """
        if df.empty or 'macd' not in df.columns or 'macd_signal' not in df.columns:
            return "UNKNOWN"
        
        if len(df) < 2:
            return "UNKNOWN"
        
        current = df.iloc[-1]
        previous = df.iloc[-2]
        
        if pd.isna(current['macd']) or pd.isna(current['macd_signal']):
            return "UNKNOWN"
        
        # Bullish crossover: MACD crosses above signal
        if previous['macd'] <= previous['macd_signal'] and current['macd'] > current['macd_signal']:
            return "BULLISH_CROSS"
        
        # Bearish crossover: MACD crosses below signal
        elif previous['macd'] >= previous['macd_signal'] and current['macd'] < current['macd_signal']:
            return "BEARISH_CROSS"
        
        # Currently bullish
        elif current['macd'] > current['macd_signal']:
            return "BULLISH"
        
        # Currently bearish
        elif current['macd'] < current['macd_signal']:
            return "BEARISH"
        
        else:
            return "NEUTRAL"
