-- Migration 026: Create pkp_accounts table
-- Purpose: Store Lit Protocol PKP data for artists and TikTok creators
-- Enables: TikTok OAuth account claiming via PKPs

CREATE TABLE IF NOT EXISTS pkp_accounts (
  id SERIAL PRIMARY KEY,

  -- Account type (artist or TikTok creator)
  account_type TEXT NOT NULL CHECK (account_type IN ('artist', 'tiktok_creator')),

  -- Polymorphic join keys (exactly one will be set based on account_type)
  spotify_artist_id TEXT,           -- For artists
  tiktok_handle TEXT,                -- For TikTok creators

  -- Additional identifiers
  genius_artist_id INTEGER,          -- For artists (from Genius API)

  -- PKP data (from Lit Protocol Chronicle Yellowstone)
  pkp_address TEXT NOT NULL UNIQUE,
  pkp_token_id TEXT NOT NULL,
  pkp_public_key TEXT NOT NULL,
  pkp_owner_eoa TEXT NOT NULL,       -- EOA that minted the PKP

  -- Network & minting metadata
  network TEXT DEFAULT 'chronicle-yellowstone',
  transaction_hash TEXT,
  minted_at TIMESTAMPTZ DEFAULT NOW(),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: exactly one join key must be set based on account_type
  CONSTRAINT check_pkp_account_join_key CHECK (
    (account_type = 'artist' AND spotify_artist_id IS NOT NULL AND tiktok_handle IS NULL) OR
    (account_type = 'tiktok_creator' AND tiktok_handle IS NOT NULL AND spotify_artist_id IS NULL)
  )
);

-- Indexes for performance
CREATE UNIQUE INDEX idx_pkp_accounts_artist ON pkp_accounts(spotify_artist_id)
  WHERE account_type = 'artist';

CREATE UNIQUE INDEX idx_pkp_accounts_creator ON pkp_accounts(tiktok_handle)
  WHERE account_type = 'tiktok_creator';

CREATE INDEX idx_pkp_accounts_type ON pkp_accounts(account_type);
CREATE INDEX idx_pkp_accounts_address ON pkp_accounts(pkp_address);
CREATE INDEX idx_pkp_accounts_genius ON pkp_accounts(genius_artist_id)
  WHERE genius_artist_id IS NOT NULL;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_pkp_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pkp_accounts_updated_at
  BEFORE UPDATE ON pkp_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_pkp_accounts_updated_at();

-- Comments
COMMENT ON TABLE pkp_accounts IS 'Lit Protocol PKP (Programmable Key Pair) data for artists and TikTok creators. Enables TikTok OAuth claiming.';
COMMENT ON COLUMN pkp_accounts.account_type IS 'Type of account: "artist" (original music creator) or "tiktok_creator" (video creator)';
COMMENT ON COLUMN pkp_accounts.pkp_address IS 'Ethereum address derived from PKP public key. Used as Lens account owner.';
COMMENT ON COLUMN pkp_accounts.pkp_token_id IS 'ERC-721 token ID for the PKP NFT on Chronicle Yellowstone';
COMMENT ON COLUMN pkp_accounts.pkp_owner_eoa IS 'Externally Owned Account that minted this PKP (pays gas)';
COMMENT ON COLUMN pkp_accounts.spotify_artist_id IS 'Join key for artists. NULL for TikTok creators.';
COMMENT ON COLUMN pkp_accounts.tiktok_handle IS 'Join key for TikTok creators. NULL for artists.';
