-- Migration 027: Create lens_accounts table
-- Purpose: Store Lens Protocol account data for artists and TikTok creators
-- Depends on: 026-pkp-accounts.sql (PKP must exist before Lens account)

CREATE TABLE IF NOT EXISTS lens_accounts (
  id SERIAL PRIMARY KEY,

  -- Account type (artist or TikTok creator)
  account_type TEXT NOT NULL CHECK (account_type IN ('artist', 'tiktok_creator')),

  -- Polymorphic join keys (exactly one will be set based on account_type)
  spotify_artist_id TEXT,           -- For artists
  tiktok_handle TEXT,                -- For TikTok creators

  -- PKP reference (required - PKP owns the Lens account)
  pkp_address TEXT NOT NULL REFERENCES pkp_accounts(pkp_address) ON DELETE CASCADE,

  -- Lens account data
  lens_handle TEXT NOT NULL UNIQUE,           -- e.g., "ariana-grande" or "gioscottii"
  lens_account_address TEXT NOT NULL UNIQUE,  -- Lens account address
  lens_account_id TEXT NOT NULL,              -- Lens account ID (usually same as address)

  -- Metadata
  lens_metadata_uri TEXT NOT NULL,            -- Grove URI: lens://...

  -- Network & creation metadata
  network TEXT DEFAULT 'lens-testnet',
  transaction_hash TEXT,
  created_at_chain TIMESTAMPTZ,               -- Timestamp from blockchain

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: exactly one join key must be set based on account_type
  CONSTRAINT check_lens_account_join_key CHECK (
    (account_type = 'artist' AND spotify_artist_id IS NOT NULL AND tiktok_handle IS NULL) OR
    (account_type = 'tiktok_creator' AND tiktok_handle IS NOT NULL AND spotify_artist_id IS NULL)
  )
);

-- Indexes for performance
CREATE UNIQUE INDEX idx_lens_accounts_artist ON lens_accounts(spotify_artist_id)
  WHERE account_type = 'artist';

CREATE UNIQUE INDEX idx_lens_accounts_creator ON lens_accounts(tiktok_handle)
  WHERE account_type = 'tiktok_creator';

CREATE INDEX idx_lens_accounts_type ON lens_accounts(account_type);
CREATE INDEX idx_lens_accounts_pkp ON lens_accounts(pkp_address);
CREATE INDEX idx_lens_accounts_handle ON lens_accounts(lens_handle);
CREATE INDEX idx_lens_accounts_address ON lens_accounts(lens_account_address);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_lens_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_lens_accounts_updated_at
  BEFORE UPDATE ON lens_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_lens_accounts_updated_at();

-- Comments
COMMENT ON TABLE lens_accounts IS 'Lens Protocol accounts for artists and TikTok creators. Created with PKP as owner.';
COMMENT ON COLUMN lens_accounts.account_type IS 'Type of account: "artist" (original music creator) or "tiktok_creator" (video creator)';
COMMENT ON COLUMN lens_accounts.lens_handle IS 'Immutable Lens username. Used as identifier in GRC-20 for artists. Claimable via TikTok OAuth.';
COMMENT ON COLUMN lens_accounts.pkp_address IS 'PKP address that owns this Lens account. Must exist in pkp_accounts table.';
COMMENT ON COLUMN lens_accounts.lens_metadata_uri IS 'Grove/IPFS URI containing account metadata (name, bio, identifiers, avatar)';
COMMENT ON COLUMN lens_accounts.spotify_artist_id IS 'Join key for artists. NULL for TikTok creators.';
COMMENT ON COLUMN lens_accounts.tiktok_handle IS 'Join key for TikTok creators. NULL for artists.';
