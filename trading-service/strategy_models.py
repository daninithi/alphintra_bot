"""
Strategy Models
Handles strategy data and database operations
"""
from dataclasses import dataclass
from typing import List, Optional, Dict, Tuple
from datetime import datetime
import psycopg2
import psycopg2.extras
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
    publish_status: str = 'private'  # 'private', 'pending_review', 'approved', 'rejected'
    reject_reason: Optional[str] = None
    created_by: str = 'admin'  # 'admin' or 'user'
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
            'publish_status': self.publish_status,
            'reject_reason': self.reject_reason,
            'created_by': self.created_by,
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
                database=os.getenv("DB_NAME", "alphintra_auth"),  # Strategies stored in auth database
                user=os.getenv("DB_USER", "myapp"),
                password=os.getenv("DB_PASSWORD", "alphintra123"),
                port=os.getenv("DB_PORT", "5432")
            )
            logger.info("Connected to strategy database")
        except Exception as e:
            logger.error(f"Failed to connect to strategy database: {e}")
            raise
    
    def is_user_subscribed(self, user_id: int) -> bool:
        """Returns True if user has an active subscription"""
        try:
            with self.connection.cursor() as cursor:
                cursor.execute("""
                    SELECT subscription_status, subscription_end_date
                    FROM users WHERE id = %s
                """, (user_id,))
                row = cursor.fetchone()
                if not row:
                    return False
                status, end_date = row
                from datetime import datetime
                return status == 'active' and (end_date is None or end_date > datetime.now())
        except Exception as e:
            logger.error(f"Failed to check subscription: {e}")
            return False

    def count_user_imported_strategies(self, user_id: int) -> int:
        """Count user's imported/created strategies (user_created + marketplace authored)"""
        try:
            with self.connection.cursor() as cursor:
                cursor.execute("""
                    SELECT COUNT(*) FROM strategies
                    WHERE author_id = %s AND type IN ('user_created', 'marketplace')
                """, (user_id,))
                return cursor.fetchone()[0]
        except Exception as e:
            logger.error(f"Failed to count imported strategies: {e}")
            return 0

    def get_user_strategies(self, user_id: int) -> List[Strategy]:
        """
        Get all strategies accessible by a user
        - All default strategies (shown to everyone)
        - User's own created strategies
        - Purchased strategies
        """
        try:
            with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT * FROM (
                        -- Get all default strategies (available to everyone)
                        SELECT 
                            s.strategy_id, s.name, s.description, s.type,
                            'default' as access_type,
                            s.python_class, s.python_module, s.strategy_file,
                            s.parameters, s.price, s.author_id, s.total_purchases,
                            COALESCE(s.publish_status, 'approved') as publish_status,
                            s.reject_reason, COALESCE(s.created_by, 'admin') as created_by,
                            s.created_at, s.updated_at
                        FROM strategies s
                        WHERE s.type = 'default'
                        
                        UNION
                        
                        -- Get user's own created strategies (private/pending/rejected)
                        SELECT 
                            s.strategy_id, s.name, s.description, s.type,
                            'created' as access_type,
                            s.python_class, s.python_module, s.strategy_file,
                            s.parameters, s.price, s.author_id, s.total_purchases,
                            COALESCE(s.publish_status, 'private') as publish_status,
                            s.reject_reason, COALESCE(s.created_by, 'user') as created_by,
                            s.created_at, s.updated_at
                        FROM strategies s
                        WHERE s.type = 'user_created' AND s.author_id = %s
                        
                        UNION
                        
                        -- Get user's own published (marketplace) strategies
                        SELECT 
                            s.strategy_id, s.name, s.description, s.type,
                            'created' as access_type,
                            s.python_class, s.python_module, s.strategy_file,
                            s.parameters, s.price, s.author_id, s.total_purchases,
                            COALESCE(s.publish_status, 'approved') as publish_status,
                            s.reject_reason, COALESCE(s.created_by, 'user') as created_by,
                            s.created_at, s.updated_at
                        FROM strategies s
                        WHERE s.type = 'marketplace' AND s.author_id = %s AND s.created_by = 'user'
                        
                        UNION
                        
                        -- Get purchased strategies
                        SELECT 
                            s.strategy_id, s.name, s.description, s.type,
                            us.access_type,
                            s.python_class, s.python_module, s.strategy_file,
                            s.parameters, s.price, s.author_id, s.total_purchases,
                            COALESCE(s.publish_status, 'approved') as publish_status,
                            s.reject_reason, COALESCE(s.created_by, 'admin') as created_by,
                            s.created_at, s.updated_at
                        FROM strategies s
                        INNER JOIN user_strategies us ON s.strategy_id = us.strategy_id
                        WHERE us.user_id = %s AND us.access_type = 'purchased'
                    ) AS combined_strategies
                    ORDER BY 
                        CASE access_type 
                            WHEN 'default' THEN 1 
                            WHEN 'created' THEN 2 
                            WHEN 'purchased' THEN 3 
                        END,
                        name
                """, (user_id, user_id, user_id))
                
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
                        strategy_id, name, description, type,
                        python_class, python_module, strategy_file,
                        parameters, price, author_id, total_purchases,
                        COALESCE(publish_status, 'private') as publish_status,
                        reject_reason, COALESCE(created_by, 'admin') as created_by,
                        created_at, updated_at
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
                        strategy_id, name, description, type,
                        python_class, python_module, strategy_file,
                        parameters, price, author_id, total_purchases,
                        COALESCE(publish_status, 'approved') as publish_status,
                        COALESCE(created_by, 'admin') as created_by,
                        created_at, updated_at
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
                        strategy_id, name, description, type,
                        python_class, python_module, strategy_file,
                        parameters, price, author_id, total_purchases,
                        COALESCE(publish_status, 'approved') as publish_status,
                        COALESCE(created_by, 'admin') as created_by,
                        created_at, updated_at
                    FROM strategies
                    WHERE type = 'marketplace' AND created_by = 'admin'
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
    
    def create_strategy(
        self,
        strategy_id: str,
        name: str,
        description: str,
        strategy_type: str,
        price: float,
        python_class: str,
        python_module: str,
        strategy_file: str,
        parameters: Optional[Dict] = None,
        author_id: Optional[int] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Create a new strategy
        
        Args:
            strategy_id: Unique strategy identifier
            name: Strategy name
            description: Strategy description
            strategy_type: Type ('default' or 'marketplace')
            price: Strategy price (0 for free)
            python_class: Python class name
            python_module: Python module path
            strategy_file: Relative file path
            parameters: Optional strategy parameters
            author_id: Optional author user ID
        
        Returns:
            Tuple of (success, error_message)
        """
        try:
            with self.connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO strategies 
                    (strategy_id, name, description, type, price, python_class, 
                     python_module, strategy_file, parameters, author_id,
                     created_by, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'admin',
                            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, (
                    strategy_id, name, description, strategy_type, price,
                    python_class, python_module, strategy_file, 
                    psycopg2.extras.Json(parameters) if parameters else None,
                    author_id
                ))
                
                self.connection.commit()
                logger.info(f"Created strategy: {strategy_id}")
                return True, None
                
        except psycopg2.IntegrityError as e:
            logger.error(f"Strategy already exists: {e}")
            self.connection.rollback()
            return False, "Strategy with this ID already exists"
        except Exception as e:
            logger.error(f"Failed to create strategy: {e}")
            self.connection.rollback()
            return False, str(e)
    
    def update_strategy(
        self,
        strategy_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        price: Optional[float] = None,
        parameters: Optional[Dict] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Update strategy metadata (does not update file)
        
        Args:
            strategy_id: Strategy ID to update
            name: New name (optional)
            description: New description (optional)
            price: New price (optional)
            parameters: New parameters (optional)
        
        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Build dynamic UPDATE query
            updates = []
            values = []
            
            if name is not None:
                updates.append("name = %s")
                values.append(name)
            
            if description is not None:
                updates.append("description = %s")
                values.append(description)
            
            if price is not None:
                updates.append("price = %s")
                values.append(price)
            
            if parameters is not None:
                updates.append("parameters = %s")
                values.append(psycopg2.extras.Json(parameters))
            
            if not updates:
                return False, "No fields to update"
            
            updates.append("updated_at = CURRENT_TIMESTAMP")
            values.append(strategy_id)
            
            with self.connection.cursor() as cursor:
                query = f"""
                    UPDATE strategies 
                    SET {', '.join(updates)}
                    WHERE strategy_id = %s
                """
                cursor.execute(query, values)
                
                if cursor.rowcount == 0:
                    self.connection.rollback()
                    return False, "Strategy not found"
                
                self.connection.commit()
                logger.info(f"Updated strategy: {strategy_id}")
                return True, None
                
        except Exception as e:
            logger.error(f"Failed to update strategy: {e}")
            self.connection.rollback()
            return False, str(e)
    
    def delete_strategy(self, strategy_id: str) -> Tuple[bool, Optional[str]]:
        """
        Delete a strategy (hard delete)
        
        Args:
            strategy_id: Strategy ID to delete
        
        Returns:
            Tuple of (success, error_message)
        """
        try:
            with self.connection.cursor() as cursor:
                # First, check if strategy exists
                cursor.execute("""
                    SELECT strategy_file FROM strategies WHERE strategy_id = %s
                """, (strategy_id,))
                
                result = cursor.fetchone()
                if not result:
                    return False, "Strategy not found"
                
                # Delete strategy
                cursor.execute("""
                    DELETE FROM strategies WHERE strategy_id = %s
                """, (strategy_id,))
                
                self.connection.commit()
                logger.info(f"Deleted strategy: {strategy_id}")
                return True, None
                
        except Exception as e:
            logger.error(f"Failed to delete strategy: {e}")
            self.connection.rollback()
            return False, str(e)
    
    def get_all_strategies_admin(self, strategy_type: Optional[str] = None) -> List[Strategy]:
        """
        Get all strategies for admin view (no user filtering)
        
        Args:
            strategy_type: Optional filter by type ('default', 'marketplace', 'user_created')
        
        Returns:
            List of all strategies
        """
        try:
            with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
                if strategy_type:
                    cursor.execute("""
                        SELECT 
                            strategy_id, name, description, type, python_class,
                            python_module, strategy_file, parameters, price,
                            author_id, total_purchases,
                            COALESCE(publish_status, 'approved') as publish_status,
                            reject_reason, COALESCE(created_by, 'admin') as created_by,
                            created_at, updated_at
                        FROM strategies
                        WHERE type = %s
                        ORDER BY created_at DESC
                    """, (strategy_type,))
                else:
                    cursor.execute("""
                        SELECT 
                            strategy_id, name, description, type, python_class,
                            python_module, strategy_file, parameters, price,
                            author_id, total_purchases,
                            COALESCE(publish_status, 'approved') as publish_status,
                            reject_reason, COALESCE(created_by, 'admin') as created_by,
                            created_at, updated_at
                        FROM strategies
                        ORDER BY created_at DESC
                    """)
                
                rows = cursor.fetchall()
                strategies = [Strategy(**dict(row)) for row in rows]
                
                logger.info(f"Retrieved {len(strategies)} strategies for admin")
                return strategies
                
        except Exception as e:
            logger.error(f"Failed to get strategies for admin: {e}")
            return []

    # ============================================
    # User Strategy Methods
    # ============================================

    def create_user_strategy(
        self,
        strategy_id: str,
        name: str,
        description: str,
        price: float,
        python_class: str,
        python_module: str,
        strategy_file: str,
        author_id: int,
        parameters: Optional[Dict] = None
    ) -> Tuple[bool, Optional[str]]:
        """Create a private user-imported strategy."""
        try:
            with self.connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO strategies 
                    (strategy_id, name, description, type, price, python_class, 
                     python_module, strategy_file, parameters, author_id,
                     publish_status, created_by, created_at, updated_at)
                    VALUES (%s, %s, %s, 'user_created', %s, %s, %s, %s, %s, %s,
                            'private', 'user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, (
                    strategy_id, name, description, price,
                    python_class, python_module, strategy_file,
                    psycopg2.extras.Json(parameters) if parameters else None,
                    author_id
                ))
                self.connection.commit()
                logger.info(f"Created user strategy: {strategy_id} for user {author_id}")
                return True, None
        except psycopg2.IntegrityError as e:
            self.connection.rollback()
            return False, "Strategy with this ID already exists"
        except Exception as e:
            self.connection.rollback()
            return False, str(e)

    def get_all_user_marketplace_strategies(self) -> List[Strategy]:
        """Admin view: all user-submitted strategies approved in the marketplace."""
        try:
            with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT 
                        s.strategy_id, s.name, s.description, s.type,
                        NULL AS python_class, NULL AS python_module,
                        NULL AS strategy_file, NULL AS parameters,
                        s.price, s.author_id, s.total_purchases,
                        COALESCE(s.publish_status, 'private') as publish_status,
                        NULL AS reject_reason,
                        COALESCE(s.created_by, 'user') as created_by,
                        s.created_at, s.updated_at,
                        'created' as access_type,
                        u.email as author_email
                    FROM strategies s
                    LEFT JOIN users u ON u.id = s.author_id
                    WHERE s.created_by = 'user'
                      AND s.type = 'marketplace' AND s.publish_status = 'approved'
                    ORDER BY s.total_purchases DESC, s.created_at DESC
                """)
                rows = cursor.fetchall()
                result = []
                for row in rows:
                    d = dict(row)
                    author_email = d.pop('author_email', None)
                    s = Strategy(**d)
                    s_dict = s.to_dict()
                    s_dict['author_email'] = author_email
                    result.append(s_dict)
                return result
        except Exception as e:
            logger.error(f"Failed to get all user marketplace strategies: {e}")
            return []

    def get_user_marketplace_strategies_admin(self, user_id: int) -> List[Strategy]:
        """Admin view: get a user's strategies that are in the marketplace (approved/published)."""
        try:
            with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT 
                        strategy_id, name, description, type,
                        NULL AS python_class, NULL AS python_module,
                        NULL AS strategy_file, NULL AS parameters,
                        price, author_id, total_purchases,
                        COALESCE(publish_status, 'private') as publish_status,
                        NULL AS reject_reason,
                        COALESCE(created_by, 'user') as created_by,
                        created_at, updated_at,
                        'created' as access_type
                    FROM strategies
                    WHERE author_id = %s AND created_by = 'user'
                      AND type = 'marketplace' AND publish_status = 'approved'
                    ORDER BY created_at DESC
                """, (user_id,))
                rows = cursor.fetchall()
                return [Strategy(**dict(row)) for row in rows]
        except Exception as e:
            logger.error(f"Failed to get user marketplace strategies for admin: {e}")
            return []

    def get_user_imported_strategies(self, user_id: int) -> List[Strategy]:
        """Get strategies imported/created by a specific user."""
        try:
            with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT 
                        strategy_id, name, description, type, python_class,
                        python_module, strategy_file, parameters, price,
                        author_id, total_purchases,
                        COALESCE(publish_status, 'private') as publish_status,
                        reject_reason, COALESCE(created_by, 'user') as created_by,
                        created_at, updated_at,
                        'created' as access_type
                    FROM strategies
                    WHERE author_id = %s AND created_by = 'user'
                    ORDER BY created_at DESC
                """, (user_id,))
                rows = cursor.fetchall()
                return [Strategy(**dict(row)) for row in rows]
        except Exception as e:
            logger.error(f"Failed to get user imported strategies: {e}")
            return []

    def request_publish_strategy(
        self,
        strategy_id: str,
        user_id: int,
        price: float
    ) -> Tuple[bool, Optional[str]]:
        """User requests to publish their strategy to the marketplace."""
        try:
            with self.connection.cursor() as cursor:
                # Verify ownership
                cursor.execute("""
                    SELECT strategy_id, publish_status 
                    FROM strategies 
                    WHERE strategy_id = %s AND author_id = %s AND type = 'user_created'
                """, (strategy_id, user_id))
                row = cursor.fetchone()
                if not row:
                    return False, "Strategy not found or you don't own it"
                if row[1] == 'pending_review':
                    return False, "Publish request already pending"
                if row[1] == 'approved':
                    return False, "Strategy is already published"
                if row[1] == 'rejected':
                    return False, "This strategy was rejected and cannot be re-submitted"
                if row[1] != 'private':
                    return False, "Strategy cannot be submitted for review in its current state"

                cursor.execute("""
                    UPDATE strategies
                    SET publish_status = 'pending_review',
                        price = %s,
                        reject_reason = NULL,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE strategy_id = %s AND author_id = %s
                """, (price, strategy_id, user_id))
                self.connection.commit()
                logger.info(f"Publish request submitted for strategy {strategy_id} by user {user_id}")
                return True, None
        except Exception as e:
            self.connection.rollback()
            return False, str(e)

    def get_pending_review_strategies(self) -> List[Strategy]:
        """Get all strategies awaiting admin review."""
        try:
            with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT 
                        strategy_id, name, description, type, python_class,
                        python_module, strategy_file, parameters, price,
                        author_id, total_purchases, publish_status,
                        reject_reason, created_at, updated_at
                    FROM strategies
                    WHERE publish_status = 'pending_review'
                    ORDER BY updated_at ASC
                """)
                rows = cursor.fetchall()
                return [Strategy(**dict(row)) for row in rows]
        except Exception as e:
            logger.error(f"Failed to get pending review strategies: {e}")
            return []

    def approve_strategy(self, strategy_id: str) -> Tuple[bool, Optional[str]]:
        """Admin approves a pending publish request — moves to marketplace."""
        try:
            with self.connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE strategies
                    SET type = 'marketplace',
                        publish_status = 'approved',
                        reject_reason = NULL,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE strategy_id = %s AND publish_status = 'pending_review'
                """, (strategy_id,))
                if cursor.rowcount == 0:
                    return False, "Strategy not found or not pending review"
                self.connection.commit()
                logger.info(f"Strategy approved: {strategy_id}")
                return True, None
        except Exception as e:
            self.connection.rollback()
            return False, str(e)

    def reject_strategy(self, strategy_id: str, reason: str) -> Tuple[bool, Optional[str]]:
        """Admin rejects a pending publish request."""
        try:
            with self.connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE strategies
                    SET publish_status = 'rejected',
                        reject_reason = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE strategy_id = %s AND publish_status = 'pending_review'
                """, (reason, strategy_id))
                if cursor.rowcount == 0:
                    return False, "Strategy not found or not pending review"
                self.connection.commit()
                logger.info(f"Strategy rejected: {strategy_id} — {reason}")
                return True, None
        except Exception as e:
            self.connection.rollback()
            return False, str(e)
    
    def close(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
            logger.info("Closed strategy database connection")
    
    def __del__(self):
        """Cleanup on deletion"""
        self.close()
