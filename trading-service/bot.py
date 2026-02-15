"""
Main Trading Bot orchestrator.
Coordinates data fetching, analysis, and order execution.
"""
import time
import signal
import sys
from datetime import datetime
from typing import Optional
from exchange_manager import ExchangeManager
from data_fetcher import DataFetcher
from indicators import TechnicalIndicators
from signal_processor import SignalProcessor
from strategies.base_strategy import BaseStrategy
from config import Config
from logger import setup_logger


class TradingBot:
    """
    Main trading bot that orchestrates all components.
    Runs continuously and executes trading logic at intervals.
    """
    
    def __init__(self, strategy: BaseStrategy, setup_signals: bool = True, bot_execution_id: int = None, user_id: int = None, trading_pairs: list = None):
        """
        Initialize the trading bot.
        
        Args:
            strategy: Trading strategy to use
            setup_signals: Whether to setup signal handlers (only works in main thread)
            bot_execution_id: Database ID of the bot execution
            user_id: User ID who owns this bot
            trading_pairs: Optional list of trading pairs to use (defaults to Config.TRADING_PAIRS)
        """
        self.logger = setup_logger("TradingBot", Config.LOG_LEVEL)
        self.strategy = strategy
        self.bot_execution_id = bot_execution_id
        self.user_id = user_id
        self.trading_pairs = trading_pairs if trading_pairs else Config.TRADING_PAIRS
        
        # Components
        self.exchange_manager: Optional[ExchangeManager] = None
        self.data_fetcher: Optional[DataFetcher] = None
        self.indicators = TechnicalIndicators()
        self.signal_processor: Optional[SignalProcessor] = None
        
        # State
        self.running = False
        self.execution_count = 0
        
        # Setup signal handlers for graceful shutdown (only in main thread)
        if setup_signals:
            try:
                signal.signal(signal.SIGINT, self._signal_handler)
                signal.signal(signal.SIGTERM, self._signal_handler)
            except ValueError:
                # Signal only works in main thread, skip if running in background
                self.logger.info("Signal handlers not set (running in background thread)")
    
    def initialize(self) -> bool:
        """
        Initialize all bot components.
        
        Returns:
            True if initialization successful, False otherwise
        """
        try:
            self.logger.info("\n" + "="*60)
            self.logger.info(f"🤖 Initializing {Config.BOT_NAME}")
            self.logger.info("="*60)
            
            # Display configuration
            Config.display()
            
            # Validate configuration
            if not Config.validate():
                self.logger.error("Configuration validation failed")
                return False
            
            # Initialize exchange manager
            self.logger.info("🔄 Initializing exchange connections...")
            self.exchange_manager = ExchangeManager()
            if not self.exchange_manager.initialize():
                return False
            
            # Initialize data fetcher
            self.data_fetcher = DataFetcher(self.exchange_manager)
            
            # Initialize signal processor
            self.signal_processor = SignalProcessor(
                self.exchange_manager,
                self.strategy,
                bot_execution_id=self.bot_execution_id,
                user_id=self.user_id
            )
            
            self.logger.info(f"Strategy loaded: {self.strategy.get_name()}")
            self.logger.info(f"   Description: {self.strategy.get_description()}")
            
            self.logger.info("\nInitialization complete!")
            
            return True
            
        except Exception as e:
            self.logger.error(f"Initialization failed: {str(e)}")
            return False
    
    def start(self):
        """
        Start the trading bot.
        Runs continuously until stopped.
        """
        if not self.exchange_manager or not self.data_fetcher or not self.signal_processor:
            self.logger.error("Bot not initialized. Call initialize() first.")
            return
        
        self.running = True
        self.logger.info("\n" + "="*60)
        self.logger.info("Trading Bot Started!")
        self.logger.info(f"Execution interval: {Config.EXECUTION_INTERVAL_MINUTES} minutes")
        self.logger.info("="*60 + "\n")
        
        # Run first execution immediately
        self._execute_trading_cycle()
        
        # Main loop
        while self.running:
            try:
                # Wait for next execution
                self.logger.info(
                    f"\nNext execution in {Config.EXECUTION_INTERVAL_MINUTES} minutes..."
                )
                self._sleep_with_interrupt(Config.EXECUTION_INTERVAL_MINUTES * 60)
                
                if self.running:
                    self._execute_trading_cycle()
                    
            except Exception as e:
                self.logger.error(f"Error in main loop: {str(e)}")
                self.logger.info("Waiting 60 seconds before retry...")
                self._sleep_with_interrupt(60)
    
    def _execute_trading_cycle(self):
        """Execute one complete trading cycle."""
        try:
            self.execution_count += 1
            
            self.logger.info("\n" + "="*80)
            self.logger.info(
                f"Execution #{self.execution_count} - "
                f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            )
            self.logger.info("="*80)
            
            # Step 1: Monitor existing positions for stop loss/take profit
            self.logger.info("\nStep 1: Monitoring open positions...")
            positions_closed = self._monitor_positions()
            if positions_closed > 0:
                self.logger.info(f"Closed {positions_closed} position(s) via stop loss/take profit")
            
            # Step 2: Fetch all market data
            self.logger.info("\nStep 2: Fetching market data...")
            # Get timeframes required by this strategy
            required_timeframes = self.strategy.get_required_timeframes()
            all_data = self.data_fetcher.fetch_all_symbols_data(
                symbols=self.trading_pairs,
                timeframes=required_timeframes,
                limit=Config.CANDLES_LIMIT
            )
            
            if not all_data:
                self.logger.error("No data fetched, skipping cycle")
                return
            
            # Log data summary
            self.logger.info(self.data_fetcher.get_data_summary(all_data))
            
            # Step 3: Add technical indicators
            self.logger.info("\nStep 3: Calculating technical indicators...")
            for symbol in all_data:
                for timeframe in all_data[symbol]:
                    df = all_data[symbol][timeframe]
                    all_data[symbol][timeframe] = self.indicators.add_all_indicators(df)
            
            self.logger.info("Indicators calculated for all symbols and timeframes")
            
            # Step 4: Analyze and generate signals
            self.logger.info("\nStep 4: Analyzing symbols and generating signals...")
            
            signals_generated = 0
            orders_executed = 0
            
            # Results table
            results = []
            
            for symbol in Config.TRADING_PAIRS:
                if symbol not in all_data:
                    continue
                
                # Get current price
                current_price = self.data_fetcher.get_latest_price(symbol)
                if not current_price:
                    self.logger.warning(f"Could not get price for {symbol}, skipping")
                    continue
                
                self.logger.info(f"\n{'─'*70}")
                self.logger.info(f"Analyzing {symbol} | Current Price: ${current_price:,.2f}")
                self.logger.info(f"{'─'*70}")
                
                # Process symbol
                signal = self.signal_processor.process_symbol(
                    symbol=symbol,
                    data=all_data[symbol],
                    current_price=current_price
                )
                
                if signal:
                    signals_generated += 1
                    
                    # Store result
                    results.append({
                        'symbol': symbol,
                        'price': current_price,
                        'signal': signal.signal.value,
                        'confidence': signal.confidence,
                        'reason': signal.reason
                    })
                    
                    # Execute signal if not HOLD
                    if signal.signal.value != "HOLD":
                        success = self.signal_processor.execute_signal(
                            symbol=symbol,
                            signal=signal
                        )
                        if success:
                            orders_executed += 1
            
            # Display results summary table
            self._display_results_table(results)
            
            # Step 5: Summary
            self.logger.info("\n" + "="*80)
            self.logger.info("Cycle Summary:")
            self.logger.info(f"   Symbols analyzed: {len(Config.TRADING_PAIRS)}")
            self.logger.info(f"   Signals generated: {signals_generated}")
            self.logger.info(f"   Orders executed: {orders_executed}")
            self.logger.info("="*80)
            
            # Show positions
            self.logger.info(self.signal_processor.get_positions_summary())
            
            # Show testnet balance
            usdt_balance = self.exchange_manager.get_testnet_balance('USDT')
            self.logger.info(f"Testnet USDT Balance: ${usdt_balance:,.2f}")
            
        except Exception as e:
            self.logger.error(f"Error in trading cycle: {str(e)}")
    
    def _monitor_positions(self) -> int:
        """
        Monitor open positions and execute stop loss/take profit orders.
        
        Returns:
            Number of positions closed
        """
        from bot_models import Position, get_db
        
        positions_closed = 0
        db = get_db()
        
        try:
            # Get all open positions from database
            db_positions = db.query(Position).filter(
                Position.bot_execution_id == self.bot_execution_id
            ).all()
            
            if not db_positions:
                self.logger.info("No open positions to monitor")
                return 0
            
            self.logger.info(f"Monitoring {len(db_positions)} open position(s)...")
            
            for position in db_positions:
                symbol = position.symbol
                
                try:
                    # Get current price using data_fetcher
                    current_price = self.data_fetcher.get_latest_price(symbol)
                    if not current_price:
                        self.logger.warning(f"Could not get current price for {symbol}")
                        continue
                    
                    entry_price = position.entry_price
                    stop_loss = position.stop_loss
                    take_profit = position.take_profit
                    quantity = position.quantity
                    
                    # Calculate current P&L
                    current_pnl = (current_price - entry_price) * quantity
                    current_pnl_pct = ((current_price - entry_price) / entry_price) * 100
                    
                    # Check stop loss
                    if stop_loss and current_price <= stop_loss:
                        self.logger.warning(
                            f"\n🛑 STOP LOSS TRIGGERED for {symbol}!\n"
                            f"   Entry: ${entry_price:,.2f} | Current: ${current_price:,.2f}\n"
                            f"   Stop Loss: ${stop_loss:,.2f}\n"
                            f"   Loss: ${current_pnl:,.2f} ({current_pnl_pct:.2f}%)"
                        )
                        
                        # Execute market sell order
                        success = self.signal_processor._execute_sell_order(
                            symbol=symbol,
                            current_price=current_price,
                            reason="Stop Loss Triggered"
                        )
                        
                        if success:
                            positions_closed += 1
                            self.logger.info(f"✅ Position closed via stop loss")
                        
                    # Check take profit
                    elif take_profit and current_price >= take_profit:
                        self.logger.info(
                            f"\n🎯 TAKE PROFIT TRIGGERED for {symbol}!\n"
                            f"   Entry: ${entry_price:,.2f} | Current: ${current_price:,.2f}\n"
                            f"   Take Profit: ${take_profit:,.2f}\n"
                            f"   Profit: ${current_pnl:,.2f} ({current_pnl_pct:.2f}%)"
                        )
                        
                        # Execute market sell order
                        success = self.signal_processor._execute_sell_order(
                            symbol=symbol,
                            current_price=current_price,
                            reason="Take Profit Triggered"
                        )
                        
                        if success:
                            positions_closed += 1
                            self.logger.info(f"✅ Position closed via take profit")
                    
                    else:
                        # Update current_price in database for live tracking
                        position.current_price = current_price
                        position.unrealized_pnl = current_pnl
                        db.commit()
                        
                        # Log current position status
                        self.logger.info(
                            f"📊 {symbol}: Entry ${entry_price:,.2f} | "
                            f"Current ${current_price:,.2f} | "
                            f"P&L: ${current_pnl:,.2f} ({current_pnl_pct:+.2f}%)"
                        )
                        
                except Exception as e:
                    self.logger.error(f"Error monitoring position {symbol}: {str(e)}")
                    continue
            
            return positions_closed
        
        finally:
            db.close()
    
    def stop(self):
        """Stop the trading bot gracefully."""
        self.logger.info("\nStopping trading bot...")
        self.running = False
        
        if self.exchange_manager:
            self.exchange_manager.close()
        
        self.logger.info("Bot stopped successfully")
        self.logger.info(f"Total executions: {self.execution_count}")
    
    def _signal_handler(self, signum, frame):
        """Handle interrupt signals for graceful shutdown."""
        self.logger.info(f"\nReceived signal {signum}, shutting down...")
        self.stop()
        sys.exit(0)
    
    def _sleep_with_interrupt(self, seconds: int):
        """
        Sleep with ability to be interrupted.
        
        Args:
            seconds: Number of seconds to sleep
        """
        end_time = time.time() + seconds
        while time.time() < end_time and self.running:
            time.sleep(1)
    
    def _display_results_table(self, results: list):
        """
        Display analysis results in a formatted table.
        
        Args:
            results: List of result dictionaries
        """
        if not results:
            return
        
        self.logger.info("\n" + "="*90)
        self.logger.info("ANALYSIS RESULTS SUMMARY")
        self.logger.info("="*90)
        
        # Header
        header = f"{'Symbol':<12} {'Price':<15} {'Signal':<8} {'Confidence':<12} {'Reason':<30}"
        self.logger.info(header)
        self.logger.info("-"*90)
        
        # Rows
        for result in results:
            signal_emoji = {
                'BUY': '🟢',
                'SELL': '🔴',
                'HOLD': '⚪'
            }.get(result['signal'], '⚪')
            
            price_str = f"${result['price']:,.2f}"
            confidence_bar = "█" * int(result['confidence']/10) + "░" * (10 - int(result['confidence']/10))
            confidence_str = f"{result['confidence']:.0f}% {confidence_bar}"
            
            # Truncate reason if too long
            reason = result['reason'][:40] + "..." if len(result['reason']) > 40 else result['reason']
            
            row = f"{result['symbol']:<12} {price_str:<15} {signal_emoji} {result['signal']:<5} {confidence_str:<12} {reason:<30}"
            self.logger.info(row)
        
        self.logger.info("="*90 + "\n")


