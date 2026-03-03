from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ccxt.async_support as ccxt
from typing import List, Dict, Any, Optional
import os
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from database import get_db, create_tables, engine
from models import WalletConnection
from ccxt.base.errors import AuthenticationError, RequestTimeout, ExchangeNotAvailable, NetworkError, DDoSProtection, RateLimitExceeded
import jwt
from cryptography.fernet import Fernet
import base64

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI(title="Alphintra Wallet Service", version="1.0.0")

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "zEseNVzJiNEFsxOKygzayk4hHjSp2UJMzHMwSjWWfqE=")

# Encryption Configuration - Use JWT_SECRET as base for encryption key
ENCRYPTION_KEY = base64.urlsafe_b64encode(base64.b64decode(JWT_SECRET)[:32])
cipher_suite = Fernet(ENCRYPTION_KEY)

def encrypt_credential(credential: str) -> bytes:
    """Encrypt a credential string."""
    return cipher_suite.encrypt(credential.encode())

def decrypt_credential(encrypted_credential: bytes) -> str:
    """Decrypt an encrypted credential."""
    if isinstance(encrypted_credential, str):
        encrypted_credential = encrypted_credential.encode()
    return cipher_suite.decrypt(encrypted_credential).decode()

#
# Lightweight diagnostic helpers used as dummy placeholders to keep room for future flags.
#
DUMMY_FEATURE_FLAGS: Dict[str, bool] = {
    "wallet_service_experimental_mode": False,
    "wallet_service_metrics_probe": False,
}


def noop_feature_probe(feature_name: str) -> bool:
    """Return the state of a dummy feature flag for future experiments."""
    logger.debug("noop_feature_probe called for feature=%s", feature_name)
    return DUMMY_FEATURE_FLAGS.get(feature_name, False)


# CORS handled by API Gateway - do not add CORS middleware here
# app.add_middleware(CORSMiddleware, ...) - DISABLED

# Create database tables on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database on service startup"""
    create_tables()
    print("✅ Database tables initialized")

# Add request logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    print(f"DEBUG: Incoming request: {request.method} {request.url}")
    print(f"DEBUG: Request headers: {dict(request.headers)}")
    
    try:
        body = await request.body()
        body_text = body.decode(errors='ignore')
        if 'apiKey' in body_text or 'secretKey' in body_text:
            print("DEBUG: Request body: <masked>")
        else:
            print(f"DEBUG: Request body: {body_text}")
        # Make the body available to downstream handlers by overriding receive
        async def receive():
            return {"type": "http.request", "body": body}
        # attach overridden receive so FastAPI can read body again
        request._receive = receive
    except Exception as e:
        print(f"DEBUG: Could not read request body: {e}")
    
    response = await call_next(request)
    print(f"DEBUG: Response status: {response.status_code}")
    return response

# Pydantic models for request/response
class CredentialsResponse(BaseModel):
    apiKey: str
    secretKey: str

class ConnectRequest(BaseModel):
    apiKey: str
    secretKey: str
    environment: str | None = "production"

class Balance(BaseModel):
    asset: str
    free: str
    locked: str

class ConnectionResponse(BaseModel):
    connected: bool


SUPPORTED_ENVIRONMENTS = {
    "production": {"production", "prod", "mainnet", "live"},
    "testnet": {"testnet", "sandbox", "demo"},
}


def normalize_environment(value: str | None) -> str:
    """Map arbitrary environment inputs to a supported environment value."""
    if not value:
        return "production"

    normalized = value.strip().lower()
    for target, aliases in SUPPORTED_ENVIRONMENTS.items():
        if normalized == target or normalized in aliases:
            return target

    raise HTTPException(
        status_code=400,
        detail="Unsupported environment. Use 'production' or 'testnet'.",
    )

