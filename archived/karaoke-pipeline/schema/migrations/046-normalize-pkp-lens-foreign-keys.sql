-- Migration 046: Normalize PKP/Lens data with Foreign Keys
-- Purpose: Replace TEXT columns with proper foreign key references
-- Fixes: Data duplication and lack of referential integrity
--
-- Before: grc20_artists/tiktok_creators store PKP/Lens data as TEXT (duplicated)
-- After: grc20_artists/tiktok_creators reference pkp_accounts/lens_accounts via FK

-- ============================================================================
-- PART 1: grc20_artists - Add foreign key columns
-- ============================================================================

-- Add new FK columns (nullable for gradual migration)
ALTER TABLE grc20_artists
  ADD COLUMN IF NOT EXISTS pkp_account_id INTEGER,
  ADD COLUMN IF NOT EXISTS lens_account_id INTEGER;

-- Populate FK columns from existing TEXT data (match on spotify_artist_id)
UPDATE grc20_artists ga
SET pkp_account_id = pkp.id
FROM pkp_accounts pkp
WHERE ga.spotify_artist_id = pkp.spotify_artist_id
  AND pkp.account_type = 'artist'
  AND ga.pkp_account_id IS NULL;

UPDATE grc20_artists ga
SET lens_account_id = lens.id
FROM lens_accounts lens
WHERE ga.spotify_artist_id = lens.spotify_artist_id
  AND lens.account_type = 'artist'
  AND ga.lens_account_id IS NULL;

-- Add foreign key constraints
ALTER TABLE grc20_artists
  ADD CONSTRAINT fk_grc20_artists_pkp
    FOREIGN KEY (pkp_account_id)
    REFERENCES pkp_accounts(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT fk_grc20_artists_lens
    FOREIGN KEY (lens_account_id)
    REFERENCES lens_accounts(id)
    ON DELETE SET NULL;

-- Add indexes for JOIN performance
CREATE INDEX IF NOT EXISTS idx_grc20_artists_pkp_account_id
  ON grc20_artists(pkp_account_id);
CREATE INDEX IF NOT EXISTS idx_grc20_artists_lens_account_id
  ON grc20_artists(lens_account_id);

-- Drop old TEXT columns (data is now in FK-referenced tables)
ALTER TABLE grc20_artists
  DROP COLUMN IF EXISTS pkp_address,
  DROP COLUMN IF EXISTS pkp_token_id,
  DROP COLUMN IF EXISTS pkp_public_key,
  DROP COLUMN IF EXISTS pkp_minted_at,
  DROP COLUMN IF EXISTS lens_handle,
  DROP COLUMN IF EXISTS lens_account_address,
  DROP COLUMN IF EXISTS lens_account_id,
  DROP COLUMN IF EXISTS lens_metadata_uri,
  DROP COLUMN IF EXISTS lens_created_at;

-- Drop old indexes (columns no longer exist)
DROP INDEX IF EXISTS idx_grc20_artists_pkp_address;
DROP INDEX IF EXISTS idx_grc20_artists_lens_handle;
DROP INDEX IF EXISTS idx_grc20_artists_lens_address;

-- ============================================================================
-- PART 2: tiktok_creators - Add foreign key columns
-- ============================================================================

-- Add new FK columns
ALTER TABLE tiktok_creators
  ADD COLUMN IF NOT EXISTS pkp_account_id INTEGER,
  ADD COLUMN IF NOT EXISTS lens_account_id INTEGER;

-- Populate FK columns from existing TEXT data (match on tiktok_handle)
UPDATE tiktok_creators tc
SET pkp_account_id = pkp.id
FROM pkp_accounts pkp
WHERE tc.username = pkp.tiktok_handle
  AND pkp.account_type = 'tiktok_creator'
  AND tc.pkp_account_id IS NULL;

UPDATE tiktok_creators tc
SET lens_account_id = lens.id
FROM lens_accounts lens
WHERE tc.username = lens.tiktok_handle
  AND lens.account_type = 'tiktok_creator'
  AND tc.lens_account_id IS NULL;

-- Add foreign key constraints
ALTER TABLE tiktok_creators
  ADD CONSTRAINT fk_tiktok_creators_pkp
    FOREIGN KEY (pkp_account_id)
    REFERENCES pkp_accounts(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT fk_tiktok_creators_lens
    FOREIGN KEY (lens_account_id)
    REFERENCES lens_accounts(id)
    ON DELETE SET NULL;

-- Add indexes for JOIN performance
CREATE INDEX IF NOT EXISTS idx_tiktok_creators_pkp_account_id
  ON tiktok_creators(pkp_account_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_creators_lens_account_id
  ON tiktok_creators(lens_account_id);

-- Drop old TEXT columns
ALTER TABLE tiktok_creators
  DROP COLUMN IF EXISTS pkp_address,
  DROP COLUMN IF EXISTS lens_handle,
  DROP COLUMN IF EXISTS lens_account_address;

-- ============================================================================
-- PART 3: Create convenience views for backward compatibility
-- ============================================================================

-- View: grc20_artists_with_accounts
-- Provides all artist data + PKP/Lens details via JOINs
-- Use this for queries that need PKP/Lens data
CREATE OR REPLACE VIEW grc20_artists_with_accounts AS
SELECT
  ga.*,
  -- PKP data
  pkp.pkp_address,
  pkp.pkp_token_id,
  pkp.pkp_public_key,
  pkp.minted_at as pkp_minted_at,
  -- Lens data
  lens.lens_handle,
  lens.lens_account_address,
  lens.lens_account_id,
  lens.lens_metadata_uri,
  lens.created_at_chain as lens_created_at
FROM grc20_artists ga
LEFT JOIN pkp_accounts pkp ON ga.pkp_account_id = pkp.id
LEFT JOIN lens_accounts lens ON ga.lens_account_id = lens.id;

-- View: tiktok_creators_with_accounts
CREATE OR REPLACE VIEW tiktok_creators_with_accounts AS
SELECT
  tc.*,
  -- PKP data
  pkp.pkp_address,
  pkp.pkp_token_id,
  pkp.pkp_public_key,
  pkp.minted_at as pkp_minted_at,
  -- Lens data
  lens.lens_handle,
  lens.lens_account_address,
  lens.lens_account_id,
  lens.lens_metadata_uri,
  lens.created_at_chain as lens_created_at
FROM tiktok_creators tc
LEFT JOIN pkp_accounts pkp ON tc.pkp_account_id = pkp.id
LEFT JOIN lens_accounts lens ON tc.lens_account_id = lens.id;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN grc20_artists.pkp_account_id IS
  'Foreign key to pkp_accounts table. Use grc20_artists_with_accounts view to get PKP details.';

COMMENT ON COLUMN grc20_artists.lens_account_id IS
  'Foreign key to lens_accounts table. Use grc20_artists_with_accounts view to get Lens details.';

COMMENT ON COLUMN tiktok_creators.pkp_account_id IS
  'Foreign key to pkp_accounts table. Use tiktok_creators_with_accounts view to get PKP details.';

COMMENT ON COLUMN tiktok_creators.lens_account_id IS
  'Foreign key to lens_accounts table. Use tiktok_creators_with_accounts view to get Lens details.';

COMMENT ON VIEW grc20_artists_with_accounts IS
  'Convenience view that JOINs grc20_artists with pkp_accounts and lens_accounts. Use this instead of base table when PKP/Lens data is needed.';

COMMENT ON VIEW tiktok_creators_with_accounts IS
  'Convenience view that JOINs tiktok_creators with pkp_accounts and lens_accounts. Use this instead of base table when PKP/Lens data is needed.';
