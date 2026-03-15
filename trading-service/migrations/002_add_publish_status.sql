-- Migration: Add publish_status and reject_reason to strategies table
-- Date: 2026-03-15
-- Description: Supports user strategy publish workflow (private -> pending_review -> approved/rejected)

ALTER TABLE strategies
ADD COLUMN IF NOT EXISTS publish_status VARCHAR(50) DEFAULT 'private',
ADD COLUMN IF NOT EXISTS reject_reason TEXT;

-- Update constraint for type to include 'user_created' (already exists, but add publish_status check)
ALTER TABLE strategies
ADD CONSTRAINT chk_publish_status CHECK (
    publish_status IN ('private', 'pending_review', 'approved', 'rejected')
);

-- Default all existing user_created strategies to 'private', others to 'approved'
UPDATE strategies SET publish_status = 'approved' WHERE type IN ('default', 'marketplace');
UPDATE strategies SET publish_status = 'private' WHERE type = 'user_created' AND publish_status IS NULL;

COMMENT ON COLUMN strategies.publish_status IS 'private=only visible to owner, pending_review=awaiting admin, approved=in marketplace, rejected=denied by admin';
COMMENT ON COLUMN strategies.reject_reason IS 'Reason provided by admin when rejecting a publish request';
