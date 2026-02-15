"""
Signal Processor and Order Executor.
Handles signal generation and order execution on Testnet.
"""
from typing import Dict, Optional, List
import pandas as pd
from datetime import datetime
from strategies.base_strategy import BaseStrategy, TradingSignal, SignalType
from exchange_manager import ExchangeManager
from logger import setup_logger
from config import Config


class SignalProcessor:
    """
    Processes trading signals from strategies and executes orders.
    """
    
    def __init__(self, exchange_manager: ExchangeManager, strategy: BaseStrategy, bot_execution_id: int = None, user_id: int = None):
        self.exchange = exchange_manager
        self.strategy = strategy
        self.logger = setup_logger("SignalProcessor", Config.LOG_LEVEL)
        self.bot_execution_id = bot_execution_id
        self.user_id = user_id
        
        # Minimum confidence threshold for executing trades (lowered to 50% for demo/testing)
        self.min_confidence = 50
        
        # Track positions (simple tracking for demo)
        self.positions: Dict[str, Dict] = {}
        
        # Initialize trading manager if we have execution context
        self.trading_manager = None
        if bot_execution_id and user_id:
            from trading_manager import TradingManager
            self.trading_manager = TradingManager(bot_execution_id, user_id)
            self.logger.info(f"✅ Trading manager initialized for bot execution {bot_execution_id}")
    
    def process_symbol(
        self,
        symbol: str,
        data: Dict[str, pd.DataFrame],
        current_price: float
    ) -> Optional[TradingSignal]:
        """
        Process a single symbol and generate signal.
        
        Args:
            symbol: Trading pair
            data: Multi-timeframe data with indicators
            current_price: Current market price
        
        Returns:
            TradingSignal or None
        """
        try:
            self.logger.info(f"\n{'='*60}")
            self.logger.info(f"📊 Analyzing {symbol} with {self.strategy.get_name()}")
            self.logger.info(f"{'='*60}")
            self.logger.info(f"💰 Current Market Price: ${current_price:,.2f}")
            self.logger.info(f"⏰ Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            
            # Generate signal
            signal = self.strategy.analyze(
                symbol=symbol,
                data=data,
                current_price=current_price
            )
            
            # Log signal
            self._log_signal(symbol, signal)
            
            return signal
            
        except Exception as e:
            self.logger.error(f"❌ Error processing {symbol}: {str(e)}")
            return None
    
    def execute_signal(
        self,
        symbol: str,
        signal: TradingSignal,
        order_size: Optional[float] = None
    ) -> bool:
        """
        Execute a trading signal (place order on Testnet).
        
        Args:
            symbol: Trading pair
            signal: TradingSignal to execute
            order_size: Order size (if None, uses default calculation)
        
        Returns:
            True if order executed successfully, False otherwise
        """
        if signal.signal == SignalType.HOLD:
            self.logger.info(f"⏸️  {symbol}: HOLD - No action taken")
            return False
        
        # Check confidence threshold
        if signal.confidence < self.min_confidence:
            self.logger.warning(
                f"⚠️  {symbol}: Signal confidence too low ({signal.confidence:.1f}% < {self.min_confidence}%) - "
                f"Not executing"
            )
            return False
        
        try:
            # Determine order side
            side = 'buy' if signal.signal == SignalType.BUY else 'sell'
            
            # Calculate order size if not provided
            if order_size is None:
                order_size = self._calculate_order_size(symbol, signal)
            
            if order_size <= 0:
                self.logger.warning(f"⚠️  {symbol}: Invalid order size, skipping")
                return False
            
            # Check if we should execute based on position
            if not self._should_execute(symbol, signal):
                return False
            
            # Place order on Testnet
            self.logger.info(
                f"🎯 Executing TESTNET {side.upper()} order for {symbol}"
            )
            self.logger.info(f"   Confidence: {signal.confidence:.1f}%")
            self.logger.info(f"   Amount: {order_size}")
            self.logger.info(f"   Reason: {signal.reason}")
            
            order = self.exchange.place_market_order(
                symbol=symbol,
                side=side,
                amount=order_size
            )
            
            if order:
                # Track order in database if trading manager is available
                if self.trading_manager:
                    order_id = self.trading_manager.create_order(
                        symbol=symbol,
                        side=side.upper(),
                        order_type="MARKET",
                        quantity=order_size,
                        price=signal.entry_price
                    )
                    # Immediately fill the order (for simulation/market orders)
                    if order_id:
                        self.trading_manager.fill_order(
                            order_id,
                            filled_price=order.get('price', signal.entry_price),
                            stop_loss=signal.stop_loss if side == 'buy' else None,
                            take_profit=signal.take_profit if side == 'buy' else None
                        )
                        # Update last run timestamp
                        self.trading_manager.update_bot_last_run()
                
                # Update position tracking
                self._update_position(symbol, signal, order)
                
                # Log success with details
                self.logger.info(f"\n{'='*70}")
                self.logger.info(f"✅ TESTNET ORDER EXECUTED SUCCESSFULLY!")
                self.logger.info(f"{'='*70}")
                self.logger.info(f"   Order ID:     {order.get('id')}")
                self.logger.info(f"   Symbol:       {symbol}")
                self.logger.info(f"   Side:         {side.upper()}")
                self.logger.info(f"   Amount:       {order.get('filled', order_size)}")
                self.logger.info(f"   Price:        ${order.get('price', signal.entry_price):,.2f}")
                self.logger.info(f"   Status:       {order.get('status', 'FILLED')}")
                self.logger.info(f"{'='*70}\n")
                
                return True
            else:
                return False
                
        except Exception as e:
            self.logger.error(f"❌ Error executing signal for {symbol}: {str(e)}")
            return False
    
    def _calculate_order_size(self, symbol: str, signal: TradingSignal) -> float:
        """
        Calculate order size based on balance and risk management.
        
        Args:
            symbol: Trading pair
            signal: Trading signal
        
        Returns:
            Order size
        """
        try:
            # Get USDT balance
            balance = self.exchange.get_testnet_balance('USDT')
            
            # Risk management: use 5-10% of balance per trade based on confidence
            risk_percentage = 0.05 + (signal.confidence / 100 * 0.05)  # 5-10%
            trade_amount = balance * risk_percentage
            
            # Calculate quantity based on entry price
            if signal.entry_price and signal.entry_price > 0:
                quantity = trade_amount / signal.entry_price
            else:
                self.logger.warning("⚠️  No entry price available, using 0")
                quantity = 0
            
            # Round to appropriate precision (simplified)
            if quantity < 0.001:
                quantity = round(quantity, 6)
            elif quantity < 1:
                quantity = round(quantity, 4)
            else:
                quantity = round(quantity, 2)
            
            self.logger.info(
                f"💰 Order Size: {quantity} (${trade_amount:.2f} USDT, "
                f"{risk_percentage*100:.1f}% of balance)"
            )
            
            return quantity
            
        except Exception as e:
            self.logger.error(f"❌ Error calculating order size: {str(e)}")
            return 0
    
    def _should_execute(self, symbol: str, signal: TradingSignal) -> bool:
        """
        Check if order should be executed based on current positions.
        
        Args:
            symbol: Trading pair
            signal: Trading signal
        
        Returns:
            True if should execute, False otherwise
        """
        current_position = self.positions.get(symbol, {})
        
        # BUY signal
        if signal.signal == SignalType.BUY:
            if current_position.get('side') == 'buy':
                self.logger.info(f"⏭️  {symbol}: Already in BUY position, skipping")
                return False
        
        # SELL signal
        elif signal.signal == SignalType.SELL:
            if not current_position:
                self.logger.info(f"⏭️  {symbol}: No open position to sell, skipping")
                return False
            elif current_position.get('side') == 'sell':
                self.logger.info(f"⏭️  {symbol}: Already in SELL position, skipping")
                return False
        
        return True
    
    def _update_position(
        self,
        symbol: str,
        signal: TradingSignal,
        order: Dict
    ):
        """
        Update position tracking after order execution.
        
        Args:
            symbol: Trading pair
            signal: Trading signal
            order: Order result from exchange
        """
        self.positions[symbol] = {
            'side': 'buy' if signal.signal == SignalType.BUY else 'sell',
            'entry_price': signal.entry_price,
            'entry_time': datetime.now(),
            'order_id': order.get('id'),
            'amount': order.get('amount'),
            'stop_loss': signal.stop_loss,
            'take_profit': signal.take_profit,
            'confidence': signal.confidence
        }
        
        self.logger.info(f"📝 Position updated for {symbol}")
    
    def _log_signal(self, symbol: str, signal: TradingSignal):
        """Log signal details in a formatted way."""
        
        # Determine emoji based on signal
        if signal.signal == SignalType.BUY:
            emoji = "🟢 BUY"
            color = "green"
        elif signal.signal == SignalType.SELL:
            emoji = "🔴 SELL"
            color = "red"
        else:
            emoji = "⚪ HOLD"
            color = "yellow"
        
        self.logger.info(f"\n{'='*70}")
        self.logger.info(f"🔔 SIGNAL GENERATED FOR {symbol}")
        self.logger.info(f"{'='*70}")
        self.logger.info(f"   Signal Type:  {emoji}")
        self.logger.info(f"   Confidence:   {signal.confidence:.1f}% {'█' * int(signal.confidence/10)}")
        self.logger.info(f"   Reason:       {signal.reason}")
        
        if signal.entry_price:
            self.logger.info(f"   Entry Price:  ${signal.entry_price:,.2f}")
        
        if signal.stop_loss:
            loss_pct = ((signal.stop_loss - signal.entry_price) / signal.entry_price * 100)
            self.logger.info(f"   Stop Loss:    ${signal.stop_loss:,.2f} ({loss_pct:+.2f}%)")
        
        if signal.take_profit:
            profit_pct = ((signal.take_profit - signal.entry_price) / signal.entry_price * 100)
            self.logger.info(f"   Take Profit:  ${signal.take_profit:,.2f} ({profit_pct:+.2f}%)")
        
        self.logger.info(f"{'='*70}\n")
    
    def get_positions_summary(self) -> str:
        """
        Get summary of current positions.
        
        Returns:
            Formatted string with positions
        """
        if not self.positions:
            return "No open positions"
        
        summary = "\n" + "="*60 + "\n"
        summary += "📊 Current Positions\n"
        summary += "="*60 + "\n"
        
        for symbol, pos in self.positions.items():
            summary += f"\n{symbol}:\n"
            summary += f"  Side: {pos['side'].upper()}\n"
            summary += f"  Entry: ${pos['entry_price']:,.2f}\n"
            summary += f"  Amount: {pos['amount']}\n"
            summary += f"  Time: {pos['entry_time'].strftime('%Y-%m-%d %H:%M:%S')}\n"
            
            if pos.get('stop_loss'):
                summary += f"  Stop Loss: ${pos['stop_loss']:,.2f}\n"
            if pos.get('take_profit'):
                summary += f"  Take Profit: ${pos['take_profit']:,.2f}\n"
        
        summary += "="*60 + "\n"
        
        return summary
