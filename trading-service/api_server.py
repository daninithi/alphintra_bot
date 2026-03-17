"""
HTTP API wrapper for the trading bot.
Provides health checks and status endpoints.
"""
from fastapi import FastAPI, HTTPException, Header, Depends, File, UploadFile, Form
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
import threading
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from config import Config
import psycopg2
import jwt
import base64
import os
from bot_models import BotExecution, Order, Position, TradeHistory, get_db, init_db
from strategy_models import StrategyDB, Strategy
from strategy_upload import StrategyUploadHandler
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Custom logging handler to capture logs in memory
class InMemoryLogHandler(logging.Handler):
    """Custom handler to capture logs in the bot_logs array"""
    def __init__(self, bot_execution_id: int = None):
        super().__init__()
        self.bot_execution_id = bot_execution_id
        
    def emit(self, record):
        try:
            # Skip logs from uvicorn and other system logs
            if record.name in ['uvicorn', 'uvicorn.access', 'uvicorn.error']:
                return
                
            # Format the log message
            msg = self.format(record)
            
            # Determine log level
            level = record.levelname
            
            # Add to bot logs
            log_entry = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "level": level,
                "message": msg,
                "bot_execution_id": self.bot_execution_id or current_execution_id
            }
            bot_logs.append(log_entry)
            
            # Keep only the last MAX_LOG_LINES entries
            if len(bot_logs) > MAX_LOG_LINES:
                bot_logs.pop(0)
        except Exception:
            self.handleError(record)

# Request models
class StartBotRequest(BaseModel):
    strategy_id: str  # Changed from strategy name to strategy_id (e.g., "multi-timeframe-trend-001")
    coin: Optional[str] = None  # e.g., "BTC/USDT" or None for all coins
    capital: float = 100.0  # Capital allocation in USDT (minimum $1, recommended $10+)

app = FastAPI(title="Alphintra Trading Service", version="1.0.0")

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "zEseNVzJiNEFsxOKygzayk4hHjSp2UJMzHMwSjWWfqE=")

# Database Configuration (Fixed: Use trading database instead of wallet database)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://myapp:alphintra123@localhost:5432/alphintra_trading")

# CORS is handled by the API Gateway. No direct browser access allowed.
# Both admin and user frontend route through the gateway (port 8790).


# Bot status
bot_status = {
    "running": False,
    "started_at": None,
    "last_execution": None,
    "execution_count": 0,
    "mode": "TESTNET",
    "wallet_connected": False,
    "strategy": None
}

# Bot instance and thread
bot_instance = None
bot_thread = None
bot_strategy_name = None  # Track selected strategy
bot_allocated_capital = None  # Track allocated capital
current_execution_id = None  # Track current bot execution record

# In-memory logging
bot_logs = []
MAX_LOG_LINES = 1000

