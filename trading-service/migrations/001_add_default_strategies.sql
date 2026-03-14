-- ============================================
-- Migration: Add Default Trading Strategies
-- Version: 001
-- Description: Creates default strategies that are available on any device
-- ============================================

-- Insert default strategies
INSERT INTO strategies (
    strategy_id, 
    name, 
    description, 
    type, 
    python_class, 
    python_module,
    parameters,
    created_at,
    updated_at
) 
VALUES 
(
    'multi_timeframe_trend',
    'Multi-Timeframe Trend',
    'A conservative strategy that uses multiple timeframes (5m, 15m, 1h) to identify strong trends with high confidence. Analyzes trend alignment across timeframes and uses moving averages (EMA 20, 50, 200) to confirm trend direction. Best suited for trending markets with clear directional momentum.',
    'default',
    'MultiTimeframeTrendStrategy',
    'strategies.multi_timeframe_trend',
    '{"timeframes": ["15m", "1h", "4h"], "ema_periods": [20, 50, 200], "rsi_period": 14, "macd_params": [12, 26, 9]}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'rsi_mean_reversion',
    'RSI Mean Reversion',
    'A balanced strategy that uses RSI (Relative Strength Index) to identify oversold (RSI < 30) and overbought (RSI > 70) conditions for mean reversion trades. Includes built-in risk management with 2% stop loss and 3% take profit levels. Effective in ranging markets with strong support/resistance levels.',
    'default',
    'RSIMeanReversionStrategy',
    'strategies.rsi_mean_reversion',
    '{"rsi_period": 14, "oversold_threshold": 30, "overbought_threshold": 70, "stop_loss_pct": 2.0, "take_profit_pct": 3.0}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'macd_momentum',
    'MACD Momentum',
    'A momentum-based strategy using MACD (Moving Average Convergence Divergence) to identify trend changes and momentum shifts. Generates buy signals on MACD crossover above signal line and sell signals on crossover below. Works well in volatile markets with clear momentum swings.',
    'default',
    'MACDMomentumStrategy',
    'strategies.macd_momentum',
    '{"fast_period": 12, "slow_period": 26, "signal_period": 9, "histogram_threshold": 0.0}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (strategy_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    parameters = EXCLUDED.parameters,
    updated_at = CURRENT_TIMESTAMP;

-- Grant default strategies to all existing users
INSERT INTO user_strategies (user_id, strategy_id, access_type, created_at)
SELECT DISTINCT u.id, s.strategy_id, 'default', CURRENT_TIMESTAMP
FROM users u
CROSS JOIN strategies s
WHERE s.type = 'default'
ON CONFLICT (user_id, strategy_id) DO NOTHING;

-- Log migration completion
DO $$
DECLARE
    strategy_count INTEGER;
    user_strategy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO strategy_count FROM strategies WHERE type = 'default';
    SELECT COUNT(*) INTO user_strategy_count FROM user_strategies WHERE access_type = 'default';
    
    RAISE NOTICE '✅ Migration 001 completed successfully';
    RAISE NOTICE '   - % default strategies added/updated', strategy_count;
    RAISE NOTICE '   - % user-strategy access grants created', user_strategy_count;
END $$;
