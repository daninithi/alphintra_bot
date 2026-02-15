"""
Custom Scalping Strategy (User Created - User 3)
Fast scalping strategy for quick profits
"""
from strategies.base_strategy import BaseStrategy, TradingSignal, SignalType
from typing import Dict
import pandas as pd


class CustomScalpingStrategy(BaseStrategy):
    """Custom scalping strategy combining RSI, MACD, and volume."""
    
    def __init__(self):
        super().__init__(name="My Custom Scalping Strategy")
        self.rsi_buy = 40
        self.rsi_sell = 60
    
    def get_description(self) -> str:
        return "Personalized scalping strategy for quick 0.5-1% gains with tight stop-loss."
    
    def analyze(self, symbol: str, data: Dict[str, pd.DataFrame], current_price: float) -> TradingSignal:
        """Analyze using scalping indicators."""
        df = data.get("15m")  # Use 15-minute timeframe for scalping
        if df is None or df.empty or len(df) < 2:
            return TradingSignal(SignalType.HOLD, 0, "Insufficient data", current_price)
        
        latest = df.iloc[-1]
        previous = df.iloc[-2]
        
        rsi = latest.get("rsi_14", 50)
        macd = latest.get("macd", 0)
        macd_signal = latest.get("macd_signal", 0)
        prev_macd = previous.get("macd", 0)
        prev_signal = previous.get("macd_signal", 0)
        volume = latest.get("volume", 0)
        avg_volume = df['volume'].rolling(10).mean().iloc[-1] if 'volume' in df.columns else 1
        
        reasons = []
        confidence = 0
        signal_type = SignalType.HOLD
        
        volume_ratio = volume / avg_volume if avg_volume > 0 else 1
        
        # BUY Signal
        if rsi < self.rsi_buy and prev_macd <= prev_signal and macd > macd_signal:
            reasons.append(f"RSI oversold: {rsi:.1f}")
            reasons.append("MACD bullish crossover")
            confidence += 50
            
            if volume_ratio > 1.2:
                reasons.append(f"Good volume: {volume_ratio:.1f}x")
                confidence += 20
                signal_type = SignalType.BUY
        
        # SELL Signal
        elif rsi > self.rsi_sell and prev_macd >= prev_signal and macd < macd_signal:
            reasons.append(f"RSI overbought: {rsi:.1f}")
            reasons.append("MACD bearish crossover")
            confidence += 50
            
            if volume_ratio > 1.2:
                reasons.append(f"Good volume: {volume_ratio:.1f}x")
                confidence += 20
                signal_type = SignalType.SELL
        else:
            reasons.append(f"RSI: {rsi:.1f}, MACD: {macd:.2f}")
            confidence = 25
        
        # Tight stop-loss for scalping (0.5%)
        stop_loss = float(current_price * 0.995) if signal_type == SignalType.BUY else float(current_price * 1.005) if signal_type == SignalType.SELL else None
        # Target profit (1%)
        take_profit = float(current_price * 1.01) if signal_type == SignalType.BUY else float(current_price * 0.99) if signal_type == SignalType.SELL else None
        
        return TradingSignal(
            signal=signal_type,
            confidence=confidence,
            reason="; ".join(reasons),
            entry_price=current_price,
            stop_loss=stop_loss,
            take_profit=take_profit
        )
