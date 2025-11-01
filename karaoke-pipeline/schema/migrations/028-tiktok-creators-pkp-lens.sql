-- Migration 028: Add PKP and Lens references to tiktok_creators
-- Purpose: Link TikTok creators to their PKP and Lens accounts
-- Depends on: 026-pkp-accounts.sql, 027-lens-accounts.sql

-- Add PKP and Lens reference columns
ALTER TABLE tiktok_creators
  ADD COLUMN IF NOT EXISTS pkp_address TEXT REFERENCES pkp_accounts(pkp_address),
  ADD COLUMN IF NOT EXISTS lens_handle TEXT REFERENCES lens_accounts(lens_handle),
  ADD COLUMN IF NOT EXISTS lens_account_address TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tiktok_creators_pkp ON tiktok_creators(pkp_address);
CREATE INDEX IF NOT EXISTS idx_tiktok_creators_lens_handle ON tiktok_creators(lens_handle);
CREATE INDEX IF NOT EXISTS idx_tiktok_creators_lens_address ON tiktok_creators(lens_account_address);

-- Comments
COMMENT ON COLUMN tiktok_creators.pkp_address IS 'Lit Protocol PKP address for this creator. Enables TikTok OAuth account claiming.';
COMMENT ON COLUMN tiktok_creators.lens_handle IS 'Lens Protocol username for this creator (e.g., @gioscottii)';
COMMENT ON COLUMN tiktok_creators.lens_account_address IS 'Lens account address (for quick lookups without join)';
