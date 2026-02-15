-- ============================================
-- Trading Strategies Database Schema
-- ============================================

-- Create strategies table
-- Stores all available trading strategies (default, marketplace, user-created)
CREATE TABLE IF NOT EXISTS strategies (
    id SERIAL PRIMARY KEY,
    strategy_id VARCHAR(100) UNIQUE NOT NULL,  -- Unique identifier (e.g., 'multi_timeframe_trend')
    name VARCHAR(200) NOT NULL,                 -- Display name
    description TEXT,                           -- Strategy description
    type VARCHAR(50) NOT NULL DEFAULT 'default', -- Type: 'default', 'marketplace', 'user_created'
    
    -- Strategy configuration
    parameters JSONB,                           -- Strategy-specific parameters (stop_loss, take_profit, etc.)
    python_class VARCHAR(200),                  -- Python class name (e.g., 'MultiTimeframeTrendStrategy')
    python_module VARCHAR(200),                 -- Python module path (e.g., 'strategies.multi_timeframe_trend')
    
    -- Marketplace info (if type = 'marketplace')
    price DECIMAL(10, 2) DEFAULT 0,            -- Price in USD (0 for free strategies)
    author_id INTEGER,                          -- User ID of creator (NULL for default strategies)
    total_purchases INTEGER DEFAULT 0,

    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_type CHECK (type IN ('default', 'marketplace', 'user_created'))
);

-- Create user_strategies table
-- Tracks which strategies each user has access to
CREATE TABLE IF NOT EXISTS user_strategies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,                   -- Foreign key to users table
    strategy_id VARCHAR(100) NOT NULL,          -- Foreign key to strategies.strategy_id
    
    -- Access info
    access_type VARCHAR(50) NOT NULL DEFAULT 'default', -- 'default', 'purchased', 'created'
    purchased_at TIMESTAMP,                     -- When strategy was purchased (NULL for default/created)
    purchase_price DECIMAL(10, 2),             -- Price paid (NULL for default/created)
    
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_access_type CHECK (access_type IN ('default', 'purchased', 'created')),
    CONSTRAINT uq_user_strategy UNIQUE(user_id, strategy_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_strategies_type ON strategies(type);
CREATE INDEX IF NOT EXISTS idx_strategies_author ON strategies(author_id);
CREATE INDEX IF NOT EXISTS idx_user_strategies_user ON user_strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_strategies_strategy ON user_strategies(strategy_id);

-- ============================================
-- Insert Default Strategies
-- ============================================

INSERT INTO strategies (strategy_id, name, description, type, python_class, python_module) 
VALUES 
(
    'multi_timeframe_trend',
    'Multi-Timeframe Trend',
    'A conservative strategy that uses multiple timeframes (5m, 15m, 1h) to identify strong trends with high confidence. Analyzes trend alignment across timeframes and uses moving averages (EMA 20, 50, 200) to confirm trend direction. Best suited for trending markets with clear directional momentum.',
    'default',
    'MultiTimeframeTrendStrategy',
    'strategies.multi_timeframe_trend'
),
(
    'rsi_mean_reversion',
    'RSI Mean Reversion',
    'A balanced strategy that uses RSI (Relative Strength Index) to identify oversold (RSI < 30) and overbought (RSI > 70) conditions for mean reversion trades. Includes built-in risk management with 2% stop loss and 3% take profit levels. Effective in ranging markets with strong support/resistance levels.',
    'default',
    'RSIMeanReversionStrategy',
    'strategies.rsi_mean_reversion'
),
(
    'macd_momentum',
    'MACD Momentum',
    'A momentum-based strategy using MACD (Moving Average Convergence Divergence) to identify trend changes and momentum shifts. Generates buy signals on MACD crossover above signal line and sell signals on crossover below. Works well in volatile markets with clear momentum swings.',
    'default',
    'MACDMomentumStrategy',
    'strategies.macd_momentum'
)
ON CONFLICT (strategy_id) DO NOTHING;

-- ============================================
-- Grant Default Strategies to All Users
-- Note: This is a one-time operation. In production, you would
-- grant access to new users during registration.
-- ============================================

-- This will grant access to all existing users. 
-- For new users, the application should automatically grant
-- access to all default strategies during user registration.

INSERT INTO user_strategies (user_id, strategy_id, access_type)
SELECT DISTINCT u.id, s.strategy_id, 'default'
FROM users u
CROSS JOIN strategies s
WHERE s.type = 'default'
ON CONFLICT (user_id, strategy_id) DO NOTHING;

-- ============================================
-- Helper Functions
-- ============================================

-- Function to grant default strategies to a new user
CREATE OR REPLACE FUNCTION grant_default_strategies_to_user(p_user_id INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_strategies (user_id, strategy_id, access_type)
    SELECT p_user_id, strategy_id, 'default'
    FROM strategies
    WHERE type = 'default'
    ON CONFLICT (user_id, strategy_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to get all strategies accessible by a user
CREATE OR REPLACE FUNCTION get_user_strategies(p_user_id INTEGER)
RETURNS TABLE (
    strategy_id VARCHAR(100),
    name VARCHAR(200),
    description TEXT,
    type VARCHAR(50),
    access_type VARCHAR(50),
    python_class VARCHAR(200),
    python_module VARCHAR(200)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.strategy_id,
        s.name,
        s.description,
        s.type,
        us.access_type,
        s.python_class,
        s.python_module
    FROM strategies s
    INNER JOIN user_strategies us ON s.strategy_id = us.strategy_id
    WHERE us.user_id = p_user_id
    ORDER BY 
        CASE us.access_type 
            WHEN 'default' THEN 1 
            WHEN 'created' THEN 2 
            WHEN 'purchased' THEN 3 
        END,
        s.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Sample Queries
-- ============================================

-- Get all strategies for a specific user
-- SELECT * FROM get_user_strategies(1);

-- Get only default strategies
-- SELECT * FROM strategies WHERE type = 'default';

-- Get marketplace strategies
-- SELECT * FROM strategies WHERE type = 'marketplace' ORDER BY total_purchases DESC;
