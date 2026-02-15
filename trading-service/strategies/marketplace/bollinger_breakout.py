"""
Bollinger Band Breakout Strategy (Marketplace)
Premium strategy for breakout trading
"""
from strategies.base_strategy import BaseStrategy, TradingSignal, SignalType
from typing import Dict
import pandas as pd


class BollingerBreakoutStrategy(BaseStrategy):
    """Bollinger Band breakout strategy with volume confirmation."""
    
    def __init__(self):
        super().__init__(name="Bollinger Band Breakout")
        self.volume_threshold = 1.5  # Volume should be 1.5x average
    
    def get_description(self) -> str:
        return "Premium breakout strategy using Bollinger Bands and volume confirmation."
    
    def analyze(self, symbol: str, data: Dict[str, pd.DataFrame], current_price: float) -> TradingSignal:
        """Analyze using Bollinger Band breakouts."""
        df = data.get("1h")
        if df is None or df.empty or len(df) < 20:
            return TradingSignal(SignalType.HOLD, 0, "Insufficient data", current_price)
        
        latest = df.iloc[-1]
        bb_upper = latest.get("bb_upper", current_price * 1.02)
        bb_lower = latest.get("bb_lower", current_price * 0.98)
        volume = latest.get("volume", 0)
        avg_volume = df['volume'].rolling(20).mean().iloc[-1] if 'volume' in df.columns else 1
        
        reasons = []
        confidence = 0
        signal_type = SignalType.HOLD
        
        volume_ratio = volume / avg_volume if avg_volume > 0 else 1
        
        # Bullish breakout
        if current_price > bb_upper:
            reasons.append(f"Price broke above upper BB: ${current_price:.2f} > ${bb_upper:.2f}")
            confidence += 40
            
            if volume_ratio > self.volume_threshold:
                reasons.append(f"Strong volume: {volume_ratio:.1f}x average")
                confidence += 30
                signal_type = SignalType.BUY
            else:
                reasons.append(f"Weak volume: {volume_ratio:.1f}x average")
                confidence += 10
        
        # Bearish breakout
        elif current_price < bb_lower:
            reasons.append(f"Price broke below lower BB: ${current_price:.2f} < ${bb_lower:.2f}")
            confidence += 40
            
            if volume_ratio > self.volume_threshold:
                reasons.append(f"Strong volume: {volume_ratio:.1f}x average")
                confidence += 30
                signal_type = SignalType.SELL
            else:
                reasons.append(f"Weak volume: {volume_ratio:.1f}x average")
                confidence += 10
        else:
            reasons.append("Price within Bollinger Bands")
            confidence = 20
        
        # Calculate dynamic stop-loss based on ATR
        atr = latest.get("atr_14", current_price * 0.02)
        stop_loss = float(current_price - (2 * atr)) if signal_type == SignalType.BUY else float(current_price + (2 * atr)) if signal_type == SignalType.SELL else None
        take_profit = float(current_price + (3 * atr)) if signal_type == SignalType.BUY else float(current_price - (3 * atr)) if signal_type == SignalType.SELL else None
        
        return TradingSignal(
            signal=signal_type,
            confidence=confidence,
            reason="; ".join(reasons),
            entry_price=current_price,
            stop_loss=stop_loss,
            take_profit=take_profit
        )