def load_strategy(strategy_id: str):
    """
    Load trading strategy dynamically from file based on strategy_id
    Queries database to get strategy_file path and python_class name, 
    then dynamically imports and instantiates the strategy
    """
    import importlib.util
    import sys
    from pathlib import Path
    
    try:
        # Get strategy details from database
        db = StrategyDB()
        strategy = db.get_strategy_by_id(strategy_id)
        
        if not strategy:
            logger.error(f"Strategy not found: {strategy_id}")
            raise ValueError(f"Strategy not found: {strategy_id}")
        
        if not strategy.strategy_file:
            logger.error(f"Strategy file not defined for: {strategy_id}")
            raise ValueError(f"Strategy file not defined for: {strategy_id}")
        
        # Construct full file path
        strategy_file_path = Path(__file__).parent / strategy.strategy_file
        
        if not strategy_file_path.exists():
            logger.error(f"Strategy file not found: {strategy_file_path}")
            raise FileNotFoundError(f"Strategy file not found: {strategy_file_path}")
        
        # Dynamically import the module
        module_name = f"dynamic_strategy_{strategy_id.replace('-', '_')}"
        spec = importlib.util.spec_from_file_location(module_name, strategy_file_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        
        # Get the strategy class from the module
        strategy_class = getattr(module, strategy.python_class)
        
        # Instantiate and return the strategy
        logger.info(f"Successfully loaded strategy: {strategy.name} from {strategy.strategy_file}")
        return strategy_class()
        
    except Exception as e:
        logger.error(f"Failed to load strategy {strategy_id}: {e}")
        # Fallback to RSI strategy
        from strategies.rsi_mean_reversion import RSIMeanReversionStrategy
        logger.warning(f"Falling back to RSI Mean Reversion strategy")
        return RSIMeanReversionStrategy()

def get_current_user_id(authorization: Optional[str] = Header(None)) -> int:
    """Extract user_id from JWT token in Authorization header"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    
    try:
        # Remove 'Bearer ' prefix if present
        token = authorization.replace("Bearer ", "").strip()
        
        # Decode JWT token
        payload = jwt.decode(token, base64.b64decode(JWT_SECRET), algorithms=["HS256"])
        
        user_id = payload.get("userId")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing userId")
        
        return int(user_id)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

def add_bot_log(level: str, message: str, bot_execution_id: int = None):
    """Add a log entry to the in-memory buffer"""
    global bot_logs
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "message": message,
        "bot_execution_id": bot_execution_id or current_execution_id
    }
    bot_logs.append(log_entry)
    
    # Keep only the last MAX_LOG_LINES entries
    if len(bot_logs) > MAX_LOG_LINES:
        bot_logs.pop(0)

def get_available_balance(user_id: int = None) -> float:
    """Get available USDT balance from wallet service database."""
    if not user_id:
        return 10000.0  # Default for system calls
    
    try:
        # Connect to wallet database
        wallet_db_url = os.getenv("WALLET_DATABASE_URL", "postgresql://myapp:alphintra123@localhost:5432/alphintra_wallet")
        conn = psycopg2.connect(wallet_db_url)
        cur = conn.cursor()
        
        cur.execute("""
            SELECT balance
            FROM wallet_connections
            WHERE user_id = %s 
              AND exchange_name = 'binance'
              AND is_active = true
            ORDER BY created_at DESC
            LIMIT 1
        """, (user_id,))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if result and result[0]:
            import json
            balance_data = result[0] if isinstance(result[0], dict) else json.loads(result[0])
            return float(balance_data.get('USDT', 10000.0))
        else:
            return 10000.0  # Default if no wallet connection
    except Exception as e:
        logger.warning(f"Failed to fetch balance from wallet DB, using default: {str(e)}")
        return 10000.0

def update_wallet_balance(user_id: int, currency: str, amount_change: float) -> bool:
    """Update balance in wallet service database after trade execution."""
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
        """, (user_id,))
        
        result = cur.fetchone()
        if not result:
            cur.close()
            conn.close()
            return False
        
        import json
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
        """, (json.dumps(balance_data), user_id))
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"Updated {currency} balance for user {user_id}: {current_balance:,.2f} -> {new_balance:,.2f} (change: {amount_change:+,.2f})")
        return True
    except Exception as e:
        logger.error(f"Failed to update wallet balance: {str(e)}")
        return False

def check_wallet_connection(user_id: int) -> dict:
    """Check if user has an active wallet connection in wallet service"""
    try:
        # Connect to wallet database (not trading database)
        wallet_db_url = os.getenv("WALLET_DATABASE_URL", "postgresql://myapp:alphintra123@localhost:5432/alphintra_wallet")
        conn = psycopg2.connect(wallet_db_url)
        cur = conn.cursor()
        
        cur.execute("""
            SELECT connection_status, exchange_environment, last_error
            FROM wallet_connections
            WHERE user_id = %s 
              AND exchange_name = 'binance'
              AND is_active = true
            ORDER BY created_at DESC
            LIMIT 1
        """, (user_id,))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if not result:
            return {
                "connected": False,
                "status": "not_found",
                "environment": None,
                "message": "No wallet connection found. Please connect your wallet first."
            }
        
        status, environment, last_error = result
        
        if status == 'connected':
            return {
                "connected": True,
                "status": status,
                "environment": environment or "production",
                "message": "Wallet connected successfully"
            }
        else:
            return {
                "connected": False,
                "status": status,
                "environment": environment,
                "message": f"Wallet connection error: {last_error or 'Unknown error'}"
            }
    except Exception as e:
        return {
            "connected": False,
            "status": "error",
            "environment": None,
            "message": f"Failed to check wallet connection: {str(e)}"
        }

def run_bot_in_thread(strategy_id: str, capital_usdt: float = 100.0, bot_execution_id: int = None, user_id: int = None, environment: str = "testnet"):
    """Run the bot in a separate thread"""
    global bot_instance, bot_strategy_name, bot_allocated_capital
    from bot import TradingBot
    
    # Set up custom logging handler to capture all logs
    log_handler = InMemoryLogHandler(bot_execution_id)
    log_handler.setLevel(logging.INFO)
    formatter = logging.Formatter('%(message)s')
    log_handler.setFormatter(formatter)
    
    # Add handler to root logger to capture all bot logs
    root_logger = logging.getLogger()
    root_logger.addHandler(log_handler)
    
    try:
        # Always use all trading pairs from Config.TRADING_PAIRS
        bot_trading_pairs = Config.TRADING_PAIRS
        
        # Use capital amount directly
        bot_allocated_capital = capital_usdt
        available_balance = get_available_balance(user_id)
        capital_percentage = (capital_usdt / available_balance * 100) if available_balance > 0 else 0
        
        # Log strategy selection
        add_bot_log("INFO", f"Loading strategy: {strategy_id}", bot_execution_id)
        add_bot_log("INFO", f"Trading pairs: {', '.join(Config.TRADING_PAIRS)}", bot_execution_id)
        add_bot_log("INFO", f"Capital allocation: ${capital_usdt:,.2f} USDT ({capital_percentage:.2f}% of ${available_balance:,.2f} total)", bot_execution_id)
        
        strategy = load_strategy(strategy_id)
        bot_strategy_name = strategy_id

        bot_instance = TradingBot(strategy, setup_signals=False, bot_execution_id=bot_execution_id, user_id=user_id, trading_pairs=bot_trading_pairs, environment=environment, capital_usdt=capital_usdt)
        
        if bot_instance.initialize():
            bot_status["running"] = True
            bot_status["started_at"] = datetime.now(timezone.utc).isoformat()
            bot_status["strategy"] = strategy_id
            bot_instance.start()
        else:
            bot_status["running"] = False
            bot_status["started_at"] = None
            bot_status["strategy"] = None
    except Exception as e:
        print(f"Bot error: {str(e)}")
        import traceback
        traceback.print_exc()
        bot_status["running"] = False
        bot_status["started_at"] = None
        bot_status["strategy"] = None
    finally:
        # Remove the custom log handler when bot stops
        root_logger = logging.getLogger()
        root_logger.removeHandler(log_handler)

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "trading-service",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/logs")
async def get_bot_logs(user_id: int = Depends(get_current_user_id)):
    """Get bot logs for the current user."""
    # Filter logs for the current user's bots
    user_logs = [log for log in bot_logs if log.get("bot_execution_id")]
    return user_logs

@app.get("/status")
async def get_status():
    """Get trading bot status."""
    return {
        "status": "success",
        "data": bot_status
    }

@app.get("/config")
async def get_config():
    """Get trading configuration."""
    return {
        "status": "success",
        "data": {
            "bot_name": Config.BOT_NAME,
            "trading_pairs": Config.TRADING_PAIRS,
            "timeframes": Config.TIMEFRAMES
        }
    }

@app.get("/coins")
async def list_coins():
    """List available trading coins."""
    return {
        "status": "success",
        "coins": Config.TRADING_PAIRS
    }

@app.get("/history")
async def get_bot_history(
    user_id: int = Depends(get_current_user_id),
    limit: int = 10
):
    """Get bot execution history for the current user."""
    db = get_db()
    try:
        executions = db.query(BotExecution).filter(
            BotExecution.user_id == user_id
        ).order_by(BotExecution.created_at.desc()).limit(limit).all()
        
        return {
            "status": "success",
            "data": [execution.to_dict() for execution in executions]
        }
    except Exception as e:
        logger.error(f"Failed to retrieve execution history: {str(e)}")
        return {
            "status": "error",
            "message": f"Failed to retrieve history: {str(e)}"
        }
    finally:
        db.close()

@app.get("/balance")
async def get_balance(user_id: int = Depends(get_current_user_id)):
    """Get USDT balance from wallet database."""
    try:
        balance = get_available_balance(user_id)
        return {
            "status": "success",
            "data": {
                "usdt": balance
            }
        }
    except Exception as e:
        logger.error(f"Failed to retrieve balance: {str(e)}")
        return {
            "status": "error",
            "message": f"Failed to retrieve balance: {str(e)}"
        }

@app.get("/bot")
async def get_bot_status_table(user_id: int = Depends(get_current_user_id)):
    """Get all bots for frontend table."""
    db = get_db()
    try:
        # Get all bots for the user, most recent first
        bots = db.query(BotExecution).filter(
            BotExecution.user_id == user_id
        ).order_by(BotExecution.created_at.desc()).all()
        
        return {
            "status": "success",
            "data": [bot.to_dict() for bot in bots]
        }
    except Exception as e:
        logger.error(f"Failed to retrieve bot status: {str(e)}")
        return {
            "status": "error",
            "message": f"Failed to retrieve bot status: {str(e)}"
        }
    finally:
        db.close()

@app.get("/orders/pending")
async def get_pending_orders(user_id: int = Depends(get_current_user_id)):
    """Get pending orders for frontend table."""
    db = get_db()
    try:
        orders = db.query(Order).filter(
            Order.user_id == user_id,
            Order.status == "PENDING"
        ).order_by(Order.created_at.desc()).all()
        
        return {
            "status": "success",
            "data": [order.to_dict() for order in orders]
        }
    except Exception as e:
        logger.error(f"Failed to retrieve pending orders: {str(e)}")
        return {
            "status": "error",
            "message": f"Failed to retrieve orders: {str(e)}"
        }
    finally:
        db.close()

@app.get("/positions/open")
async def get_open_positions(user_id: int = Depends(get_current_user_id)):
    """Get open positions for frontend table."""
    db = get_db()
    try:
        positions = db.query(Position).filter(
            Position.user_id == user_id
        ).order_by(Position.opened_at.desc()).all()
        
        return {
            "status": "success",
            "data": [position.to_dict() for position in positions]
        }
    except Exception as e:
        logger.error(f"Failed to retrieve open positions: {str(e)}")
        return {
            "status": "error",
            "message": f"Failed to retrieve positions: {str(e)}"
        }
    finally:
        db.close()

@app.post("/positions/{position_id}/close")
async def close_position_manually(
    position_id: int,
    user_id: int = Depends(get_current_user_id)
):
    """Manually close an open position, create trade history."""
    db = get_db()
    try:
        position = db.query(Position).filter(
            Position.id == position_id,
            Position.user_id == user_id
        ).first()
        if not position:
            raise HTTPException(status_code=404, detail="Position not found")

        symbol = position.symbol
        base_currency = symbol.split('/')[0]   # e.g. XRP

        # Fetch live price from mainnet (public endpoint, no auth needed)
        exit_price = position.current_price or position.entry_price
        try:
            import ccxt
            exchange = ccxt.binance({
                "options": {"defaultType": "spot"},
                "enableRateLimit": True,
            })
            # Do NOT set sandbox mode — price fetching uses public mainnet endpoints
            ticker = exchange.fetch_ticker(symbol)
            exit_price = ticker["last"]
            logger.info(f"Fetched live price for {symbol}: {exit_price}")
        except Exception as price_err:
            logger.warning(f"Could not fetch live price for {symbol}: {price_err}, using stored price")

        pnl = (exit_price - position.entry_price) * position.quantity
        result = "profit" if pnl >= 0 else "loss"
        usdt_received = exit_price * position.quantity

        trade = TradeHistory(
            bot_execution_id=position.bot_execution_id,
            user_id=user_id,
            symbol=symbol,
            buy_price=position.entry_price,
            sell_price=exit_price,
            quantity=position.quantity,
            pnl=pnl,
            result=result,
            opened_at=position.opened_at or datetime.now(timezone.utc),
        )
        db.add(trade)
        db.delete(position)
        db.commit()

        # Update wallet: add USDT received, deduct crypto sold
        update_wallet_balance(user_id, "USDT", usdt_received)
        update_wallet_balance(user_id, base_currency, -position.quantity)

        # Remove from in-memory positions if bot is running
        global bot_instance
        if bot_instance and hasattr(bot_instance, "signal_processor") and bot_instance.signal_processor:
            bot_instance.signal_processor.positions.pop(symbol, None)

        return {"status": "success", "pnl": round(pnl, 4), "exit_price": exit_price}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to close position {position_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.get("/trades/history")
async def get_trade_history(
    user_id: int = Depends(get_current_user_id),
    limit: int = 50
):
    """Get trading history for frontend table."""
    db = get_db()
    try:
        trades = db.query(TradeHistory).filter(
            TradeHistory.user_id == user_id
        ).order_by(TradeHistory.closed_at.desc()).limit(limit).all()
        
        return {
            "status": "success",
            "data": [trade.to_dict() for trade in trades]
        }
    except Exception as e:
        logger.error(f"Failed to retrieve trade history: {str(e)}")
        return {
            "status": "error",
            "message": f"Failed to retrieve trades: {str(e)}"
        }
    finally:
        db.close()

@app.post("/start")
async def start_bot(
    request: StartBotRequest,
    user_id: int = Depends(get_current_user_id)
):
    """Start the trading bot with selected strategy and coin."""
    global bot_thread, bot_status, current_execution_id
    
    # Validate that strategy exists and user has access to it
    db_strategy = StrategyDB()
    user_strategies = db_strategy.get_user_strategies(user_id)
    
    # Check if user has access to the requested strategy
    strategy_exists = any(s.strategy_id == request.strategy_id for s in user_strategies)
    if not strategy_exists:
        return {
            "status": "error",
            "message": f"Strategy not found or you don't have access to it. Please select a valid strategy."
        }
    
    # Validate capital
    if request.capital <= 0:
        return {
            "status": "error",
            "message": "Capital amount must be greater than 0"
        }
    
    # Check if capital exceeds available balance
    available_balance = get_available_balance(user_id)
    if available_balance <= 0:
        return {
            "status": "error",
            "message": "Your balance is 0. Please fund your account before starting the bot."
        }
    
    if request.capital > available_balance:
        return {
            "status": "error",
            "message": f"Capital amount (${request.capital:,.2f}) exceeds available balance (${available_balance:,.2f})"
        }
    
    # Check wallet connection
    wallet_status = check_wallet_connection(user_id)
    bot_status["wallet_connected"] = wallet_status["connected"]
    
    if not wallet_status["connected"]:
        return {
            "status": "error",
            "message": "Please connect your trading account first before starting the bot. ",
            "wallet_status": wallet_status,
            "bot_status": bot_status
        }
    
    # Get environment from wallet connection
    trading_environment = wallet_status.get("environment", "testnet")
    logger.info(f"🌐 Bot will trade on Binance {trading_environment.upper()}")
    
    # Check if user already has a running bot in database
    db_check = get_db()
    try:
        existing_running_bot = db_check.query(BotExecution).filter(
            BotExecution.user_id == user_id,
            BotExecution.status == "running"
        ).first()
        
        if existing_running_bot:
            return {
                "status": "error",
                "message": f"You already have a running bot (ID: {existing_running_bot.id}). Please stop it before starting a new one.",
                "wallet_status": wallet_status,
                "bot_status": bot_status
            }
    finally:
        db_check.close()
    
    if bot_status["running"]:
        return {
            "status": "error",
            "message": "Bot is already running",
            "wallet_status": wallet_status,
            "bot_status": bot_status
        }
    
    # Create database record
    db = get_db()
    try:
        # Use capital amount directly (already in USDT)
        capital_usdt = request.capital
        
        execution = BotExecution(
            user_id=user_id,
            strategy_name=request.strategy_id,  # Store strategy_id instead of name
            capital=capital_usdt,  # Store USDT amount
            status="running"
        )
        db.add(execution)
        db.commit()
        db.refresh(execution)
        current_execution_id = execution.id
        add_bot_log("INFO", f"Created bot execution record: ID={execution.id}, Capital: ${capital_usdt:,.2f} USDT", execution.id)
    except Exception as e:
        logger.error(f"Failed to create execution record: {str(e)}")
        db.rollback()
    finally:
        db.close()
    
    # Start bot in background thread
    bot_thread = threading.Thread(target=run_bot_in_thread, args=(request.strategy_id, request.capital, current_execution_id, user_id, trading_environment), daemon=True)
    bot_thread.start()
    
    coin_msg = f" trading all coins ({', '.join(Config.TRADING_PAIRS)})"
    capital_usdt = request.capital
    available_balance = get_available_balance(user_id)
    capital_percentage = (capital_usdt / available_balance * 100) if available_balance > 0 else 0
    
    # Get strategy name for response
    strategy_obj = next((s for s in user_strategies if s.strategy_id == request.strategy_id), None)
    strategy_name = strategy_obj.name if strategy_obj else request.strategy_id
    
    return {
        "status": "success",
        "message": f"Trading bot started successfully with {strategy_name} strategy{coin_msg} and ${capital_usdt:,.2f} USDT ({capital_percentage:.2f}% of balance)",
        "strategy": strategy_name,
        "coin": "all",
        "capital_percentage": capital_percentage,
        "capital_usdt": capital_usdt,
        "wallet_status": wallet_status,
        "bot_status": bot_status
    }

@app.post("/stop")
async def stop_bot(user_id: int = Depends(get_current_user_id)):
    """Stop the trading bot."""
    global bot_instance, bot_thread, bot_status, current_execution_id
    
    # Check both in-memory status and database status
    db = get_db()
    try:
        running_bot = db.query(BotExecution).filter(
            BotExecution.user_id == user_id,
            BotExecution.status == "running"
        ).first()
        
        if not bot_status["running"] and not running_bot:
            return {
                "status": "error",
                "message": "Bot is not running",
                "bot_status": bot_status
            }
        
        # If database has running bot but memory doesn't, use database ID
        execution_id_to_stop = current_execution_id or (running_bot.id if running_bot else None)
        
        # Stop the bot instance if it exists
        if bot_instance:
            bot_instance.stop()
            bot_instance = None
        
        # Update database record
        if execution_id_to_stop:
            execution = db.query(BotExecution).filter(BotExecution.id == execution_id_to_stop).first()
            if execution:
                execution.status = "stopped"
                execution.stopped_at = datetime.utcnow()
                db.commit()
                add_bot_log("INFO", f"Updated bot execution record: ID={execution.id}, status=stopped", execution.id)
        elif running_bot:
            # Fallback: stop any running bot for this user
            running_bot.status = "stopped"
            running_bot.stopped_at = datetime.utcnow()
            db.commit()
            add_bot_log("INFO", f"Updated bot execution record: ID={running_bot.id}, status=stopped", running_bot.id)
    except Exception as e:
        logger.error(f"Failed to stop bot: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to stop bot: {str(e)}")
    finally:
        db.close()
    
    # Reset in-memory status
    bot_status["running"] = False
    bot_status["started_at"] = None
    bot_status["strategy"] = None
    current_execution_id = None
    
    return {
        "status": "success",
        "message": "Trading bot stopped successfully",
        "bot_status": bot_status
    }

# ============================================
# Strategy Endpoints
# ============================================

@app.get("/strategies")
async def get_strategies(user_id: int = Depends(get_current_user_id)):
    """
    Get all strategies accessible by the current user
    Includes default, created, and purchased strategies
    """
    try:
        strategy_db = StrategyDB()
        strategies = strategy_db.get_user_strategies(user_id)
        strategy_db.close()
        
        # Convert to dict for JSON response
        strategies_data = [strategy.to_dict() for strategy in strategies]
        
        return {
            "status": "success",
            "data": strategies_data,
            "count": len(strategies_data)
        }
    except Exception as e:
        logger.error(f"Failed to get strategies: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch strategies: {str(e)}")

@app.get("/strategies/default")
async def get_default_strategies():
    """
    Get all default (system-provided) strategies
    Public endpoint - no authentication required
    """
    try:
        strategy_db = StrategyDB()
        strategies = strategy_db.get_default_strategies()
        strategy_db.close()
        
        # Convert to dict for JSON response
        strategies_data = [strategy.to_dict() for strategy in strategies]
        
        return {
            "status": "success",
            "data": strategies_data,
            "count": len(strategies_data)
        }
    except Exception as e:
        logger.error(f"Failed to get default strategies: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch default strategies: {str(e)}")

@app.get("/strategies/marketplace")
async def get_marketplace_strategies():
    """
    Get all marketplace strategies (available for purchase)
    """
    try:
        strategy_db = StrategyDB()
        strategies = strategy_db.get_marketplace_strategies()
        strategy_db.close()
        
        # Convert to dict for JSON response
        strategies_data = [strategy.to_dict() for strategy in strategies]
        
        return {
            "status": "success",
            "data": strategies_data,
            "count": len(strategies_data)
        }
    except Exception as e:
        logger.error(f"Failed to get marketplace strategies: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch marketplace strategies: {str(e)}")

@app.get("/strategies/{strategy_id}")
async def get_strategy_details(strategy_id: str, user_id: int = Depends(get_current_user_id)):
    """
    Get details of a specific strategy
    """
    try:
        strategy_db = StrategyDB()
        strategy = strategy_db.get_strategy_by_id(strategy_id)
        strategy_db.close()
        
        if not strategy:
            raise HTTPException(status_code=404, detail=f"Strategy not found: {strategy_id}")
        
        return {
            "status": "success",
            "data": strategy.to_dict()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get strategy details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch strategy: {str(e)}")

@app.post("/strategies/{strategy_id}/track-usage")
async def track_strategy_usage(strategy_id: str, user_id: int = Depends(get_current_user_id)):
    """
    Track when a user uses a strategy
    Called when starting a bot with a strategy
    """
    try:
        strategy_db = StrategyDB()
        success = strategy_db.track_strategy_usage(user_id, strategy_id)
        strategy_db.close()
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to track strategy usage")
        
        return {
            "status": "success",
            "message": "Strategy usage tracked"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to track strategy usage: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to track usage: {str(e)}")


@app.get("/strategies/users/{target_user_id}")
async def get_user_strategies_admin(
    target_user_id: int,
    _: int = Depends(get_current_user_id)
):
    """Admin view: all strategies for a given user with bot status."""
    db = get_db()
    try:
        strategy_db = StrategyDB()
        strategies = strategy_db.get_user_imported_strategies(target_user_id)
        strategy_db.close()

        # Get latest bot execution per strategy name for this user
        bots = db.query(BotExecution).filter(
            BotExecution.user_id == target_user_id
        ).order_by(BotExecution.created_at.desc()).all()

        latest_bot: dict = {}
        for b in bots:
            if b.strategy_name not in latest_bot:
                latest_bot[b.strategy_name] = b

        result = []
        for s in strategies:
            bot = latest_bot.get(s.name)
            result.append({
                "strategy_id": s.strategy_id,
                "name": s.name,
                "type": s.type,
                "access_type": s.access_type,
                "bot_status": bot.status if bot else None,
                "last_run": bot.last_run.isoformat() if bot and bot.last_run else None,
            })

        return {"status": "success", "data": result}
    except Exception as e:
        logger.error(f"Admin get user strategies failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


# ============================================
# Admin Strategy Management Endpoints
# ============================================

@app.post("/api/admin/strategies/upload")
async def upload_strategy(
    name: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id)
):
    """
    Upload a new strategy file (Admin only)
    
    Args:
        name: Strategy name
        description: Strategy description
        price: Strategy price (0 for free)
        file: Python strategy file
    """
    try:
        # Initialize handlers
        upload_handler = StrategyUploadHandler()
        strategy_db = StrategyDB()
        
        # Read file content
        file_content = await file.read()
        
        # Validate file
        is_valid, error_msg = upload_handler.validate_file(file_content, file.filename)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Extract class information
        class_name, parent_class = upload_handler.extract_class_info(file_content)
        if not class_name:
            raise HTTPException(status_code=400, detail="Could not extract class name from file")
        
        # Validate that strategy inherits from BaseStrategy
        if not parent_class or 'BaseStrategy' not in parent_class:
            raise HTTPException(
                status_code=400, 
                detail="Strategy must inherit from BaseStrategy. Please ensure your strategy class extends BaseStrategy."
            )
        
        # Determine strategy type based on price
        is_paid = price > 0
        strategy_type = "marketplace" if is_paid else "default"
        
        # Save file
        success, file_path, error_msg = upload_handler.save_strategy_file(
            file_content, file.filename, is_paid
        )
        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to save file: {error_msg}")
        
        # Generate strategy ID
        strategy_id = upload_handler.generate_strategy_id(name)
        
        # Get module path
        module_path = upload_handler.get_module_path(file_path)
        
        # Create database record
        success, error_msg = strategy_db.create_strategy(
            strategy_id=strategy_id,
            name=name,
            description=description,
            strategy_type=strategy_type,
            price=price,
            python_class=class_name,
            python_module=module_path,
            strategy_file=file_path,
            author_id=user_id
        )
        
        if not success:
            # Rollback: delete file
            upload_handler.delete_strategy_file(file_path)
            raise HTTPException(status_code=500, detail=f"Failed to create strategy: {error_msg}")
        
        strategy_db.close()
        
        logger.info(f"Strategy uploaded successfully: {strategy_id}")
        
        return {
            "status": "success",
            "message": "Strategy uploaded successfully",
            "data": {
                "strategy_id": strategy_id,
                "name": name,
                "type": strategy_type,
                "file_path": file_path,
                "class_name": class_name,
                "module_path": module_path
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload strategy: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.get("/api/admin/strategies")
async def get_all_strategies_admin(
    strategy_type: Optional[str] = None,
    user_id: int = Depends(get_current_user_id)
):
    """
    Get all strategies (Admin view)
    
    Args:
        strategy_type: Optional filter ('default', 'marketplace', 'user_created')
    """
    try:
        strategy_db = StrategyDB()
        strategies = strategy_db.get_all_strategies_admin(strategy_type)
        strategy_db.close()
        
        # Convert to dict for JSON response
        strategies_data = [strategy.to_dict() for strategy in strategies]
        
        return {
            "status": "success",
            "data": strategies_data,
            "count": len(strategies_data)
        }
    except Exception as e:
        logger.error(f"Failed to get strategies: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch strategies: {str(e)}")


@app.put("/api/admin/strategies/{strategy_id}")
async def update_strategy(
    strategy_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    price: Optional[float] = None,
    user_id: int = Depends(get_current_user_id)
):
    """
    Update strategy metadata (Admin only)
    Does not update the strategy file
    """
    try:
        strategy_db = StrategyDB()
        
        success, error_msg = strategy_db.update_strategy(
            strategy_id=strategy_id,
            name=name,
            description=description,
            price=price
        )
        
        strategy_db.close()
        
        if not success:
            raise HTTPException(status_code=400, detail=error_msg)
        
        return {
            "status": "success",
            "message": "Strategy updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update strategy: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")


@app.delete("/api/admin/strategies/{strategy_id}")
async def delete_strategy(
    strategy_id: str,
    user_id: int = Depends(get_current_user_id)
):
    """
    Delete a strategy (Admin only)
    Deletes both database record and file
    """
    try:
        strategy_db = StrategyDB()
        upload_handler = StrategyUploadHandler()
        
        # Get strategy details to find file path
        strategy = strategy_db.get_strategy_by_id(strategy_id)
        if not strategy:
            raise HTTPException(status_code=404, detail="Strategy not found")
        
        # Delete from database
        success, error_msg = strategy_db.delete_strategy(strategy_id)
        if not success:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Delete file if it exists
        if strategy.strategy_file:
            upload_handler.delete_strategy_file(strategy.strategy_file)
        
        strategy_db.close()
        
        return {
            "status": "success",
            "message": "Strategy deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete strategy: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


@app.get("/api/admin/strategies/{strategy_id}/content")
async def get_strategy_content(
    strategy_id: str,
    user_id: int = Depends(get_current_user_id)
):
    """
    Get the Python file content of a strategy (Admin only)
    """
    try:
        strategy_db = StrategyDB()
        upload_handler = StrategyUploadHandler()
        
        # Get strategy details
        strategy = strategy_db.get_strategy_by_id(strategy_id)
        if not strategy:
            raise HTTPException(status_code=404, detail="Strategy not found")
        
        if not strategy.strategy_file:
            raise HTTPException(status_code=404, detail="Strategy file not found")
        
        # Read file content
        content = upload_handler.read_strategy_file(strategy.strategy_file)
        if content is None:
            raise HTTPException(status_code=404, detail="Could not read strategy file")
        
        strategy_db.close()
        
        return {
            "status": "success",
            "data": {
                "strategy_id": strategy_id,
                "file_path": strategy.strategy_file,
                "content": content
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get strategy content: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")


# ============================================
# User Strategy Import Endpoints
# ============================================

@app.post("/api/user/strategies/upload")
async def user_upload_strategy(
    name: str = Form(...),
    description: str = Form(...),
    price: float = Form(0.0),
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id)
):
    """
    User uploads their own private strategy.
    Strategy is saved as 'user_created' with publish_status='private'.
    Immediately available for the user's own bots.
    """
    try:
        upload_handler = StrategyUploadHandler()
        strategy_db = StrategyDB()

        # Enforce import limit for free users
        FREE_IMPORT_LIMIT = 2
        if not strategy_db.is_user_subscribed(user_id):
            import_count = strategy_db.count_user_imported_strategies(user_id)
            if import_count >= FREE_IMPORT_LIMIT:
                raise HTTPException(
                    status_code=402,
                    detail="SUBSCRIPTION_REQUIRED: Free users can import up to 2 strategies. Upgrade to Pro for unlimited imports."
                )

        file_content = await file.read()

        is_valid, error_msg = upload_handler.validate_file(file_content, file.filename)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)

        class_name, parent_class = upload_handler.extract_class_info(file_content)
        if not class_name:
            raise HTTPException(status_code=400, detail="Could not extract class name from file")

        if not parent_class or 'BaseStrategy' not in parent_class:
            raise HTTPException(
                status_code=400,
                detail="Strategy must inherit from BaseStrategy. Please ensure your class extends BaseStrategy."
            )

        success, file_path, error_msg = upload_handler.save_strategy_file(
            file_content, file.filename, is_paid=False, is_user_created=True
        )
        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to save file: {error_msg}")

        strategy_id = upload_handler.generate_strategy_id(name)
        module_path = upload_handler.get_module_path(file_path)

        success, error_msg = strategy_db.create_user_strategy(
            strategy_id=strategy_id,
            name=name,
            description=description,
            price=price,
            python_class=class_name,
            python_module=module_path,
            strategy_file=file_path,
            author_id=user_id
        )

        if not success:
            upload_handler.delete_strategy_file(file_path)
            raise HTTPException(status_code=500, detail=f"Failed to create strategy: {error_msg}")

        strategy_db.close()
        logger.info(f"User {user_id} uploaded strategy: {strategy_id}")

        return {
            "status": "success",
            "message": "Strategy imported successfully",
            "data": {
                "strategy_id": strategy_id,
                "name": name,
                "type": "user_created",
                "publish_status": "private",
                "class_name": class_name
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"User strategy upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.get("/api/user/strategies")
async def get_user_imported_strategies(
    user_id: int = Depends(get_current_user_id)
):
    """Get all strategies imported/created by the current user."""
    try:
        strategy_db = StrategyDB()
        strategies = strategy_db.get_user_imported_strategies(user_id)
        strategy_db.close()
        return {
            "status": "success",
            "data": [s.to_dict() for s in strategies]
        }
    except Exception as e:
        logger.error(f"Failed to get user strategies: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get strategies: {str(e)}")


@app.delete("/api/user/strategies/{strategy_id}")
async def delete_user_strategy(
    strategy_id: str,
    user_id: int = Depends(get_current_user_id)
):
    """Delete a user's own imported strategy (private, rejected, or approved — not pending_review)."""
    try:
        strategy_db = StrategyDB()
        strategy = strategy_db.get_strategy_by_id(strategy_id)

        if not strategy:
            raise HTTPException(status_code=404, detail="Strategy not found")
        if strategy.author_id != user_id:
            raise HTTPException(status_code=403, detail="You don't own this strategy")


        upload_handler = StrategyUploadHandler()
        success, error_msg = strategy_db.delete_strategy(strategy_id)
        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to delete: {error_msg}")

        if strategy.strategy_file:
            upload_handler.delete_strategy_file(strategy.strategy_file)

        strategy_db.close()
        return {"status": "success", "message": "Strategy deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete user strategy: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


@app.get("/api/user/strategies/{strategy_id}/content")
async def get_user_strategy_content(
    strategy_id: str,
    user_id: int = Depends(get_current_user_id)
):
    """Get the file content of a user's own strategy."""
    try:
        strategy_db = StrategyDB()
        strategy = strategy_db.get_strategy_by_id(strategy_id)

        if not strategy:
            raise HTTPException(status_code=404, detail="Strategy not found")
        if strategy.author_id != user_id:
            raise HTTPException(status_code=403, detail="You don't own this strategy")

        upload_handler = StrategyUploadHandler()
        content = upload_handler.read_strategy_file(strategy.strategy_file)
        if content is None:
            raise HTTPException(status_code=404, detail="Strategy file not found")

        strategy_db.close()
        return {"status": "success", "data": {"content": content}}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")


@app.post("/api/user/strategies/{strategy_id}/request-publish")
async def request_publish_strategy(
    strategy_id: str,
    price: float = Form(0.0),
    user_id: int = Depends(get_current_user_id)
):
    """
    User requests to publish their strategy to the marketplace.
    Sets publish_status = 'pending_review'. Admin must approve/reject.
    """
    try:
        strategy_db = StrategyDB()

        # Block publish request for free users
        if not strategy_db.is_user_subscribed(user_id):
            strategy_db.close()
            raise HTTPException(
                status_code=402,
                detail="SUBSCRIPTION_REQUIRED: Only Pro subscribers can request to publish strategies."
            )

        success, error_msg = strategy_db.request_publish_strategy(strategy_id, user_id, price)
        strategy_db.close()

        if not success:
            raise HTTPException(status_code=400, detail=error_msg)

        return {
            "status": "success",
            "message": "Publish request submitted. Admin will review your strategy."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}")


# ============================================
# Admin — Strategy Publish Review Endpoints
# ============================================

@app.get("/api/admin/strategies/pending-review")
async def get_pending_review_strategies(
    user_id: int = Depends(get_current_user_id)
):
    """Get all user strategies pending admin review."""
    try:
        strategy_db = StrategyDB()
        strategies = strategy_db.get_pending_review_strategies()
        strategy_db.close()
        return {
            "status": "success",
            "data": [s.to_dict() for s in strategies],
            "count": len(strategies)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get pending strategies: {str(e)}")


@app.get("/api/admin/strategies/{strategy_id}/download")
async def download_strategy_file(
    strategy_id: str,
    user_id: int = Depends(get_current_user_id)
):
    """Admin downloads a strategy file for manual testing."""
    from fastapi.responses import FileResponse
    import os as _os

    try:
        strategy_db = StrategyDB()
        strategy = strategy_db.get_strategy_by_id(strategy_id)
        strategy_db.close()

        if not strategy:
            raise HTTPException(status_code=404, detail="Strategy not found")
        if not strategy.strategy_file:
            raise HTTPException(status_code=404, detail="No file attached to this strategy")

        project_root = Path(__file__).parent
        full_path = project_root / strategy.strategy_file

        if not full_path.exists():
            raise HTTPException(status_code=404, detail="Strategy file not found on disk")

        filename = f"{strategy.name.replace(' ', '_')}.py"
        return FileResponse(
            path=str(full_path),
            filename=filename,
            media_type="text/x-python"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")


@app.post("/api/admin/strategies/{strategy_id}/approve")
async def approve_strategy(
    strategy_id: str,
    user_id: int = Depends(get_current_user_id)
):
    """Admin approves a pending strategy — publishes it to marketplace."""
    try:
        strategy_db = StrategyDB()
        success, error_msg = strategy_db.approve_strategy(strategy_id)
        strategy_db.close()

        if not success:
            raise HTTPException(status_code=400, detail=error_msg)

        return {"status": "success", "message": "Strategy approved and published to marketplace"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Approval failed: {str(e)}")


@app.post("/api/admin/strategies/{strategy_id}/reject")
async def reject_strategy(
    strategy_id: str,
    reason: str = Form(...),
    user_id: int = Depends(get_current_user_id)
):
    """Admin rejects a pending strategy with a reason."""
    try:
        strategy_db = StrategyDB()
        success, error_msg = strategy_db.reject_strategy(strategy_id, reason)
        strategy_db.close()

        if not success:
            raise HTTPException(status_code=400, detail=error_msg)

        return {"status": "success", "message": "Strategy rejected"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rejection failed: {str(e)}")


@app.get("/api/admin/marketplace-strategies/user-submitted")
async def get_all_user_marketplace_strategies(
    _: int = Depends(get_current_user_id)
):
    """Admin view: all user-submitted strategies approved in the marketplace."""
    try:
        strategy_db = StrategyDB()
        strategies = strategy_db.get_all_user_marketplace_strategies()
        strategy_db.close()
        return {
            "status": "success",
            "data": strategies,
            "count": len(strategies)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/users/{user_id}/marketplace-strategies")
async def get_user_marketplace_strategies(
    user_id: int,
    _: int = Depends(get_current_user_id)
):
    """Admin view: get strategies a user has published to the marketplace."""
    try:
        strategy_db = StrategyDB()
        strategies = strategy_db.get_user_marketplace_strategies_admin(user_id)
        strategy_db.close()
        return {
            "status": "success",
            "data": [s.to_dict() for s in strategies],
            "count": len(strategies)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    # Initialize database
    init_db()
    logger.info("📊 Database initialized")
    
    # Run the HTTP server
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