def main():
    """Main entry point for the trading bot."""
    
    # Import available strategies
    from strategies import (
        MultiTimeframeTrendStrategy,
        RSIMeanReversionStrategy
    )
    
    # Display available strategies
    print("\n" + "="*60)
    print("Available Trading Strategies:")
    print("="*60)
    print("1. Multi-Timeframe Trend Following")
    print("   - Uses multiple timeframes for trend confirmation")
    print("   - Best for trending markets")
    print("\n2. RSI Mean Reversion")
    print("   - Buys oversold, sells overbought")
    print("   - Best for ranging markets")
    print("="*60)
    
    # Strategy selection
    try:
        # Force RSI Mean Reversion in testing mode
        if Config.TESTING_MODE:
            print("\n⚠️  TESTING MODE: Using RSI Mean Reversion strategy")
            strategy = RSIMeanReversionStrategy()
        else:
            choice = input("\nSelect strategy (1 or 2): ").strip()
            
            if choice == "1":
                strategy = MultiTimeframeTrendStrategy()
            elif choice == "2":
                strategy = RSIMeanReversionStrategy()
            else:
                print("Invalid choice, using Multi-Timeframe Trend strategy")
                strategy = MultiTimeframeTrendStrategy()
    except KeyboardInterrupt:
        print("\n\nCancelled by user")
        sys.exit(0)
    
    # Create and initialize bot
    bot = TradingBot(strategy)
    
    if not bot.initialize():
        print("\nFailed to initialize bot")
        sys.exit(1)
    
    # Start bot
    try:
        bot.start()
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        bot.stop()
    except Exception as e:
        print(f"\nFatal error: {str(e)}")
        bot.stop()
        sys.exit(1)


if __name__ == "__main__":
    main()
