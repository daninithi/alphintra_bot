"""
Base strategy interface for creating trading strategies.
All strategies should inherit from this class.
"""
from abc import ABC, abstractmethod
from typing import Dict, Optional
from dataclasses import dataclass
import pandas as pd
from enum import Enum
import sys
from pathlib import Path

# Import Config if available (for fallback timeframes)
try:
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from config import Config
except ImportError:
    Config = None


class SignalType(Enum):
    """Trading signal types."""
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


@dataclass
class TradingSignal:
    """
    Trading signal with details.
    
    Attributes:
        signal: BUY, SELL, or HOLD
        confidence: Confidence level (0-100)
        reason: Explanation of the signal
        entry_price: Suggested entry price
        stop_loss: Suggested stop loss price (optional)
        take_profit: Suggested take profit price (optional)
        metadata: Additional strategy-specific data
    """
    signal: SignalType
    confidence: float
    reason: str
    entry_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    metadata: Optional[Dict] = None
    
    def __str__(self) -> str:
        return (
            f"Signal: {self.signal.value} | "
            f"Confidence: {self.confidence:.1f}% | "
            f"Reason: {self.reason}"
        )


class BaseStrategy(ABC):
    """
    Abstract base class for trading strategies.
    All custom strategies must implement the analyze() method.
    """
    
    def __init__(self, name: str = "BaseStrategy"):
        """
        Initialize the strategy.
        
        Args:
            name: Strategy name
        """
        self.name = name
    
    @abstractmethod
    def analyze(
        self,
        symbol: str,
        data: Dict[str, pd.DataFrame],
        current_price: float
    ) -> TradingSignal:
        """
        Analyze market data and generate a trading signal.
        
        Args:
            symbol: Trading pair (e.g., 'BTC/USDT')
            data: Dictionary mapping timeframes to DataFrames with indicators
                  Example: {'15m': DataFrame, '1h': DataFrame, '4h': DataFrame}
            current_price: Current market price
        
        Returns:
            TradingSignal object with signal type, confidence, and reason
        """
        pass
    
    def get_name(self) -> str:
        """Get strategy name."""
        return self.name
    
    def get_description(self) -> str:
        """
        Get strategy description.
        Override this method to provide details about your strategy.
        """
        return "No description provided."
    
    def get_required_timeframes(self) -> list:
        """
        Get the timeframes required by this strategy.
        Override this method or set self.timeframes/self.timeframe in __init__.
        """
        # Check for both self.timeframes (list) and self.timeframe (single)
        if hasattr(self, 'timeframes'):
            return self.timeframes
        elif hasattr(self, 'timeframe'):
            return [self.timeframe]
        else:
            # Fallback to all available timeframes if Config is available
            if Config:
                return Config.TIMEFRAMES
            else:
                return ['1h']  # Safe default
    
    def validate_data(self, data: Dict[str, pd.DataFrame]) -> bool:
        """
        Validate that required data is present.
        
        Args:
            data: Dictionary of timeframe -> DataFrame
        
        Returns:
            True if data is valid, False otherwise
        """
        if not data:
            return False
        
        for timeframe, df in data.items():
            if df is None or df.empty:
                return False
        
        return True
