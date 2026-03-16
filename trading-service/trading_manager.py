"""
Trading manager for tracking orders, positions, and trade history.
"""
from datetime import datetime, timezone
from bot_models import Order, Position, TradeHistory, BotExecution, get_db
import logging
import uuid
import os
import psycopg2
import json
import ccxt

logger = logging.getLogger(__name__)

class TradingManager:
    """Manage trading operations and database tracking."""
    
    def __init__(self, bot_execution_id: int, user_id: int, environment: str = "testnet"):
        self.bot_execution_id = bot_execution_id
        self.user_id = user_id
        self.environment = environment
    
    def _fetch_and_update_balance_from_binance(self) -> bool:
        """Fetch latest balance from Binance and update wallet service database."""
        try:
            # Get wallet connection details from database
            wallet_db_url = os.getenv("WALLET_DATABASE_URL", "postgresql://myapp:alphintra123@localhost:5432/alphintra_wallet")
            conn = psycopg2.connect(wallet_db_url)
            cur = conn.cursor()
            
            cur.execute("""
                SELECT encrypted_api_key, encrypted_secret_key, exchange_environment
                FROM wallet_connections
                WHERE user_id = %s 
                  AND exchange_name = 'binance'
                  AND is_active = true
                ORDER BY created_at DESC
                LIMIT 1
            """, (self.user_id,))
            
            result = cur.fetchone()
            if not result:
                logger.warning("No wallet connection found to fetch balance")
                cur.close()
                conn.close()
                return False
            
            api_key, secret_key, env = result
            
            # Initialize CCXT exchange with sandbox mode set at construction time
            is_sandbox = (env or "testnet").lower() == "testnet"
            exchange_options = {
                'apiKey': api_key,
                'secret': secret_key,
                'enableRateLimit': True,
            }
            if is_sandbox:
                exchange_options['options'] = {'defaultType': 'spot'}
            exchange = ccxt.binance(exchange_options)
            exchange.set_sandbox_mode(is_sandbox)
            
            # Fetch balance from Binance
            balance_data = exchange.fetch_balance()
            totals = balance_data.get('total', {})
            
            # Define relevant coins to track
            RELEVANT_COINS = {
                'BTC', 'ETH', 'SOL', 'DOGE', 'XRP',
                'USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'FDUSD', 'USDE', 'USDP'
            }
            
            # Build balance dictionary - only relevant coins
            balance_dict = {}
            for asset, total_amount in totals.items():
                if asset not in RELEVANT_COINS:
                    continue
                    
                try:
                    total_f = float(total_amount or 0)
                    # Skip invalid testnet values
                    if total_f > 0 and total_f < 18000:
                        balance_dict[asset] = total_f
                except Exception:
                    continue
            
            # Update balance in database
            cur.execute("""
                UPDATE wallet_connections
                SET balance = %s,
                    last_balance_update = NOW()
                WHERE user_id = %s 
                  AND exchange_name = 'binance'
                  AND is_active = true
            """, (json.dumps(balance_dict), self.user_id))
            
            conn.commit()
            cur.close()
            conn.close()
            
            logger.info(f"💰 Updated balance from Binance: {balance_dict}")
            return True
        except Exception as e:
            logger.error(f"Failed to fetch and update balance from Binance: {str(e)}")
            return False
    
    def _update_wallet_balance(self, currency: str, amount_change: float) -> bool:
        """Update balance in wallet service database."""
        try:
            wallet_db_url = os.getenv("WALLET_DATABASE_URL", "postgresql://myapp:alphintra123@localhost:5432/alphintra_wallet")
            conn = psycopg2.connect(wallet_db_url)
            cur = conn.cursor()
            
            # Get current balance
            cur.execute("""
                SELECT balance
                FROM wallet_connections
                WHERE user_id = %s 
                  AND exchange_name = 'binance'
                  AND is_active = true
                ORDER BY created_at DESC
                LIMIT 1
                FOR UPDATE
            """, (self.user_id,))
            
            result = cur.fetchone()
            if not result:
                cur.close()
                conn.close()
                return False
            
            balance_data = result[0] if isinstance(result[0], dict) else json.loads(result[0])
            
            # Update balance
            current_balance = float(balance_data.get(currency, 0))
            new_balance = current_balance + amount_change
            balance_data[currency] = new_balance
            
            # Save updated balance
            cur.execute("""
                UPDATE wallet_connections
                SET balance = %s,
                    last_balance_update = NOW()
                WHERE user_id = %s 
                  AND exchange_name = 'binance'
                  AND is_active = true
            """, (json.dumps(balance_data), self.user_id))
            
            conn.commit()
            cur.close()
            conn.close()
            
            logger.info(f"💰 Updated {currency} balance: {current_balance:,.4f} -> {new_balance:,.4f} (change: {amount_change:+,.4f})")
            return True
        except Exception as e:
            logger.error(f"Failed to update wallet balance: {str(e)}")
            return False
    
    def create_order(self, symbol: str, side: str, order_type: str, quantity: float, price: float = None) -> str:
        """
        Create a new order record.
        
        Args:
            symbol: Trading pair (e.g., "BTC/USDT")
            side: "BUY" or "SELL"
            order_type: "MARKET", "LIMIT", or "STOP_LOSS"
            quantity: Amount to trade
            price: Order price (for limit orders)
        
        Returns:
            order_id: Generated order ID
        """
        db = get_db()
        try:
            order_id = f"ORD-{uuid.uuid4().hex[:12].upper()}"
            
            order = Order(
                bot_execution_id=self.bot_execution_id,
                user_id=self.user_id,
                order_id=order_id,
                symbol=symbol,
                side=side,
                order_type=order_type,
                price=price,
                quantity=quantity,
                status="PENDING"
            )
            
            db.add(order)
            db.commit()
            db.refresh(order)
            
            logger.info(f"📝 Created order: {order_id} - {side} {quantity} {symbol} @ {price if price else 'MARKET'}")
            return order_id
        except Exception as e:
            logger.error(f"Failed to create order: {str(e)}")
            db.rollback()
            return None
        finally:
            db.close()
    
    def partial_fill(self, order_id: str, filled_quantity: float, filled_price: float) -> bool:
        """
        Handle partial order fill - for production with real exchanges.
        Updates filled_quantity and average_price incrementally.
        
        Args:
            order_id: Order ID being filled
            filled_quantity: Amount filled in this event
            filled_price: Price at which this portion was filled
            
        Returns:
            True if order is now completely filled
        """
        db = get_db()
        try:
            order = db.query(Order).filter(Order.order_id == order_id).first()
            if not order:
                logger.error(f"Order not found: {order_id}")
                return False
            
            # Calculate new average price (weighted average)
            previous_filled = float(order.filled_quantity or 0)
            previous_avg_price = float(order.average_price or order.price)
            
            new_filled = previous_filled + filled_quantity
            
            # Weighted average: (old_qty * old_price + new_qty * new_price) / total_qty
            new_avg_price = (
                (previous_filled * previous_avg_price) + (filled_quantity * filled_price)
            ) / new_filled
            
            # Update order
            order.filled_quantity = new_filled
            order.average_price = new_avg_price
            
            # Check if completely filled
            is_complete = new_filled >= order.quantity
            
            if is_complete:
                order.status = "FILLED"
                order.filled_at = datetime.now(timezone.utc)
                logger.info(
                    f"✅ Order {order_id} FILLED: {new_filled}/{order.quantity} {order.symbol} "
                    f"@ avg ${new_avg_price:.2f}"
                )
            else:
                order.status = "PARTIALLY_FILLED"
                logger.info(
                    f"⚡ Order {order_id} PARTIALLY FILLED: {new_filled}/{order.quantity} {order.symbol} "
                    f"@ ${filled_price:.2f} (avg ${new_avg_price:.2f})"
                )
            
            db.commit()
            return is_complete
            
        except Exception as e:
            logger.error(f"Failed to process partial fill: {str(e)}")
            db.rollback()
            return False
        finally:
            db.close()
    
    def fill_order(self, order_id: str, filled_price: float = None, stop_loss: float = None, take_profit: float = None):
        """
        Mark an order as filled and create/update position.
        Supports both full fills (simulation) and partial fills (production).
        
        Args:
            order_id: Order ID to fill
            filled_price: Actual fill price (if different from order price)
            stop_loss: Stop loss price level (for BUY orders)
            take_profit: Take profit price level (for BUY orders)
        """
        db = get_db()
        try:
            order = db.query(Order).filter(Order.order_id == order_id).first()
            if not order:
                logger.error(f"Order not found: {order_id}")
                return
            
            # Update order status (simulation assumes full fill)
            order.status = "FILLED"
            order.filled_quantity = order.quantity
            order.filled_at = datetime.now(timezone.utc)
            if filled_price:
                order.price = filled_price
                order.average_price = filled_price
            else:
                order.average_price = order.price
            
            actual_price = order.average_price
            
            # Extract base and quote currencies from symbol (e.g., BTC/USDT -> BTC, USDT)
            base_currency = order.symbol.split('/')[0] if '/' in order.symbol else order.symbol.replace('USDT', '')
            quote_currency = order.symbol.split('/')[1] if '/' in order.symbol else 'USDT'
            
            # Handle position logic
            if order.side == "BUY":
                # Deduct USDT, add crypto
                usdt_spent = actual_price * order.quantity
                self._update_wallet_balance(quote_currency, -usdt_spent)  # Deduct USDT
                self._update_wallet_balance(base_currency, order.quantity)  # Add crypto
                
                # Open or add to position
                # Note: stop_loss and take_profit should be passed from signal context
                self._open_position(db, order.symbol, actual_price, order.quantity, stop_loss, take_profit)
            elif order.side == "SELL":
                # Add USDT, deduct crypto
                usdt_received = actual_price * order.quantity
                self._update_wallet_balance(quote_currency, usdt_received)  # Add USDT
                self._update_wallet_balance(base_currency, -order.quantity)  # Deduct crypto
                
                # Close or reduce position
                self._close_position(db, order.symbol, actual_price, order.quantity)
            
            # After successful trade, fetch and update balance from Binance
            logger.info("🔄 Fetching latest balance from Binance after trade...")
            self._fetch_and_update_balance_from_binance()
            
            db.commit()
            logger.info(f"✅ Filled order: {order_id} - {order.side} {order.quantity} {order.symbol} @ {actual_price}")
        except Exception as e:
            logger.error(f"Failed to fill order: {str(e)}")
            db.rollback()
        finally:
            db.close()
    
    def _open_position(self, db, symbol: str, entry_price: float, quantity: float, stop_loss: float = None, take_profit: float = None):
        """Open a new position or add to existing one."""
        # Check if position already exists for this user (any bot run)
        position = db.query(Position).filter(
            Position.user_id == self.user_id,
            Position.symbol == symbol
        ).first()
        
        if position:
            # Average entry price for adding to position, update to current bot run
            total_value = (position.entry_price * position.quantity) + (entry_price * quantity)
            total_quantity = position.quantity + quantity
            position.entry_price = total_value / total_quantity
            position.quantity = total_quantity
            position.bot_execution_id = self.bot_execution_id
            if stop_loss:
                position.stop_loss = stop_loss
            if take_profit:
                position.take_profit = take_profit
            logger.info(f"📈 Added to position: {symbol} - New avg price: ${position.entry_price:.2f}, Qty: {position.quantity}")
        else:
            # Create new position
            position = Position(
                bot_execution_id=self.bot_execution_id,
                user_id=self.user_id,
                symbol=symbol,
                entry_price=entry_price,
                quantity=quantity,
                current_price=entry_price,
                stop_loss=stop_loss,
                take_profit=take_profit
            )
            db.add(position)
            sl_info = f", SL: ${stop_loss:.2f}" if stop_loss else ""
            tp_info = f", TP: ${take_profit:.2f}" if take_profit else ""
            logger.info(f"📈 Opened position: {symbol} - Entry: ${entry_price:.2f}, Qty: {quantity}{sl_info}{tp_info}")
    
    def _close_position(self, db, symbol: str, exit_price: float, quantity: float):
        """Close or reduce a position and record trade history."""
        position = db.query(Position).filter(
            Position.user_id == self.user_id,
            Position.symbol == symbol
        ).first()
        
        if not position:
            logger.warning(f"Cannot close position: {symbol} - Position not found")
            return
        
        # Calculate PnL
        pnl = (exit_price - position.entry_price) * quantity
        result = "PROFIT" if pnl > 0 else "LOSS"
        
        # Record trade history
        trade = TradeHistory(
            bot_execution_id=self.bot_execution_id,
            user_id=self.user_id,
            symbol=symbol,
            buy_price=position.entry_price,
            sell_price=exit_price,
            quantity=quantity,
            pnl=pnl,
            result=result,
            opened_at=position.opened_at,
            closed_at=datetime.now(timezone.utc)
        )
        db.add(trade)
        
        # Update or close position
        if quantity >= position.quantity:
            # Close entire position
            db.delete(position)
            logger.info(f"📉 Closed position: {symbol} - PnL: ${pnl:.2f} ({result})")
        else:
            # Partial close
            position.quantity -= quantity
            logger.info(f"📉 Reduced position: {symbol} - Remaining: {position.quantity}, PnL: ${pnl:.2f} ({result})")
    
    def update_positions_price(self, symbol: str, current_price: float):
        """Update current price and unrealized PnL for positions."""
        db = get_db()
        try:
            positions = db.query(Position).filter(
                Position.user_id == self.user_id,
                Position.symbol == symbol
            ).all()
            
            for position in positions:
                position.current_price = current_price
                position.unrealized_pnl = (current_price - position.entry_price) * position.quantity
            
            db.commit()
        except Exception as e:
            logger.error(f"Failed to update positions: {str(e)}")
            db.rollback()
        finally:
            db.close()
    
    def cancel_order(self, order_id: str):
        """Cancel a pending order."""
        db = get_db()
        try:
            order = db.query(Order).filter(Order.order_id == order_id).first()
            if order:
                order.status = "CANCELLED"
                db.commit()
                logger.info(f"❌ Cancelled order: {order_id}")
        except Exception as e:
            logger.error(f"Failed to cancel order: {str(e)}")
            db.rollback()
        finally:
            db.close()
    
    def update_bot_last_run(self):
        """Update bot execution last run timestamp."""
        db = get_db()
        try:
            bot = db.query(BotExecution).filter(BotExecution.id == self.bot_execution_id).first()
            if bot:
                bot.last_run = datetime.now(timezone.utc)
                db.commit()
        except Exception as e:
            logger.error(f"Failed to update bot last run: {str(e)}")
            db.rollback()
        finally:
            db.close()
