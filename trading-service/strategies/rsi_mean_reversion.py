"""
RSI Mean Reversion Strategy.

Strategy Logic:
- Looks for oversold/overbought conditions using RSI
- Combines RSI with trend confirmation from EMAs
- Uses Bollinger Bands for additional confirmation

Buy Conditions:
1. RSI < 30 (oversold)
2. Price near or below lower Bollinger Band
3. MACD showing signs of reversal
4. Not in strong downtrend

Sell Conditions:
1. RSI > 70 (overbought)
2. Price near or above upper Bollinger Band
3. MACD showing signs of reversal
4. Not in strong uptrend
"""
from strategies.base_strategy import BaseStrategy, TradingSignal, SignalType
from typing import Dict
import pandas as pd
from config import Config


class RSIMeanReversionStrategy(BaseStrategy):
    """
    RSI-based mean reversion strategy.
    Looks for oversold/overbought conditions for entry.
    """
    
    def __init__(self):
        super().__init__(name="RSI Mean Reversion")
        
        # Production thresholds
        self.rsi_buy_threshold = 30
        self.rsi_sell_threshold = 70
        self.min_confidence = 50
    
    def get_description(self) -> str:
        return (
            "Mean reversion strategy using RSI, Bollinger Bands, "
            "and MACD for confirmation. Buys oversold, sells overbought."
        )
    
    def analyze(
        self,
        symbol: str,
        data: Dict[str, pd.DataFrame],
        current_price: float
    ) -> TradingSignal:
        """Analyze market data for mean reversion opportunities."""
        
        if not self.validate_data(data):
            return TradingSignal(
                signal=SignalType.HOLD,
                confidence=0,
                reason="Insufficient data for analysis"
            )
        
        # Use primary timeframe (1h or highest available)
        primary_tf = self._get_primary_timeframe(data)
        if not primary_tf:
            return TradingSignal(
                signal=SignalType.HOLD,
                confidence=0,
                reason="Primary timeframe not available"
            )
        
        df = data[primary_tf]
        
        # Require minimum data
        if len(df) < 50:
            return TradingSignal(
                signal=SignalType.HOLD,
                confidence=0,
                reason="Insufficient candles for analysis"
            )
        
        latest = df.iloc[-1]
        
        # Check required indicators
        required_indicators = ['rsi', 'bb_upper', 'bb_lower', 'bb_middle']
        if not all(ind in df.columns for ind in required_indicators):
            return TradingSignal(
                signal=SignalType.HOLD,
                confidence=0,
                reason="Required indicators not calculated"
            )
        
        # Analyze conditions
        return self._generate_signal(df, current_price, symbol)
    
    def _get_primary_timeframe(self, data: Dict[str, pd.DataFrame]) -> str:
        """Get primary timeframe for analysis."""
        for tf in ['1h', '30m', '4h', '15m', '1m']:
            if tf in data:
                return tf
        return None
    
    def _generate_signal(
        self,
        df: pd.DataFrame,
        current_price: float,
        symbol: str
    ) -> TradingSignal:
        """Generate trading signal based on mean reversion logic."""
        
        latest = df.iloc[-1]
        previous = df.iloc[-2] if len(df) > 1 else latest
        
        reasons = []
        confidence = 0
        signal_type = SignalType.HOLD
        
        rsi = latest['rsi']
        bb_upper = latest['bb_upper']
        bb_lower = latest['bb_lower']
        bb_middle = latest['bb_middle']
        price = latest['close']
        
        # Check for NaN values
        if any(pd.isna([rsi, bb_upper, bb_lower, price])):
            return TradingSignal(
                signal=SignalType.HOLD,
                confidence=0,
                reason="Indicator values not available"
            )
        
        # Calculate distance from Bollinger Bands
        bb_position = (price - bb_lower) / (bb_upper - bb_lower) * 100
        
        # BUY Logic (Oversold conditions)
        if rsi < self.rsi_buy_threshold:
            reasons.append(f"RSI oversold: {rsi:.1f}")
            confidence += 35
            
            if price < bb_lower:
                reasons.append("Price below lower BB")
                confidence += 25
            elif bb_position < 20:
                reasons.append("Price near lower BB")
                confidence += 15
            
            # Check if RSI is recovering
            if len(df) > 1 and previous['rsi'] < rsi:
                reasons.append("RSI recovering")
                confidence += 15
            
            # MACD confirmation
            if 'macd' in df.columns and 'macd_signal' in df.columns:
                if not pd.isna(latest['macd']) and not pd.isna(latest['macd_signal']):
                    if latest['macd'] > latest['macd_signal']:
                        reasons.append("MACD bullish")
                        confidence += 15
            
            # Check trend - avoid buying in strong downtrend
            if 'ema_20' in df.columns and 'ema_50' in df.columns:
                if not pd.isna(latest['ema_20']) and not pd.isna(latest['ema_50']):
                    if latest['ema_20'] < latest['ema_50']:
                        confidence -= 20
                        reasons.append("Warning: Downtrend")
            
            # Require 50% confidence for buy signal
            required_confidence = 50
            if confidence >= required_confidence:
                signal_type = SignalType.BUY
        
        # SELL Logic (Overbought conditions)
        elif rsi > self.rsi_sell_threshold:
            reasons.append(f"RSI overbought: {rsi:.1f}")
            confidence += 35
            
            if price > bb_upper:
                reasons.append("Price above upper BB")
                confidence += 25
            elif bb_position > 80:
                reasons.append("Price near upper BB")
                confidence += 15
            
            # Check if RSI is declining
            if len(df) > 1 and previous['rsi'] > rsi:
                reasons.append("RSI declining")
                confidence += 15
            
            # MACD confirmation
            if 'macd' in df.columns and 'macd_signal' in df.columns:
                if not pd.isna(latest['macd']) and not pd.isna(latest['macd_signal']):
                    if latest['macd'] < latest['macd_signal']:
                        reasons.append("MACD bearish")
                        confidence += 15
            
            # Check trend - avoid selling in strong uptrend
            if 'ema_20' in df.columns and 'ema_50' in df.columns:
                if not pd.isna(latest['ema_20']) and not pd.isna(latest['ema_50']):
                    if latest['ema_20'] > latest['ema_50']:
                        confidence -= 20
                        reasons.append("Warning: Uptrend")
            
            # Require 50% confidence for sell signal
            required_confidence = 50
            if confidence >= required_confidence:
                signal_type = SignalType.SELL
        
        # HOLD if no clear signal
        else:
            reasons.append(f"RSI neutral: {rsi:.1f}")
            reasons.append(f"BB position: {bb_position:.1f}%")
            confidence = 20
        
        # Calculate stop loss and take profit (convert to float to avoid numpy type issues)
        stop_loss = None
        take_profit = None
        
        if signal_type == SignalType.BUY:
            # Fixed percentages: 3% stop loss, 6% take profit
            stop_loss = float(current_price * 0.97)  # 3% below entry
            take_profit = float(current_price * 1.06)  # 6% above entry
        elif signal_type == SignalType.SELL:
            # For short positions (if implemented later)
            stop_loss = float(current_price * 1.03)  # 3% above entry
            take_profit = float(current_price * 0.94)  # 6% below entry
        
        return TradingSignal(
            signal=signal_type,
            confidence=min(confidence, 90),
            reason=" | ".join(reasons),
            entry_price=current_price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            metadata={
                'rsi': rsi,
                'bb_position': bb_position,
                'bb_upper': bb_upper,
                'bb_lower': bb_lower,
                'bb_middle': bb_middle
            }
        )
