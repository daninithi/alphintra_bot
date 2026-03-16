"""
Multi-Timeframe Trend Following Strategy.

Strategy Logic:
- Uses multiple timeframes for trend confirmation
- Higher timeframe (4h/1d) determines overall trend
- Medium timeframe (1h) confirms trend
- Lower timeframe (15m/30m) for entry timing

Buy Conditions:
1. Higher TF: Uptrend (price > EMA20 > EMA50)
2. Medium TF: RSI between 40-70 (not overbought)
3. Lower TF: MACD bullish crossover or RSI oversold recovery
4. Volume above average

Sell Conditions:
1. Higher TF: Downtrend (price < EMA20 < EMA50)
2. Medium TF: RSI between 30-60 (not oversold)
3. Lower TF: MACD bearish crossover or RSI overbought
4. Volume confirmation
"""
from strategies.base_strategy import BaseStrategy, TradingSignal, SignalType
from typing import Dict
import pandas as pd


class MultiTimeframeTrendStrategy(BaseStrategy):
    """
    Multi-timeframe trend following strategy with confirmation.
    """
    
    def __init__(self):
        super().__init__(name="Multi-Timeframe Trend")
    
    def get_description(self) -> str:
        return (
            "Multi-timeframe trend following strategy. "
            "Uses higher timeframe for trend, medium for confirmation, "
            "and lower timeframe for entry timing."
        )
    
    def analyze(
        self,
        symbol: str,
        data: Dict[str, pd.DataFrame],
        current_price: float
    ) -> TradingSignal:
        """Analyze market data using multi-timeframe approach."""
        
        if not self.validate_data(data):
            return TradingSignal(
                signal=SignalType.HOLD,
                confidence=0,
                reason="Insufficient data for analysis"
            )
        
        # Identify timeframes
        higher_tf = self._get_higher_timeframe(data)
        medium_tf = self._get_medium_timeframe(data)
        lower_tf = self._get_lower_timeframe(data)
        
        if not all([higher_tf, medium_tf, lower_tf]):
            return TradingSignal(
                signal=SignalType.HOLD,
                confidence=0,
                reason="Required timeframes not available"
            )
        
        # Analyze each timeframe
        higher_analysis = self._analyze_higher_tf(data[higher_tf])
        medium_analysis = self._analyze_medium_tf(data[medium_tf])
        lower_analysis = self._analyze_lower_tf(data[lower_tf])
        
        # Generate signal based on multi-timeframe analysis
        return self._generate_signal(
            symbol=symbol,
            current_price=current_price,
            higher=higher_analysis,
            medium=medium_analysis,
            lower=lower_analysis
        )
    
    def _get_higher_timeframe(self, data: Dict[str, pd.DataFrame]) -> str:
        """Get higher timeframe (trend determination)."""
        for tf in ['1d', '4h', '1h']:
            if tf in data:
                return tf
        return None
    
    def _get_medium_timeframe(self, data: Dict[str, pd.DataFrame]) -> str:
        """Get medium timeframe (confirmation)."""
        for tf in ['1h', '30m', '15m']:
            if tf in data:
                return tf
        return None
    
    def _get_lower_timeframe(self, data: Dict[str, pd.DataFrame]) -> str:
        """Get lower timeframe (entry timing)."""
        for tf in ['15m', '30m', '1h']:
            if tf in data:
                return tf
        return None
    
    def _analyze_higher_tf(self, df: pd.DataFrame) -> Dict:
        """Analyze higher timeframe for overall trend."""
        latest = df.iloc[-1]
        
        trend = "NEUTRAL"
        if 'ema_20' in df.columns and 'ema_50' in df.columns:
            price = latest['close']
            ema_20 = latest['ema_20']
            ema_50 = latest['ema_50']
            
            if not pd.isna(ema_20) and not pd.isna(ema_50):
                if price > ema_20 > ema_50:
                    trend = "UPTREND"
                elif price < ema_20 < ema_50:
                    trend = "DOWNTREND"
        
        return {
            'trend': trend,
            'price': latest['close']
        }
    
    def _analyze_medium_tf(self, df: pd.DataFrame) -> Dict:
        """Analyze medium timeframe for confirmation."""
        latest = df.iloc[-1]
        
        analysis = {
            'rsi': None,
            'rsi_signal': "NEUTRAL",
            'macd_signal': "NEUTRAL",
            'volume_high': False
        }
        
        # RSI analysis
        if 'rsi' in df.columns and not pd.isna(latest['rsi']):
            analysis['rsi'] = latest['rsi']
            if latest['rsi'] < 30:
                analysis['rsi_signal'] = "OVERSOLD"
            elif latest['rsi'] > 70:
                analysis['rsi_signal'] = "OVERBOUGHT"
        
        # MACD analysis
        if 'macd' in df.columns and 'macd_signal' in df.columns:
            if not pd.isna(latest['macd']) and not pd.isna(latest['macd_signal']):
                if latest['macd'] > latest['macd_signal']:
                    analysis['macd_signal'] = "BULLISH"
                else:
                    analysis['macd_signal'] = "BEARISH"
        
        # Volume analysis
        if 'volume_sma' in df.columns and not pd.isna(latest['volume_sma']):
            if latest['volume'] > latest['volume_sma'] * 1.2:
                analysis['volume_high'] = True
        
        return analysis
    
    def _analyze_lower_tf(self, df: pd.DataFrame) -> Dict:
        """Analyze lower timeframe for entry signals."""
        if len(df) < 2:
            return {'signal': "NEUTRAL"}
        
        current = df.iloc[-1]
        previous = df.iloc[-2]
        
        analysis = {
            'signal': "NEUTRAL",
            'rsi': None,
            'macd_cross': None
        }
        
        # RSI
        if 'rsi' in df.columns and not pd.isna(current['rsi']):
            analysis['rsi'] = current['rsi']
        
        # MACD crossover detection
        if all(col in df.columns for col in ['macd', 'macd_signal']):
            if not any(pd.isna([current['macd'], current['macd_signal'],
                               previous['macd'], previous['macd_signal']])):
                
                # Bullish crossover
                if (previous['macd'] <= previous['macd_signal'] and 
                    current['macd'] > current['macd_signal']):
                    analysis['macd_cross'] = "BULLISH"
                    analysis['signal'] = "BUY"
                
                # Bearish crossover
                elif (previous['macd'] >= previous['macd_signal'] and 
                      current['macd'] < current['macd_signal']):
                    analysis['macd_cross'] = "BEARISH"
                    analysis['signal'] = "SELL"
        
        return analysis
    
    def _generate_signal(
        self,
        symbol: str,
        current_price: float,
        higher: Dict,
        medium: Dict,
        lower: Dict
    ) -> TradingSignal:
        """Generate final trading signal based on all timeframes."""
        
        reasons = []
        confidence = 0
        signal_type = SignalType.HOLD
        
        # BUY Logic
        if higher['trend'] == "UPTREND":
            reasons.append("Higher TF: Uptrend")
            confidence += 30
            
            if medium['rsi_signal'] != "OVERBOUGHT" and medium['macd_signal'] == "BULLISH":
                reasons.append("Medium TF: Bullish momentum")
                confidence += 20
                
                if lower['signal'] == "BUY" or (lower['rsi'] and lower['rsi'] < 40):
                    reasons.append("Lower TF: Entry signal")
                    confidence += 25
                    
                    if medium['volume_high']:
                        reasons.append("Volume confirmation")
                        confidence += 15
                    
                    if confidence >= 60:
                        signal_type = SignalType.BUY
        
        # SELL Logic
        elif higher['trend'] == "DOWNTREND":
            reasons.append("Higher TF: Downtrend")
            confidence += 30
            
            if medium['rsi_signal'] != "OVERSOLD" and medium['macd_signal'] == "BEARISH":
                reasons.append("Medium TF: Bearish momentum")
                confidence += 20
                
                if lower['signal'] == "SELL" or (lower['rsi'] and lower['rsi'] > 60):
                    reasons.append("Lower TF: Exit signal")
                    confidence += 25
                    
                    if medium['volume_high']:
                        reasons.append("Volume confirmation")
                        confidence += 15
                    
                    if confidence >= 60:
                        signal_type = SignalType.SELL
        
        # Default to HOLD
        if signal_type == SignalType.HOLD:
            if not reasons:
                reasons.append("No clear trend or waiting for confirmation")
            confidence = max(10, confidence)
        
        # Calculate stop loss and take profit for BUY signals
        stop_loss = None
        take_profit = None
        
        if signal_type == SignalType.BUY:
            stop_loss = current_price * 0.97  # 3% stop loss
            take_profit = current_price * 1.06  # 6% take profit
        elif signal_type == SignalType.SELL:
            stop_loss = current_price * 1.03  # 3% stop loss
            take_profit = current_price * 0.94  # 6% take profit
        
        return TradingSignal(
            signal=signal_type,
            confidence=min(confidence, 95),  # Cap at 95%
            reason=" | ".join(reasons),
            entry_price=current_price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            metadata={
                'higher_tf': higher,
                'medium_tf': medium,
                'lower_tf': lower
            }
        )
