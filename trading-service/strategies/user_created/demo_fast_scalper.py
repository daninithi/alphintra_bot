"""
Demo Fast Scalper Strategy
Optimized for frequent signal generation and UI testing
Uses EMA 9/21 crossover on 1-minute timeframe

This strategy is designed for DEMO/TESTING purposes:
- Generates frequent buy/sell signals
- Uses short timeframes (1m)
- Loose entry/exit criteria
- Perfect for testing order flow, positions, and PnL updates

NOT recommended for live trading - use for demo purposes only
"""
from typing import Dict
import pandas as pd
import sys
from pathlib import Path

# Add parent directory to path to import BaseStrategy
sys.path.insert(0, str(Path(__file__).parent.parent))
from base_strategy import BaseStrategy, TradingSignal, SignalType


class DemoFastScalper(BaseStrategy):
    """
    Demo Fast Scalper Strategy
    
    Entry Rules:
    - BUY: EMA9 crosses above EMA21 (golden cross on 1m)
    - SELL: EMA9 crosses below EMA21 (death cross on 1m)
    
    Risk Management:
    - Stop Loss: 1.5% (tight for scalping)
    - Take Profit: 2.5% (quick profits)
    """
    
    def __init__(self):
        super().__init__(name="Demo Fast Scalper")
        self.timeframes = ["1m"]  # Only use 1-minute for fast signals
        self.required_candles = 100  # Less historical data needed
    
    def get_description(self) -> str:
        return "EMA 9/21 crossover optimized for 1m timeframe - generates frequent signals for demo/testing"
        
    def analyze(self, symbol: str, data: Dict[str, pd.DataFrame], current_price: float) -> TradingSignal:
        """
        Analyze market data and generate trading signal
        
        Args:
            symbol: Trading pair (e.g., 'SOL/USDT')
            data: Dictionary of dataframes keyed by timeframe
            current_price: Current market price
            
        Returns:
            TradingSignal object with signal type and parameters
        """
        try:
            # Use 1-minute timeframe for fastest signals
            df = data.get("1m")
            
            if df is None or df.empty:
                return TradingSignal(
                    signal=SignalType.HOLD, 
                    confidence=0.0, 
                    reason="No 1m data available",
                    entry_price=current_price
                )
            
            # Get latest values
            latest = df.iloc[-1]
            previous = df.iloc[-2] if len(df) > 1 else latest
            
            # Extract indicators
            ema9_current = latest.get('ema_9', 0)
            ema21_current = latest.get('ema_21', 0)
            ema9_prev = previous.get('ema_9', 0)
            ema21_prev = previous.get('ema_21', 0)
            
            rsi = latest.get('rsi_14', 50)
            volume = latest.get('volume', 0)
            
            # Validate data
            if ema9_current == 0 or ema21_current == 0:
                return TradingSignal(
                    signal=SignalType.HOLD, 
                    confidence=0.0, 
                    reason="Waiting for EMA indicators",
                    entry_price=current_price
                )
            
            # Calculate stop loss and take profit
            stop_loss_pct = 0.015  # 1.5% for scalping
            take_profit_pct = 0.025  # 2.5% for quick profits
            
            # Calculate EMA distance as percentage
            ema_distance_pct = abs((ema9_current - ema21_current) / ema21_current) * 100
            
            # Near-crossover threshold for aggressive demo/testing (0.5% = relatively close for demo)
            near_crossover_threshold = 0.5
            
            # BUY Signal: EMA9 crosses above EMA21 (Golden Cross) OR very close and approaching from below
            if ema9_prev <= ema21_prev and ema9_current > ema21_current:
                # Full crossover - highest confidence
                confidence = min(95, 70 + (70 - rsi) / 2) if rsi < 70 else 70
                reason = f"🚀 EMA9 Golden Cross | EMA9: {ema9_current:.2f} > EMA21: {ema21_current:.2f} | RSI: {rsi:.1f}"
                
                return TradingSignal(
                    signal=SignalType.BUY,
                    confidence=confidence,
                    reason=reason,
                    entry_price=current_price,
                    stop_loss=current_price * (1 - stop_loss_pct),
                    take_profit=current_price * (1 + take_profit_pct)
                )
            
            # Near-crossover BUY: EMAs very close, EMA9 approaching from below
            elif (ema9_current < ema21_current and 
                  ema_distance_pct <= near_crossover_threshold and
                  ema9_current > ema9_prev):  # EMA9 is rising toward EMA21
                confidence = 70  # Lower confidence for near-crossover
                reason = f"🟡 Near Golden Cross | EMA9: {ema9_current:.2f} ({ema_distance_pct:.3f}% below EMA21) | Rising | RSI: {rsi:.1f}"
                
                return TradingSignal(
                    signal=SignalType.BUY,
                    confidence=confidence,
                    reason=reason,
                    entry_price=current_price,
                    stop_loss=current_price * (1 - stop_loss_pct),
                    take_profit=current_price * (1 + take_profit_pct)
                )
            
            # SELL Signal: EMA9 crosses below EMA21 (Death Cross) OR very close and approaching from above
            elif ema9_prev >= ema21_prev and ema9_current < ema21_current:
                # Full crossover - highest confidence
                confidence = min(95, 70 + (rsi - 30) / 2) if rsi > 30 else 70
                reason = f"📉 EMA9 Death Cross | EMA9: {ema9_current:.2f} < EMA21: {ema21_current:.2f} | RSI: {rsi:.1f}"
                
                return TradingSignal(
                    signal=SignalType.SELL,
                    confidence=confidence,
                    reason=reason,
                    entry_price=current_price,
                    stop_loss=current_price * (1 + stop_loss_pct),
                    take_profit=current_price * (1 - take_profit_pct)
                )
            
            # Near-crossover SELL: EMAs very close, EMA9 approaching from above
            elif (ema9_current > ema21_current and 
                  ema_distance_pct <= near_crossover_threshold and
                  ema9_current < ema9_prev):  # EMA9 is falling toward EMA21
                confidence = 70  # Lower confidence for near-crossover
                reason = f"🟡 Near Death Cross | EMA9: {ema9_current:.2f} ({ema_distance_pct:.3f}% above EMA21) | Falling | RSI: {rsi:.1f}"
                
                return TradingSignal(
                    signal=SignalType.SELL,
                    confidence=confidence,
                    reason=reason,
                    entry_price=current_price,
                    stop_loss=current_price * (1 + stop_loss_pct),
                    take_profit=current_price * (1 - take_profit_pct)
                )
            
            # HOLD Signal: No crossover detected
            else:
                # Determine trend direction
                if ema9_current > ema21_current:
                    trend = "bullish"
                    distance = ((ema9_current - ema21_current) / ema21_current) * 100
                    reason = f"📊 Holding bullish trend | EMA9 {distance:.2f}% above EMA21 | RSI: {rsi:.1f}"
                else:
                    trend = "bearish"
                    distance = ((ema21_current - ema9_current) / ema21_current) * 100
                    reason = f"📊 Holding bearish trend | EMA9 {distance:.2f}% below EMA21 | RSI: {rsi:.1f}"
                
                return TradingSignal(
                    signal=SignalType.HOLD,
                    confidence=50.0,
                    reason=reason,
                    entry_price=current_price
                )
                
        except Exception as e:
            return TradingSignal(
                signal=SignalType.HOLD, 
                confidence=0.0, 
                reason=f"Error in analysis: {str(e)}",
                entry_price=current_price
            )

# Strategy instance for import
strategy = DemoFastScalper()
