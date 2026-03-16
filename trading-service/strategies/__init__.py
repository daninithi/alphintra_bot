"""
Strategies package initialization.
Provides easy imports for all available strategies.
"""
from strategies.base_strategy import BaseStrategy, TradingSignal, SignalType

__all__ = [
    'BaseStrategy',
    'TradingSignal',
    'SignalType',
]
