"""
HTTP API wrapper for the trading bot.
Provides health checks and status endpoints.
"""
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
import threading
import asyncio
from datetime import datetime, timezone
from config import Config
import psycopg2
import jwt
import base64
import os
from bot_models import BotExecution, Order, Position, TradeHistory, get_db, init_db
from strategy_models import StrategyDB, Strategy
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
    capital: float = 100.0  # Capital allocation as percentage (1-100%)

app = FastAPI(title="Alphintra Trading Service", version="1.0.0")

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "zEseNVzJiNEFsxOKygzayk4hHjSp2UJMzHMwSjWWfqE=")

# Database Configuration (Fixed: Use trading database instead of wallet database)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://alphintra:alphintra123@localhost:5432/alphintra_trading")

# CORS handled by API Gateway - do not add CORS middleware here
# app.add_middleware(CORSMiddleware, ...) - DISABLED

# Bot status
bot_status = {
    "running": False,
    "started_at": None,
    "last_execution": None,
    "execution_count": 0,
    "mode": "TESTNET",
    "wallet_connected": False,
    "strategy": None,
    "coin": None
}

# Bot instance and thread
bot_instance = None
bot_thread = None
bot_strategy_name = None  # Track selected strategy
bot_selected_coin = None  # Track selected coin
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

def get_available_balance() -> float:
    """Get available USDT balance from testnet."""
    try:
        import ccxt
        testnet_exchange = ccxt.binance({
            'apiKey': Config.BINANCE_TESTNET_API_KEY,
            'secret': Config.BINANCE_TESTNET_SECRET,
            'enableRateLimit': True,
        })
        testnet_exchange.set_sandbox_mode(True)
        testnet_exchange.options['adjustForTimeDifference'] = True
        testnet_exchange.options['recvWindow'] = 60000
        testnet_exchange.load_time_difference()
        balance = testnet_exchange.fetch_balance()
        return balance.get('USDT', {}).get('free', 10000.0)
    except Exception as e:
        logger.warning(f"Failed to fetch balance, using default: {str(e)}")
        return 10000.0

def check_wallet_connection(user_id: int) -> dict:
    """Check if user has an active wallet connection in wallet service"""
    try:
        # Connect to wallet database (not trading database)
        wallet_db_url = os.getenv("WALLET_DATABASE_URL", "postgresql://alphintra:alphintra123@localhost:5432/alphintra_wallet")
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
                "message": "No wallet connection found. Please connect your wallet first."
            }
        
        status, environment, last_error = result
        
        if status == 'connected':
            return {
                "connected": True,
                "status": status,
                "environment": environment,
                "message": "Wallet connected successfully"
            }
        else:
            return {
                "connected": False,
                "status": status,
                "message": f"Wallet connection error: {last_error or 'Unknown error'}"
            }
    except Exception as e:
        return {
            "connected": False,
            "status": "error",
            "message": f"Failed to check wallet connection: {str(e)}"
        }

def run_bot_in_thread(strategy_id: str, coin: Optional[str] = None, capital_percentage: float = 100.0, bot_execution_id: int = None, user_id: int = None):
    """Run the bot in a separate thread"""
    global bot_instance, bot_strategy_name, bot_selected_coin, bot_allocated_capital
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
        # Prepare trading pairs list
        bot_trading_pairs = [coin] if coin else Config.TRADING_PAIRS
        bot_selected_coin = coin if coin else "all"
        
        # Calculate actual USDT from percentage using real balance
        available_balance = get_available_balance()
        capital_usdt = (capital_percentage / 100.0) * available_balance
        bot_allocated_capital = capital_usdt
        
        # Log strategy selection
        add_bot_log("INFO", f"Loading strategy: {strategy_id}", bot_execution_id)
        add_bot_log("INFO", f"Trading pair(s): {coin if coin else 'all coins'}", bot_execution_id)
        add_bot_log("INFO", f"Capital allocation: {capital_percentage}% (${capital_usdt:,.2f} USDT of ${available_balance:,.2f} total)", bot_execution_id)
        
        strategy = load_strategy(strategy_id)
        bot_strategy_name = strategy_id
        bot_instance = TradingBot(strategy, setup_signals=False, bot_execution_id=bot_execution_id, user_id=user_id, trading_pairs=bot_trading_pairs)  # Pass execution context
        
        if bot_instance.initialize():
            bot_status["running"] = True
            bot_status["started_at"] = datetime.now(timezone.utc).isoformat()
            bot_status["strategy"] = strategy_id
            bot_status["coin"] = coin if coin else "all"
            bot_instance.start()
        else:
            bot_status["running"] = False
            bot_status["started_at"] = None
            bot_status["strategy"] = None
            bot_status["coin"] = None
    except Exception as e:
        print(f"Bot error: {str(e)}")
        import traceback
        traceback.print_exc()
        bot_status["running"] = False
        bot_status["started_at"] = None
        bot_status["strategy"] = None
        bot_status["coin"] = None
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
        "coins": ["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "ADA/USDT"]
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
    
    # Validate coin if provided (use Config.TRADING_PAIRS instead of hardcoded list)
    available_coins = Config.TRADING_PAIRS
    if request.coin and request.coin not in available_coins:
        return {
            "status": "error",
            "message": f"Invalid coin. Choose from: {', '.join(available_coins)}"
        }
    
    # Validate capital
    if request.capital <= 0:
        return {
            "status": "error",
            "message": "Capital percentage must be greater than 0"
        }
    
    if request.capital > 100:
        return {
            "status": "error",
            "message": "Capital percentage cannot exceed 100%"
        }
    
    if request.capital < 1:
        return {
            "status": "error",
            "message": "Minimum capital is 1%"
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
        # Calculate actual USDT amount from percentage using real balance
        available_balance = get_available_balance()
        capital_usdt = (request.capital / 100.0) * available_balance
        
        execution = BotExecution(
            user_id=user_id,
            strategy_name=request.strategy_id,  # Store strategy_id instead of name
            coin=request.coin if request.coin else "all",
            capital=capital_usdt,  # Store calculated USDT amount
            status="running"
        )
        db.add(execution)
        db.commit()
        db.refresh(execution)
        current_execution_id = execution.id
        add_bot_log("INFO", f"Created bot execution record: ID={execution.id}, Capital: {request.capital}% (${capital_usdt:,.2f} USDT)", execution.id)
    except Exception as e:
        logger.error(f"Failed to create execution record: {str(e)}")
        db.rollback()
    finally:
        db.close()
    
    # Start bot in background thread
    bot_thread = threading.Thread(target=run_bot_in_thread, args=(request.strategy_id, request.coin, request.capital, current_execution_id, user_id), daemon=True)
    bot_thread.start()
    
    coin_msg = f" trading {request.coin}" if request.coin else " trading all coins"
    available_balance = get_available_balance()
    capital_usdt = (request.capital / 100.0) * available_balance
    
    # Get strategy name for response
    strategy_obj = next((s for s in user_strategies if s.strategy_id == request.strategy_id), None)
    strategy_name = strategy_obj.name if strategy_obj else request.strategy_id
    
    return {
        "status": "success",
        "message": f"Trading bot started successfully with {strategy_name} strategy{coin_msg} and {request.capital}% capital (${capital_usdt:,.2f} USDT)",
        "strategy": strategy_name,
        "coin": request.coin if request.coin else "all",
        "capital_percentage": request.capital,
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
    bot_status["coin"] = None
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

if __name__ == "__main__":
    # Initialize database
    init_db()
    logger.info("📊 Database initialized")
    
    # Run the HTTP server
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