# JWT token validation
def get_current_user_id(authorization: Optional[str] = Header(None)) -> int:
    """Extract user_id from JWT token in Authorization header"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    
    try:
        # Remove 'Bearer ' prefix if present
        token = authorization.replace("Bearer ", "").strip()
        
        # Decode JWT token
        import base64
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

@app.get("/")
async def root():
    print("DEBUG: Root endpoint called")
    return {"message": "Alphintra Wallet Service is running"}

@app.get("/health")
async def health_check():
    print("DEBUG: Health check called")
    return {"status": "healthy", "service": "wallet-service"}

@app.post("/binance/connect")
async def connect_to_binance(
    request: ConnectRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    print("DEBUG: connect_to_binance function called successfully")
    print(f"DEBUG: User ID from token: {user_id}")
    print(f"DEBUG: Received request type: {type(request)}")
    
    try:
        normalized_env = normalize_environment(request.environment)
        print(f"DEBUG: API Key received: {request.apiKey[:10] if request.apiKey else 'None'}...")
        print(f"DEBUG: Secret Key length: {len(request.secretKey) if request.secretKey else 'No secret'}")
        print(f"DEBUG: Requested environment: {normalized_env}")
        
        # Validate inputs
        if not request.apiKey or not request.secretKey:
            print("DEBUG: Missing API key or secret key")
            raise HTTPException(status_code=400, detail="API Key and Secret Key are required")
        
        if len(request.apiKey) < 10 or len(request.secretKey) < 10:
            print("DEBUG: Keys too short")
            raise HTTPException(status_code=400, detail="API Key and Secret Key seem too short")
        
        # Check if connection already exists for this user
        existing_connection = db.query(WalletConnection).filter(
            WalletConnection.user_id == user_id,
            WalletConnection.exchange_name == 'binance',
            WalletConnection.is_active == True
        ).first()
        
        if existing_connection:
            print("DEBUG: Updating existing connection...")
            # Update existing connection with encrypted credentials
            existing_connection.encrypted_api_key = encrypt_credential(request.apiKey)
            existing_connection.encrypted_secret_key = encrypt_credential(request.secretKey)
            existing_connection.last_used_at = func.now()
            existing_connection.connection_status = 'connected'
            existing_connection.last_error = None
            existing_connection.exchange_environment = normalized_env
            existing_connection.updated_at = func.now()
            connection = existing_connection
        else:
             print("DEBUG: Creating new connection...")
             # Create new connection with encrypted credentials
             connection = WalletConnection(
                 user_id=user_id,
                 exchange_name='binance',
                 exchange_environment=normalized_env,
                 encrypted_api_key=encrypt_credential(request.apiKey),
                 encrypted_secret_key=encrypt_credential(request.secretKey),
                 connection_name=f"Binance Connection ({datetime.now().strftime('%Y-%m-%d')})",
                 is_active=True,
                 connection_status='connected'
             )
       
        # Only add if it's a new connection
        if not existing_connection:
            db.add(connection)
        
        # Validate credentials quickly by performing a lightweight call
        exchange = ccxt.binance({
            'apiKey': request.apiKey,
            'secret': request.secretKey,
            'enableRateLimit': True,
            'timeout': 10000,
        })

        try:
            if normalized_env == "testnet":
                exchange.set_sandbox_mode(True)
            else:
                exchange.set_sandbox_mode(False)

            await exchange.fetch_status()
            connection.connection_status = 'connected'
            connection.last_error = None
        except AuthenticationError as auth_err:
            connection.connection_status = 'error'
            connection.last_error = f"AuthenticationError: {auth_err}"
            db.commit()
            raise HTTPException(status_code=401, detail="Authentication failed: check API key/secret for the selected environment")
        except (ExchangeNotAvailable, NetworkError, RequestTimeout) as network_err:
            logger.warning("Binance connectivity issue during connect: %s", network_err)
            connection.connection_status = 'connected'
            connection.last_error = f"Connectivity issue during validation: {network_err}"
        except Exception as validation_error:
            logger.warning("Unexpected error validating Binance credentials: %s", validation_error)
            connection.connection_status = 'connected'
            connection.last_error = str(validation_error)
        finally:
            try:
                await exchange.close()
            except Exception:
                pass

        db.commit()
        db.refresh(connection)
        print(f"DEBUG: Connection stored successfully with ID: {connection.uuid}")

        # Fetch and store initial balances after successful connection
        try:
            print("DEBUG: Fetching initial balances...")
            balance_data = await exchange.fetch_balance()
            totals = balance_data.get('total', {}) if isinstance(balance_data, dict) else {}
            
            # Define relevant coins to track
            RELEVANT_COINS = {
                # Trading pairs
                'BTC', 'ETH', 'SOL', 'DOGE', 'XRP',
                # Stablecoins
                'USDT'
            }
            
            # Build balance dictionary for database - only relevant coins
            balance_dict = {}
            for asset, total_amount in totals.items():
                # Skip if not a relevant coin
                if asset not in RELEVANT_COINS:
                    continue
                    
                try:
                    total_f = float(total_amount or 0)
                    # Skip invalid testnet values (18446 is an overflow/invalid value)
                    if total_f > 0 and total_f < 18000:
                        balance_dict[asset] = total_f
                except Exception:
                    continue
            
            if balance_dict:
                import json
                connection.balance = balance_dict
                connection.last_balance_update = func.now()
                db.commit()
                print(f"DEBUG: Initial balance stored: {balance_dict}")
            else:
                print("DEBUG: No balances found to store")
        except Exception as balance_error:
            print(f"DEBUG: Could not fetch initial balance: {balance_error}")
            # Don't fail connection if balance fetch fails

        success_message = "Successfully connected to Binance"
        if connection.last_error:
            success_message = "Connected to Binance (verification warning)"
        
        return ConnectionResponse(
            connected=True,
            status=connection.connection_status,
            message=success_message,
            environment=connection.exchange_environment
        )
        
    except HTTPException as he:
        print(f"DEBUG: HTTP Exception: {he.detail}")
        raise he
    except Exception as e:
        print(f"DEBUG: Unexpected error: {str(e)}")
        print(f"DEBUG: Error type: {type(e)}")
        import traceback
        print(f"DEBUG: Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@app.get("/binance/connection-status")
async def get_connection_status(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    print("DEBUG: get_connection_status called")
    print(f"DEBUG: User ID from token: {user_id}")
    
    try:
        # Look for active Binance connection
        connection = db.query(WalletConnection).filter(
            WalletConnection.user_id == user_id,
            WalletConnection.exchange_name == 'binance',
            WalletConnection.is_active == True,
            WalletConnection.connection_status.in_(('connected', 'warning'))
        ).first()
        
        connected = connection is not None
        print(f"DEBUG: Connection status: {connected}")
        
        if connection:
            # Update last used timestamp
            connection.last_used_at = func.now()
            db.commit()
        
        return ConnectionResponse(
            connected=connected,
            status=connection.connection_status if connection else None,
            environment=connection.exchange_environment if connection else None
        )
        
    except Exception as e:
        print(f"DEBUG: Error checking connection status: {str(e)}")
        return ConnectionResponse(connected=False)

@app.get("/balance")
async def get_user_balance(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """
    Get user's wallet balance from database (cached balance, no API call).
    Returns balance for all currencies tracked.
    """
    print("DEBUG: get_user_balance called (from database)")
    print(f"DEBUG: User ID from token: {user_id}")
    
    try:
        connection = db.query(WalletConnection).filter(
            WalletConnection.user_id == user_id,
            WalletConnection.exchange_name == 'binance',
            WalletConnection.is_active == True
        ).first()

        if not connection:
            raise HTTPException(status_code=404, detail="Wallet connection not found")
        
        # Return balance from database
        balance = connection.balance or {}
        
        # Convert to balances array format
        balances = []
        for asset, total in balance.items():
            balances.append({
                'asset': asset,
                'free': str(total)
            })
        
        print(f"DEBUG: Returning balance from database: {balance}")
        return {
            "status": "success",
            "balances": balances,
            "last_update": connection.last_balance_update.isoformat() if connection.last_balance_update else None
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"DEBUG: Error getting balance from DB: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to get balance: {str(e)}")

@app.get("/binance/balances")
async def get_balances(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    print("DEBUG: get_balances called")
    print(f"DEBUG: User ID from token: {user_id}")
    try:
        connection = db.query(WalletConnection).filter(
            WalletConnection.user_id == user_id,
            WalletConnection.exchange_name == 'binance',
            WalletConnection.is_active == True,
            WalletConnection.connection_status.in_(('connected', 'warning'))
        ).first()

        if not connection:
            print("DEBUG: No active connection found")
            raise HTTPException(status_code=401, detail="Not connected to Binance")

        print("DEBUG: Active connection found, fetching balances...")
        connection.last_used_at = func.now()
        db.commit()

        # Decrypt stored credentials
        try:
            api_key = decrypt_credential(connection.encrypted_api_key)
            secret_key = decrypt_credential(connection.encrypted_secret_key)
        except Exception as decrypt_error:
            logger.error(f"Failed to decrypt credentials: {decrypt_error}")
            raise HTTPException(status_code=500, detail="Failed to decrypt stored credentials")
        
        exchange = ccxt.binance({
            'apiKey': api_key,
            'secret': secret_key,
            'enableRateLimit': True,
            'timeout': 60000,
        })
            
        try:

            # Always enable sandbox mode for testnet
            if (connection.exchange_environment or "").lower() == "testnet":
                print("DEBUG: Using Binance testnet environment")
                exchange.set_sandbox_mode(True)
            else:
                print("DEBUG: Using Binance production environment")
                exchange.set_sandbox_mode(False)

            balance_data = await exchange.fetch_balance()

            totals = balance_data.get('total', {}) if isinstance(balance_data, dict) else {}
            free = balance_data.get('free', {}) if isinstance(balance_data, dict) else {}
            used = balance_data.get('used', {}) if isinstance(balance_data, dict) else {}

            # Define relevant coins to track
            RELEVANT_COINS = {
                # Trading pairs
                'BTC', 'ETH', 'SOL', 'DOGE', 'XRP',
                # Stablecoins
                'USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'FDUSD', 'USDE', 'USDP'
            }

            balances = []
            balance_dict = {}  # For storing in database
            
            for asset, total_amount in totals.items():
                # Skip if not a relevant coin
                if asset not in RELEVANT_COINS:
                    continue
                    
                try:
                    total_f = float(total_amount or 0)
                except Exception:
                    total_f = 0.0
                    
                # Skip invalid testnet values (18446 is an overflow/invalid value)
                if total_f > 0 and total_f < 18000:
                    balances.append({
                        'asset': asset,
                        'free': str(free.get(asset, 0)),
                        'locked': str(used.get(asset, 0))
                    })
                    # Store total balance for database
                    balance_dict[asset] = total_f

            # Update balance in database
            try:
                import json
                connection.balance = balance_dict
                connection.last_balance_update = func.now()
                db.commit()
                print(f"DEBUG: Updated balance in database (filtered): {balance_dict}")
            except Exception as balance_update_error:
                print(f"DEBUG: Failed to update balance in database: {balance_update_error}")
                # Don't fail the request if balance update fails
                pass

            print(f"DEBUG: Returning real balances for connection: {connection.uuid}")
            return {"balances": balances}

        except AuthenticationError as auth_err:
            connection.connection_status = 'error'
            connection.last_error = f"AuthenticationError: {auth_err}"
            db.commit()
            raise HTTPException(status_code=401, detail="Authentication failed: check API key/secret (testnet keys required)")
        except (ExchangeNotAvailable, NetworkError) as net_err:
            connection.connection_status = 'error'
            connection.last_error = f"Network/Exchange error: {net_err}"
            db.commit()
            raise HTTPException(status_code=503, detail="Binance testnet not reachable right now")
        except (RequestTimeout,) as rt:
            connection.connection_status = 'error'
            connection.last_error = f"RequestTimeout: {rt}"
            db.commit()
            raise HTTPException(status_code=504, detail="Timeout contacting Binance testnet")
        except (DDoSProtection, RateLimitExceeded) as rl:
            connection.connection_status = 'error'
            connection.last_error = f"RateLimit: {rl}"
            db.commit()
            raise HTTPException(status_code=429, detail="Rate limit / DDoS protection triggered")
        except Exception as api_error:
            connection.connection_status = 'error'
            connection.last_error = str(api_error)
            db.commit()
            import traceback
            print(f"DEBUG: Traceback fetching balances: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch balances: {api_error}")
        finally:
            try:
                await exchange.close()
            except Exception:
                pass
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"DEBUG: Error fetching balances: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to fetch balances: {str(e)}")

        
        
        
    # except HTTPException:
    #     raise
    # except Exception as e:
    #     print(f"DEBUG: Error fetching balances: {str(e)}")
    #     import traceback
    #     print(f"DEBUG: Traceback: {traceback.format_exc()}")
    #     raise HTTPException(status_code=500, detail=f"Failed to fetch balances: {str(e)}")

@app.post("/binance/disconnect")
async def disconnect_from_binance(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    print("DEBUG: disconnect_from_binance called")
    print(f"DEBUG: User ID from token: {user_id}")
    
    try:
        # Find active Binance connections
        connections = db.query(WalletConnection).filter(
            WalletConnection.user_id == user_id,
            WalletConnection.exchange_name == 'binance',
            WalletConnection.is_active == True
        ).all()
        
        environment = None
        if connections:
            print(f"DEBUG: Found {len(connections)} connections to disconnect")
            # Deactivate all active connections
            for connection in connections:
                environment = environment or connection.exchange_environment or "production"
                connection.is_active = False
                connection.connection_status = 'disconnected'
                print(f"DEBUG: Disconnected connection: {connection.uuid}")
            
            db.commit()
        else:
            print("DEBUG: No active connections found")
        
        return ConnectionResponse(
            connected=False,
            status="disconnected",
            message="Successfully disconnected from Binance",
            environment=environment or "production"
        )
        
    except Exception as e:
        print(f"DEBUG: Error disconnecting: {str(e)}")
        import traceback
        print(f"DEBUG: Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to disconnect: {str(e)}")

# The "userId: int" parameter tells FastAPI to expect a URL like "...?userId=1"
@app.get("/binance/credentials", response_model=CredentialsResponse)
async def get_binance_credentials(userId: int, db: Session = Depends(get_db)):
    """
    Retrieves the active Binance API key and secret for a SPECIFIC user.
    """
    print(f"DEBUG: /binance/credentials endpoint called for userId: {userId}")
    
    try:
        # We no longer use the hardcoded get_current_user_from_db function here.
        # We use the userId passed directly in the URL.
        connection = db.query(WalletConnection).filter(
            WalletConnection.user_id == userId, # <-- Use the userId from the request
            # WalletConnection.exchange_name == 'binance',
            # WalletConnection.is_active == True,
            # WalletConnection.connection_status == 'connected'
        ).first()

        if not connection:
            print(f"DEBUG: No active Binance connection found for userId: {userId}.")
            raise HTTPException(status_code=404, detail=f"Active Binance connection not found for userId: {userId}.")

        api_key = connection.encrypted_api_key
        secret_key = connection.encrypted_secret_key

        print(f"DEBUG: Found credentials for userId: {userId}. Sending API Key starting with: {api_key[:5]}...")
        # Decrypt credentials before returning
        try:
            api_key = decrypt_credential(connection.encrypted_api_key)
            secret_key = decrypt_credential(connection.encrypted_secret_key)
        except Exception as decrypt_error:
            logger.error(f"Failed to decrypt credentials: {decrypt_error}")
            raise HTTPException(status_code=500, detail="Failed to decrypt stored credentials")
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"DEBUG: Error fetching credentials for userId {userId}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while fetching credentials.")

# ...existing code...

if __name__ == "__main__":
    import uvicorn
    print("DEBUG: Starting server on port 8011")
    uvicorn.run(app, host="0.0.0.0", port=8011)
