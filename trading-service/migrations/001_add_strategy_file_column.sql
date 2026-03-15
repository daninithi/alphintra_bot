-- Migration: Add strategy_file column
-- Date: 2026-03-14
-- Description: Add strategy_file column to store Python file paths

-- Add strategy_file column if not exists
ALTER TABLE strategies 
ADD COLUMN IF NOT EXISTS strategy_file VARCHAR(500);

-- Optional: Add comment
COMMENT ON COLUMN strategies.strategy_file IS 'Relative path to the Python strategy file from strategies directory';
