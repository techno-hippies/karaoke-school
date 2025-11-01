-- Migration 029: Add PKP and Lens columns to grc20_artists
-- Purpose: Include PKP/Lens data in GRC-20 artist aggregation table
-- Depends on: 026-pkp-accounts.sql, 027-lens-accounts.sql

-- Add PKP columns
ALTER TABLE grc20_artists
  ADD COLUMN IF NOT EXISTS pkp_address TEXT,
  ADD COLUMN IF NOT EXISTS pkp_token_id TEXT,
  ADD COLUMN IF NOT EXISTS pkp_public_key TEXT,
  ADD COLUMN IF NOT EXISTS pkp_minted_at TIMESTAMPTZ;

-- Add Lens columns
ALTER TABLE grc20_artists
  ADD COLUMN IF NOT EXISTS lens_handle TEXT,
  ADD COLUMN IF NOT EXISTS lens_account_address TEXT,
  ADD COLUMN IF NOT EXISTS lens_account_id TEXT,
  ADD COLUMN IF NOT EXISTS lens_metadata_uri TEXT,
  ADD COLUMN IF NOT EXISTS lens_created_at TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_grc20_artists_pkp_address ON grc20_artists(pkp_address);
CREATE INDEX IF NOT EXISTS idx_grc20_artists_lens_handle ON grc20_artists(lens_handle);
CREATE INDEX IF NOT EXISTS idx_grc20_artists_lens_address ON grc20_artists(lens_account_address);

-- Comments
COMMENT ON COLUMN grc20_artists.pkp_address IS 'Lit Protocol PKP address for this artist. Copied from pkp_accounts table during population.';
COMMENT ON COLUMN grc20_artists.pkp_token_id IS 'PKP token ID (ERC-721 NFT on Chronicle Yellowstone)';
COMMENT ON COLUMN grc20_artists.lens_handle IS 'Lens Protocol username. IMMUTABLE identifier used in GRC-20. Example: "ariana-grande"';
COMMENT ON COLUMN grc20_artists.lens_account_address IS 'Lens account address. Copied from lens_accounts table during population.';
COMMENT ON COLUMN grc20_artists.lens_metadata_uri IS 'Grove URI containing Lens account metadata (includes all identifiers, social links, images)';
