-- Migration: Add created_by to strategies table
-- Description: Distinguishes admin-created vs user-created strategies clearly,
--              regardless of type changes (e.g. user strategy promoted to 'marketplace')

ALTER TABLE strategies
ADD COLUMN IF NOT EXISTS created_by VARCHAR(10) DEFAULT 'admin'
    CHECK (created_by IN ('admin', 'user'));

-- Backfill: strategies with 'user_created' in module path = user, everything else = admin
UPDATE strategies SET created_by = 'user' WHERE type = 'user_created' OR python_module LIKE '%user_created%';
UPDATE strategies SET created_by = 'admin' WHERE created_by IS NULL;

COMMENT ON COLUMN strategies.created_by IS 'admin=uploaded by admin, user=uploaded by user';
