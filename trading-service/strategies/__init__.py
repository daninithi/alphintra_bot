"""
Strategies package initialization.
Provides easy imports for all available strategies.
"""
from strategies.base_strategy import BaseStrategy, TradingSignal, SignalType
from strategies.multi_timeframe_trend import MultiTimeframeTrendStrategy
from strategies.rsi_mean_reversion import RSIMeanReversionStrategy

__all__ = [
    'BaseStrategy',
    'TradingSignal',
    'SignalType',
    'MultiTimeframeTrendStrategy',
    'RSIMeanReversionStrategy',
]
