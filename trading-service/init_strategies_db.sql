-- ============================================
-- Trading Strategies Database Schema
-- ============================================

CREATE TABLE IF NOT EXISTS strategies (
    id SERIAL PRIMARY KEY,
    strategy_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'default',
    parameters JSONB,
    python_class VARCHAR(200),
    python_module VARCHAR(200),
    strategy_file VARCHAR(500),
    price DECIMAL(10, 2) DEFAULT 0,
    author_id INTEGER,
    total_purchases INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_type CHECK (type IN ('default', 'marketplace', 'user_created'))
);

CREATE TABLE IF NOT EXISTS user_strategies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    strategy_id VARCHAR(100) NOT NULL,
    access_type VARCHAR(50) NOT NULL DEFAULT 'default',
    purchased_at TIMESTAMP,
    purchase_price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_access_type CHECK (access_type IN ('default', 'purchased', 'created')),
    CONSTRAINT uq_user_strategy UNIQUE(user_id, strategy_id)
);

CREATE INDEX IF NOT EXISTS idx_strategies_type ON strategies(type);
CREATE INDEX IF NOT EXISTS idx_strategies_author ON strategies(author_id);
CREATE INDEX IF NOT EXISTS idx_user_strategies_user ON user_strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_strategies_strategy ON user_strategies(strategy_id);

INSERT INTO strategies (strategy_id, name, description, type, python_class, python_module, price)
VALUES
(
    'alpha_momentum_breakout',
    'Alpha Momentum Breakout',
    'Capitalizes on high-volume volatility breakouts in major crypto pairs. Target ROI: ~14.5%, Win Rate: ~68%.',
    'default',
    'AlphaMomentumStrategy',
    'strategies.alpha_momentum',
    0.00
),
(
    'stablecoin_yield_harvester',
    'Stablecoin Yield Harvester',
    'Low-risk arbitrage and yield farming across decentralized exchanges. Target ROI: ~4.2%, Win Rate: ~95%.',
    'default',
    'YieldHarvesterStrategy',
    'strategies.yield_harvester',
    0.00
),
(
    'quantum_mean_reversion',
    'Quantum Mean Reversion',
    'Statistical mean reversion strategy utilizing Bollinger Bands and RSI anomalies. Target ROI: ~8.7%, Win Rate: ~72%.',
    'default',
    'QuantumReversionStrategy',
    'strategies.quantum_reversion',
    0.00
),
(
    'trend_follower_pro',
    'Trend Follower Pro',
    'Algorithmic trend-following system optimized for macro market shifts. Target ROI: ~11.2%, Win Rate: ~60%.',
    'default',
    'TrendFollowerStrategy',
    'strategies.trend_follower',
    0.00
),
(
    'blue_chip_accumulator',
    'Blue Chip Accumulator',
    'DCA and momentum-based accumulation for top 10 market cap coins. Target ROI: ~6.5%, Win Rate: ~80%.',
    'default',
    'BlueChipAccumulatorStrategy',
    'strategies.blue_chip_accumulator',
    0.00
),
(
    'flash_crash_sniper',
    'Flash Crash Sniper',
    'Places deep limit orders to catch flash crashes and immediate rebounds. High risk, high reward.',
    'marketplace',
    'FlashCrashSniperStrategy',
    'strategies.flash_crash_sniper',
    59.99
),
(
    'forex_scalper_ai',
    'Forex Scalper AI',
    'High-frequency scalping algorithm optimized for major forex pairs.',
    'marketplace',
    'ForexScalperStrategy',
    'strategies.forex_scalper',
    79.99
),
(
    'defi_liquidity_provider',
    'DeFi Liquidity Provider',
    'Automated impermanent loss hedging for AMM liquidity pools.',
    'marketplace',
    'DeFiLiquidityStrategy',
    'strategies.defi_liquidity',
    24.99
),
(
    'sentiment_analysis_bot',
    'Sentiment Analysis Bot',
    'Scrapes news feeds and social sentiment to front-run retail shifts.',
    'marketplace',
    'SentimentAnalysisStrategy',
    'strategies.sentiment_analysis',
    89.99
),
(
    'options_iron_condor',
    'Options Iron Condor',
    'Automated options selling strategy to collect premium in sideways markets.',
    'marketplace',
    'IronCondorStrategy',
    'strategies.iron_condor',
    34.99
)
ON CONFLICT (strategy_id) DO NOTHING;

-- Disabled for local setup because users table is not in alphintra_trading
-- INSERT INTO user_strategies (user_id, strategy_id, access_type)
-- SELECT DISTINCT u.id, s.strategy_id, 'default'
-- FROM users u
-- CROSS JOIN strategies s
-- WHERE s.type = 'default'
-- ON CONFLICT (user_id, strategy_id) DO NOTHING;

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