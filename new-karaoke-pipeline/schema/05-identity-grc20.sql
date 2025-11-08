-- Schema 05: Identity & GRC-20 Tables
-- Purpose: PKP/Lens accounts, GRC-20 artist/work entities, and Unlock Protocol integration
-- Dependencies: 01-core.sql (tiktok_creators), 03-caches.sql (spotify_artists)
--
-- Architecture Notes:
-- - Normalized design: PKP/Lens tables separate from entities (artists/creators)
-- - Foreign keys from tiktok_creators/grc20_artists → pkp_accounts/lens_accounts
-- - Unlock Protocol locks stored in lens_accounts (one lock per creator, not per track)
-- - GRC-20 entity IDs link to public music metadata layer

-- ============================================================================
-- PKP Accounts (Lit Protocol)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pkp_accounts (
  id SERIAL PRIMARY KEY,

  -- Account type (artist or TikTok creator)
  account_type TEXT NOT NULL CHECK (account_type IN ('artist', 'tiktok_creator')),

  -- Polymorphic join keys (exactly one will be set based on account_type)
  spotify_artist_id TEXT,           -- For artists
  tiktok_handle TEXT,                -- For TikTok creators (@username)

  -- Additional identifiers
  genius_artist_id INTEGER,          -- For artists (from Genius API)

  -- PKP data (from Lit Protocol Chronicle Yellowstone)
  pkp_address TEXT NOT NULL UNIQUE,
  pkp_token_id TEXT NOT NULL,
  pkp_public_key TEXT NOT NULL,
  pkp_owner_eoa TEXT NOT NULL,       -- EOA that minted the PKP (pays gas)

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

COMMENT ON TABLE pkp_accounts IS 'Lit Protocol PKP (Programmable Key Pair) data for artists and TikTok creators. Enables WebAuthn-based authentication and ownership of Lens accounts.';
COMMENT ON COLUMN pkp_accounts.account_type IS 'Type of account: "artist" (original music creator) or "tiktok_creator" (video creator)';
COMMENT ON COLUMN pkp_accounts.pkp_address IS 'Ethereum address derived from PKP public key. Used as Lens account owner.';
COMMENT ON COLUMN pkp_accounts.pkp_token_id IS 'ERC-721 token ID for the PKP NFT on Chronicle Yellowstone';
COMMENT ON COLUMN pkp_accounts.pkp_owner_eoa IS 'Externally Owned Account that minted this PKP (pays gas, can delegate permissions)';

-- ============================================================================
-- Lens Accounts (Lens Protocol + Unlock Protocol)
-- ============================================================================

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
  lens_metadata_uri TEXT NOT NULL,            -- Grove URI: grove://...

  -- Unlock Protocol subscription lock (for artists only)
  subscription_lock_address TEXT,
  subscription_lock_chain TEXT DEFAULT 'base-sepolia',
  subscription_lock_price TEXT DEFAULT '1.99',
  subscription_lock_currency TEXT DEFAULT 'ETH',
  subscription_lock_duration_days INTEGER DEFAULT 30,
  subscription_lock_deployed_at TIMESTAMPTZ,
  subscription_lock_tx_hash TEXT,

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
  ),

  -- Constraint: lock address must be unique if set
  CONSTRAINT unique_subscription_lock_address UNIQUE (subscription_lock_address)
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

CREATE INDEX idx_lens_accounts_lock_address
  ON lens_accounts(subscription_lock_address)
  WHERE subscription_lock_address IS NOT NULL;

CREATE INDEX idx_lens_accounts_needs_lock
  ON lens_accounts(account_type, spotify_artist_id)
  WHERE account_type = 'artist'
    AND spotify_artist_id IS NOT NULL
    AND subscription_lock_address IS NULL;

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

