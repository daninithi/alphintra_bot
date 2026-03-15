import pandas as pd
from typing import Dict
from strategies.base_strategy import BaseStrategy, TradingSignal, SignalType


class EMACrossoverStrategy(BaseStrategy):
    """
    EMA crossover strategy.
    BUY when fast EMA crosses above slow EMA.
    SELL when fast EMA crosses below slow EMA.
    """

    def __init__(self):
        super().__init__("EMA Crossover Strategy")
        self.timeframes = ['1h']

    def get_description(self):
        return "Generates signals using EMA crossover."

    def analyze(self, symbol: str, data: Dict[str, pd.DataFrame], current_price: float) -> TradingSignal:

        if not self.validate_data(data):
            return TradingSignal(
                signal=SignalType.HOLD,
                confidence=0,
                reason="Invalid market data"
            )

        df = data['1h'].copy()

        df['ema_fast'] = df['close'].ewm(span=9).mean()
        df['ema_slow'] = df['close'].ewm(span=21).mean()

        last = df.iloc[-1]
        prev = df.iloc[-2]

        # BUY SIGNAL
        if prev['ema_fast'] < prev['ema_slow'] and last['ema_fast'] > last['ema_slow']:
            return TradingSignal(
                signal=SignalType.BUY,
                confidence=75,
                reason="EMA bullish crossover",
                entry_price=current_price,
                stop_loss=current_price * 0.98,
                take_profit=current_price * 1.04
            )

        # SELL SIGNAL
        if prev['ema_fast'] > prev['ema_slow'] and last['ema_fast'] < last['ema_slow']:
            return TradingSignal(
                signal=SignalType.SELL,
                confidence=75,
                reason="EMA bearish crossover",
                entry_price=current_price,
                stop_loss=current_price * 1.02,
                take_profit=current_price * 0.96
            )

        return TradingSignal(
            signal=SignalType.HOLD,
            confidence=40,
            reason="No EMA crossover"
        )