"""
Strategy Models
Handles strategy data and database operations
"""
from dataclasses import dataclass
from typing import List, Optional, Dict
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
from logger import setup_logger

# Load environment variables
load_dotenv()

logger = setup_logger("StrategyModels", "INFO")


@dataclass
class Strategy:
    """Strategy data model"""
    strategy_id: str
    name: str
    description: str
    type: str  # 'default', 'marketplace', 'user_created'
    access_type: Optional[str] = None  # 'default', 'purchased', 'created'
    python_class: Optional[str] = None
    python_module: Optional[str] = None
    strategy_file: Optional[str] = None  # Path to strategy file
    parameters: Optional[Dict] = None
    price: float = 0.0
    author_id: Optional[int] = None
    total_purchases: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization"""
        return {
            'strategy_id': self.strategy_id,
            'name': self.name,
            'description': self.description,
            'type': self.type,
            'access_type': self.access_type,
            'python_class': self.python_class,
            'python_module': self.python_module,
            'strategy_file': self.strategy_file,
            'parameters': self.parameters,
            'price': float(self.price) if self.price else 0.0,
            'author_id': self.author_id,
            'total_purchases': self.total_purchases,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class StrategyDB:
    """Database operations for strategies"""
    
    def __init__(self):
        self.connection = None
        self.connect()
    
    def connect(self):
        """Establish database connection"""
        try:
            self.connection = psycopg2.connect(
                host=os.getenv("DB_HOST", "localhost"),
                database=os.getenv("DB_NAME", "alphintra_auth"),
                user=os.getenv("DB_USER", "alphintra"),
                password=os.getenv("DB_PASSWORD", "alphintra123"),
                port=os.getenv("DB_PORT", "5432")
            )
            logger.info("Connected to strategy database")
        except Exception as e:
            logger.error(f"Failed to connect to strategy database: {e}")
            raise
    
    def get_user_strategies(self, user_id: int) -> List[Strategy]:
        """
        Get all strategies accessible by a user
        Includes default, created, and purchased strategies
        """
        try:
            with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT 
                        s.strategy_id,
                        s.name,
                        s.description,
                        s.type,
                        us.access_type,
                        s.python_class,
                        s.python_module,
                        s.strategy_file,
                        s.parameters,
                        s.price,
                        s.author_id,
                        s.total_purchases,
                        s.created_at,
                        s.updated_at
                    FROM strategies s
                    INNER JOIN user_strategies us ON s.strategy_id = us.strategy_id
                    WHERE us.user_id = %s
                    ORDER BY 
                        CASE us.access_type 
                            WHEN 'default' THEN 1 
                            WHEN 'created' THEN 2 
                            WHEN 'purchased' THEN 3 
                        END,
                        s.name
                """, (user_id,))
                
                rows = cursor.fetchall()
                strategies = [Strategy(**dict(row)) for row in rows]
                
                logger.info(f"Retrieved {len(strategies)} strategies for user {user_id}")
                return strategies
                
        except Exception as e:
            logger.error(f"Failed to get user strategies: {e}")
            return []
    
    def get_strategy_by_id(self, strategy_id: str) -> Optional[Strategy]:
        """Get a specific strategy by ID"""
        try:
            with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT 
                        strategy_id,
                        name,
                        description,
                        type,
                        python_class,
                        python_module,
                        strategy_file,
                        parameters,
                        price,
                        author_id,
                        total_purchases,
                        created_at,
                        updated_at
                    FROM strategies
                    WHERE strategy_id = %s
                """, (strategy_id,))
                
                row = cursor.fetchone()
                if row:
                    return Strategy(**dict(row))
                return None
                
        except Exception as e:
            logger.error(f"Failed to get strategy {strategy_id}: {e}")
            return None
    
    def get_default_strategies(self) -> List[Strategy]:
        """Get all default (system-provided) strategies"""
        try:
            with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT 
                        strategy_id,
                        name,
                        description,
                        type,
                        python_class,
                        python_module,
                        strategy_file,
                        parameters,
                        price,
                        author_id,
                        total_purchases,
                        created_at,
                        updated_at
                    FROM strategies
                    WHERE type = 'default'
                    ORDER BY name
                """)
                
                rows = cursor.fetchall()
                strategies = [Strategy(**dict(row)) for row in rows]
                
                logger.info(f"Retrieved {len(strategies)} default strategies")
                return strategies
                
        except Exception as e:
            logger.error(f"Failed to get default strategies: {e}")
            return []
    
    def grant_default_strategies_to_user(self, user_id: int) -> bool:
        """
        Grant access to all default strategies for a new user
        Should be called during user registration
        """
        try:
            with self.connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO user_strategies (user_id, strategy_id, access_type)
                    SELECT %s, strategy_id, 'default'
                    FROM strategies
                    WHERE type = 'default'
                    ON CONFLICT (user_id, strategy_id) DO NOTHING
                """, (user_id,))
                
                self.connection.commit()
                logger.info(f"Granted default strategies to user {user_id}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to grant default strategies to user {user_id}: {e}")
            self.connection.rollback()
            return False
    
    def track_strategy_usage(self, user_id: int, strategy_id: str) -> bool:
        """Track when a user uses a strategy (placeholder for future implementation)"""
        # Note: times_used and last_used columns removed from schema
        # This method is kept for API compatibility but does nothing
        logger.info(f"Strategy usage tracking called for {strategy_id} by user {user_id} (no-op)")
        return True
    
    def get_marketplace_strategies(self) -> List[Strategy]:
        """Get all marketplace strategies (available for purchase)"""
        try:
            with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT 
                        strategy_id,
                        name,
                        description,
                        type,
                        python_class,
                        python_module,
                        strategy_file,
                        parameters,
                        price,
                        author_id,
                        total_purchases,
                        created_at,
                        updated_at
                    FROM strategies
                    WHERE type = 'marketplace'
                    ORDER BY total_purchases DESC, name
                """)
                
                rows = cursor.fetchall()
                strategies = [Strategy(**dict(row)) for row in rows]
                
                logger.info(f"Retrieved {len(strategies)} marketplace strategies")
                return strategies
                
        except Exception as e:
            logger.error(f"Failed to get marketplace strategies: {e}")
            return []
    
    def purchase_strategy(self, user_id: int, strategy_id: str, price: float) -> bool:
        """
        Purchase a marketplace strategy
        Grants user access to the strategy
        """
        try:
            with self.connection.cursor() as cursor:
                # Check if strategy exists and is purchasable
                cursor.execute("""
                    SELECT type, price 
                    FROM strategies 
                    WHERE strategy_id = %s
                """, (strategy_id,))
                
                result = cursor.fetchone()
                if not result:
                    logger.error(f"Strategy {strategy_id} not found")
                    return False
                
                strategy_type, strategy_price = result
                
                if strategy_type != 'marketplace':
                    logger.error(f"Strategy {strategy_id} is not a marketplace strategy")
                    return False
                
                # Grant access to user
                cursor.execute("""
                    INSERT INTO user_strategies 
                    (user_id, strategy_id, access_type, purchased_at, purchase_price)
                    VALUES (%s, %s, 'purchased', CURRENT_TIMESTAMP, %s)
                    ON CONFLICT (user_id, strategy_id) DO NOTHING
                """, (user_id, strategy_id, price))
                
                # Update total purchases
                cursor.execute("""
                    UPDATE strategies 
                    SET total_purchases = total_purchases + 1
                    WHERE strategy_id = %s
                """, (strategy_id,))
                
                self.connection.commit()
                logger.info(f"User {user_id} purchased strategy {strategy_id} for ${price}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to purchase strategy: {e}")
            self.connection.rollback()
            return False
    
    def close(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
            logger.info("Closed strategy database connection")
    
    def __del__(self):
        """Cleanup on deletion"""
        self.close()
