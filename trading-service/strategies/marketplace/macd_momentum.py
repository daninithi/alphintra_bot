"""
MACD Momentum Strategy
Trend-following strategy using MACD crossovers with momentum confirmation
"""

import pandas as pd
from typing import Dict
from strategies.base_strategy import BaseStrategy, TradingSignal, SignalType


class MACDMomentumStrategy(BaseStrategy):
    """
    MACD Momentum Trading Strategy
    
    This strategy identifies trends using MACD (Moving Average Convergence Divergence)
    crossovers and confirms momentum with volume and price action.
    
    Buy Signal:
    - MACD line crosses above signal line (bullish crossover)
    - MACD histogram is positive and increasing
    - Price is above 20-period EMA
    - Volume is above average
    
    Sell Signal:
    - MACD line crosses below signal line (bearish crossover)
    - MACD histogram is negative and decreasing
    - Price is below 20-period EMA
    
    Risk Management:
    - Stop Loss: 2% below entry
    - Take Profit: 4% above entry (2:1 risk-reward)
    """
    
    def __init__(self):
        super().__init__(name="MACD Momentum")
        self.timeframe = "1h"  # Primary timeframe
        self.stop_loss_pct = 2.0
        self.take_profit_pct = 4.0
    
    def get_description(self) -> str:
        return "Trend-following strategy using MACD crossovers with momentum confirmation"
    
    def analyze(self, symbol: str, data: Dict[str, pd.DataFrame], current_price: float) -> TradingSignal:
        """
        Analyze market data and generate trading signals
        
        Args:
            symbol: Trading pair symbol (e.g., 'BTC/USDT')
            data: Dictionary with timeframe as key and OHLCV DataFrame as value
            current_price: Current market price
        
        Returns:
            TradingSignal object with signal type, confidence, and reason
        """
        if not self.validate_data(data):
            return TradingSignal(
                signal=SignalType.HOLD,
                confidence=0,
                reason="Insufficient data for analysis"
            )
        
        # Get data for primary timeframe
        if self.timeframe not in data:
            return TradingSignal(
                signal=SignalType.HOLD,
                confidence=0,
                reason="Required timeframe data not available"
            )
        
        df = data[self.timeframe].copy()
        
        if len(df) < 50:
            return TradingSignal(
                signal=SignalType.HOLD,
                confidence=0,
                reason="Insufficient data"
            )
        
        # Get latest values (use current_price parameter instead of dataframe)
        macd = df['macd'].iloc[-1]
        macd_signal = df['macd_signal'].iloc[-1]
        macd_hist = df['macd_histogram'].iloc[-1]
        prev_macd_hist = df['macd_histogram'].iloc[-2]
        ema_20 = df['ema_20'].iloc[-1]
        volume = df['volume'].iloc[-1]
        avg_volume = df['volume'].rolling(20).mean().iloc[-1]
        
        # Check for NaN values
        if any(pd.isna([macd, macd_signal, macd_hist, ema_20])):
            return TradingSignal(
                signal=SignalType.HOLD,
                confidence=0,
                reason="Indicator values not available"
            )
        
        # Calculate signal components
        signal_type = SignalType.HOLD
        confidence = 20
        reasons = []
        
        # Check for MACD crossover
        macd_bullish = macd > macd_signal
        macd_bearish = macd < macd_signal
        
        # Check if histogram is increasing/decreasing
        hist_increasing = macd_hist > prev_macd_hist
        hist_decreasing = macd_hist < prev_macd_hist
        
        # Check price position relative to EMA
        price_above_ema = current_price > ema_20
        price_below_ema = current_price < ema_20
        
        # Check volume
        high_volume = volume > avg_volume * 1.2
        
        # BUY SIGNAL CONDITIONS
        if macd_bullish and macd_hist > 0:
            confidence = 50
            reasons.append(f"MACD bullish: {macd:.2f} > {macd_signal:.2f}")
            
            if hist_increasing:
                confidence += 15
                reasons.append("Histogram increasing")
            
            if price_above_ema:
                confidence += 15
                reasons.append(f"Price above EMA20: ${current_price:.2f} > ${ema_20:.2f}")
            
            if high_volume:
                confidence += 10
                reasons.append("Strong volume")
            
            if confidence >= 60:
                signal_type = SignalType.BUY
        
        # SELL SIGNAL CONDITIONS
        elif macd_bearish and macd_hist < 0:
            confidence = 50
            reasons.append(f"MACD bearish: {macd:.2f} < {macd_signal:.2f}")
            
            if hist_decreasing:
                confidence += 15
                reasons.append("Histogram decreasing")
            
            if price_below_ema:
                confidence += 15
                reasons.append(f"Price below EMA20: ${current_price:.2f} < ${ema_20:.2f}")
            
            if high_volume:
                confidence += 10
                reasons.append("Strong volume")
            
            if confidence >= 60:
                signal_type = SignalType.SELL
        
        # HOLD CONDITION
        else:
            reasons.append(f"MACD: {macd:.2f} | Signal: {macd_signal:.2f} | Hist: {macd_hist:.4f}")
            reasons.append("No clear momentum signal")
        
        # Calculate stop loss and take profit
        stop_loss = None
        take_profit = None
        
        if signal_type == SignalType.BUY:
            stop_loss = float(current_price * (1 - self.stop_loss_pct / 100))
            take_profit = float(current_price * (1 + self.take_profit_pct / 100))
        elif signal_type == SignalType.SELL:
            stop_loss = float(current_price * (1 + self.stop_loss_pct / 100))
            take_profit = float(current_price * (1 - self.take_profit_pct / 100))
        
        return TradingSignal(
            signal=signal_type,
            confidence=min(confidence, 95),
            reason=" | ".join(reasons),
            entry_price=current_price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            metadata={
                "macd": float(macd),
                "macd_signal": float(macd_signal),
                "macd_histogram": float(macd_hist),
                "ema_20": float(ema_20),
                "volume_ratio": float(volume / avg_volume) if avg_volume > 0 else 0
            }
        )