COMMENT ON TABLE lens_accounts IS 'Lens Protocol accounts for artists and TikTok creators. Created with PKP as owner. Stores Unlock Protocol subscription locks for revenue.';
COMMENT ON COLUMN lens_accounts.subscription_lock_address IS 'Unlock Protocol lock address on Base Sepolia. Only deployed for artists with spotify_artist_id (NOT TikTok creators). Price: $1.99 ETH/month, Duration: 30 days. Payment flows to PKP address.';
COMMENT ON COLUMN lens_accounts.lens_handle IS 'Immutable Lens username. Used as identifier in GRC-20 for artists.';
COMMENT ON COLUMN lens_accounts.pkp_address IS 'PKP address that owns this Lens account. Must exist in pkp_accounts table.';

-- ============================================================================
-- GRC-20 Artists (Public Music Metadata Layer)
-- ============================================================================

CREATE TABLE IF NOT EXISTS grc20_artists (
  id SERIAL PRIMARY KEY,

  -- Basic Info
  name TEXT NOT NULL,
  sort_name TEXT,
  alternate_names TEXT,                  -- Comma-separated: "Name1, Name2, Name3"
  disambiguation TEXT,

  -- Industry Identifiers (Primary)
  isni TEXT,                             -- Primary ISNI: "0000000372879707"
  isni_all TEXT,                         -- All ISNIs: "0000000372879707, 0000000433817666"
  ipi_all TEXT,                          -- All IPIs: "00673691508, 00673691704"
  mbid TEXT,                             -- MusicBrainz ID (UUID)

  -- Platform IDs
  spotify_artist_id TEXT UNIQUE,
  genius_artist_id INTEGER UNIQUE,
  discogs_id TEXT,

  -- Biographical
  artist_type TEXT,                      -- 'Person', 'Group', 'Orchestra', 'Choir', etc.
  gender TEXT,                           -- 'Male', 'Female', 'Other', 'Non-Binary'
  birth_date DATE,
  death_date DATE,
  country TEXT,                          -- ISO 3166-1 alpha-2 code

  -- Musical Info
  genres TEXT,                           -- Comma-separated: "pop, rock, electronic"

  -- Verification Status
  is_verified BOOLEAN DEFAULT FALSE,     -- Genius verification status

  -- URLs (abbreviated - only essential for GRC-20)
  spotify_url TEXT,
  genius_url TEXT,
  wikidata_url TEXT,
  instagram_url TEXT,
  twitter_url TEXT,
  official_website TEXT,

  -- Image URLs
  image_url TEXT,
  image_source TEXT,                     -- 'spotify' | 'genius' | 'fal'

  -- Minting State
  grc20_entity_id UUID UNIQUE,           -- Set after minting to GRC-20
  minted_at TIMESTAMP,
  needs_update BOOLEAN DEFAULT FALSE,    -- Flag when source data changes

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_grc20_artists_isni ON grc20_artists(isni) WHERE isni IS NOT NULL;
CREATE INDEX idx_grc20_artists_spotify ON grc20_artists(spotify_artist_id);
CREATE INDEX idx_grc20_artists_genius ON grc20_artists(genius_artist_id) WHERE genius_artist_id IS NOT NULL;
CREATE INDEX idx_grc20_artists_mbid ON grc20_artists(mbid) WHERE mbid IS NOT NULL;
CREATE INDEX idx_grc20_artists_entity_id ON grc20_artists(grc20_entity_id);
CREATE INDEX idx_grc20_artists_needs_update ON grc20_artists(needs_update) WHERE needs_update = TRUE;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_grc20_artists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_grc20_artists_updated_at
  BEFORE UPDATE ON grc20_artists
  FOR EACH ROW
  EXECUTE FUNCTION update_grc20_artists_updated_at();

COMMENT ON TABLE grc20_artists IS 'Pre-mint aggregation table for GRC-20 artist entities. Combines data from Spotify, Genius, MusicBrainz, and Quansic. Simplified from archived pipeline (removed 100+ URL columns).';
COMMENT ON COLUMN grc20_artists.grc20_entity_id IS 'UUID of minted GRC-20 entity. NULL until minted. Links to public music metadata layer.';
COMMENT ON COLUMN grc20_artists.needs_update IS 'Flag indicating source data changed since last mint. Triggers re-minting via GRC-20 Edit operation.';

-- ============================================================================
-- GRC-20 Works (Musical Works for Karaoke Tracks)
-- ============================================================================

CREATE TABLE IF NOT EXISTS grc20_works (
  id SERIAL PRIMARY KEY,

  -- Basic Info
  title TEXT NOT NULL,
  alternate_titles TEXT,                 -- Comma-separated: "Title 1, Title 2"
  disambiguation TEXT,

  -- Industry Identifiers (Primary)
  iswc TEXT,                             -- International Standard Musical Work Code
  iswc_source TEXT,                      -- 'quansic' | 'bmi' | 'musicbrainz'
  isrc TEXT,                             -- International Standard Recording Code
  mbid TEXT,                             -- MusicBrainz Recording ID (UUID)

  -- Platform IDs
  spotify_track_id TEXT UNIQUE,
  genius_song_id INTEGER UNIQUE,

  -- Artist Relationships
  primary_artist_id INTEGER REFERENCES grc20_artists(id),
  primary_artist_name TEXT NOT NULL,    -- Denormalized for convenience

  -- Work Metadata
  language TEXT,                         -- ISO 639-1 code (2-letter)
  release_date DATE,
  duration_ms INTEGER,

  -- Musical Info
  genres TEXT,                           -- Comma-separated: "pop, rock, electronic"
  explicit_content BOOLEAN DEFAULT FALSE,

  -- Popularity Metrics (for selection)
  spotify_popularity INTEGER,            -- 0-100

  -- URLs (essential only)
  spotify_url TEXT,
  genius_url TEXT,
  wikidata_url TEXT,

  -- Image URLs
  image_url TEXT,
  image_source TEXT,                     -- 'spotify' | 'genius'

  -- Minting State
  grc20_entity_id UUID UNIQUE,           -- Set after minting to GRC-20
  minted_at TIMESTAMP,
  needs_update BOOLEAN DEFAULT FALSE,    -- Flag when source data changes

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_grc20_works_iswc ON grc20_works(iswc) WHERE iswc IS NOT NULL;
CREATE INDEX idx_grc20_works_isrc ON grc20_works(isrc) WHERE isrc IS NOT NULL;
CREATE INDEX idx_grc20_works_spotify ON grc20_works(spotify_track_id);
CREATE INDEX idx_grc20_works_genius ON grc20_works(genius_song_id) WHERE genius_song_id IS NOT NULL;
CREATE INDEX idx_grc20_works_mbid ON grc20_works(mbid) WHERE mbid IS NOT NULL;
CREATE INDEX idx_grc20_works_entity_id ON grc20_works(grc20_entity_id);
CREATE INDEX idx_grc20_works_primary_artist ON grc20_works(primary_artist_id);
CREATE INDEX idx_grc20_works_needs_update ON grc20_works(needs_update) WHERE needs_update = TRUE;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_grc20_works_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_grc20_works_updated_at
  BEFORE UPDATE ON grc20_works
  FOR EACH ROW
  EXECUTE FUNCTION update_grc20_works_updated_at();

COMMENT ON TABLE grc20_works IS 'Pre-mint aggregation table for GRC-20 musical work entities. Combines data from Spotify, Genius, MusicBrainz, Quansic, and BMI. Simplified from archived pipeline.';
COMMENT ON COLUMN grc20_works.iswc IS 'International Standard Musical Work Code (preferred identifier when available)';
COMMENT ON COLUMN grc20_works.grc20_entity_id IS 'UUID of minted GRC-20 entity. NULL until minted. Links to public music metadata layer.';
COMMENT ON COLUMN grc20_works.needs_update IS 'Flag indicating source data changed since last mint. Triggers re-minting via GRC-20 Edit operation.';
