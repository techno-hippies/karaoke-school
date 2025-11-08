-- Migration: Add Unlock Protocol subscription lock fields to lens_accounts
-- Description: Tracks subscription locks deployed on Base Sepolia for artists (Spotify ID required)
--              TikTok creators do NOT get locks deployed.
-- Date: 2025-11-07

-- Add subscription lock columns to lens_accounts
ALTER TABLE lens_accounts 
  ADD COLUMN IF NOT EXISTS subscription_lock_address TEXT,
  ADD COLUMN IF NOT EXISTS subscription_lock_chain TEXT DEFAULT 'base-sepolia',
  ADD COLUMN IF NOT EXISTS subscription_lock_price TEXT DEFAULT '1.99',
  ADD COLUMN IF NOT EXISTS subscription_lock_currency TEXT DEFAULT 'ETH',
  ADD COLUMN IF NOT EXISTS subscription_lock_duration_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS subscription_lock_deployed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_lock_tx_hash TEXT;

-- Add index for querying locks
CREATE INDEX IF NOT EXISTS idx_lens_accounts_lock_address 
  ON lens_accounts(subscription_lock_address) 
  WHERE subscription_lock_address IS NOT NULL;

-- Add index for finding artists without locks deployed
CREATE INDEX IF NOT EXISTS idx_lens_accounts_needs_lock
  ON lens_accounts(account_type, spotify_artist_id)
  WHERE account_type = 'artist' 
    AND spotify_artist_id IS NOT NULL 
    AND subscription_lock_address IS NULL;

-- Add constraint to ensure lock address uniqueness
ALTER TABLE lens_accounts
  ADD CONSTRAINT unique_subscription_lock_address 
  UNIQUE (subscription_lock_address);

-- Add comment explaining the design decision
COMMENT ON COLUMN lens_accounts.subscription_lock_address IS 
  'Unlock Protocol lock address on Base Sepolia. Only deployed for artists with spotify_artist_id (NOT TikTok creators). Price: $1.99 ETH/month, Duration: 30 days.';

COMMENT ON COLUMN lens_accounts.subscription_lock_chain IS 
  'Blockchain network where lock is deployed (default: base-sepolia)';

COMMENT ON COLUMN lens_accounts.subscription_lock_price IS 
  'Subscription price as string (e.g., "1.99" for 1.99 ETH)';

COMMENT ON COLUMN lens_accounts.subscription_lock_currency IS 
  'Payment currency (ETH or ERC20 token symbol)';

COMMENT ON COLUMN lens_accounts.subscription_lock_duration_days IS 
  'Subscription duration in days (default: 30)';

COMMENT ON COLUMN lens_accounts.subscription_lock_deployed_at IS 
  'Timestamp when lock was deployed on-chain';

COMMENT ON COLUMN lens_accounts.subscription_lock_tx_hash IS 
  'Transaction hash of lock deployment';
