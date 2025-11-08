-- Migration 049: Migrate to Separate Minting Table Architecture
--
-- Purpose: Move GRC-20 minting state from grc20_artists to grc20_artist_mints
-- This enables proper update tracking and scales better for 10k+ entities
--
-- Architecture:
--   - grc20_artists: Artist metadata (changes frequently)
--   - grc20_artist_mints: GRC-20 minting state (append-only, audit trail)
--
-- This matches the pattern of pkp_accounts and lens_accounts

BEGIN;

-- Step 1: Migrate existing minting data to grc20_artist_mints
INSERT INTO grc20_artist_mints (spotify_artist_id, grc20_entity_id, minted_at, needs_update)
SELECT
  spotify_artist_id,
  grc20_entity_id,
  minted_at,
  FALSE as needs_update  -- Freshly minted, no updates needed yet
FROM grc20_artists
WHERE grc20_entity_id IS NOT NULL
  AND spotify_artist_id IS NOT NULL
ON CONFLICT (spotify_artist_id) DO UPDATE SET
  grc20_entity_id = EXCLUDED.grc20_entity_id,
  minted_at = EXCLUDED.minted_at,
  updated_at = NOW();

-- Verify migration
DO $$
DECLARE
  source_count INT;
  target_count INT;
BEGIN
  SELECT COUNT(*) INTO source_count FROM grc20_artists WHERE grc20_entity_id IS NOT NULL;
  SELECT COUNT(*) INTO target_count FROM grc20_artist_mints;

  IF source_count != target_count THEN
    RAISE EXCEPTION 'Migration failed: % entities in grc20_artists but % in grc20_artist_mints',
      source_count, target_count;
  END IF;

  RAISE NOTICE 'Successfully migrated % entities to grc20_artist_mints', target_count;
END $$;

-- Step 2: Drop dependent views that reference these columns
DROP VIEW IF EXISTS grc20_artists_blocked;
DROP VIEW IF EXISTS grc20_minting_status;

-- Step 3: Drop minting columns from grc20_artists
ALTER TABLE grc20_artists
  DROP COLUMN IF EXISTS grc20_entity_id,
  DROP COLUMN IF EXISTS minted_at;

-- Drop indexes that are no longer needed
DROP INDEX IF EXISTS idx_grc20_artists_unminted;
DROP INDEX IF EXISTS idx_grc20_artists_entity_id;

-- Step 4: Recreate grc20_artists_blocked view to use grc20_artist_mints
CREATE VIEW grc20_artists_blocked AS
SELECT
  ga.id,
  ga.name,
  ga.spotify_artist_id,
  CASE
    WHEN ga.grove_image_url IS NULL THEN 'Missing Grove image'
    WHEN ga.spotify_artist_id IS NULL THEN 'Missing Spotify ID'
    WHEN ga.pkp_account_id IS NULL THEN 'Missing PKP account'
    WHEN ga.lens_account_id IS NULL THEN 'Missing Lens account'
    ELSE 'Unknown blocker'
  END AS blocker_reason,
  ga.created_at
FROM grc20_artists ga
LEFT JOIN grc20_artist_mints gam ON ga.spotify_artist_id = gam.spotify_artist_id
WHERE gam.grc20_entity_id IS NULL
  AND (
    ga.grove_image_url IS NULL
    OR ga.spotify_artist_id IS NULL
    OR ga.pkp_account_id IS NULL
    OR ga.lens_account_id IS NULL
  );

COMMENT ON VIEW grc20_artists_blocked IS 'Artists that cannot be minted due to missing required data';

-- Step 5: Recreate grc20_minting_status view to use separate minting tables
CREATE VIEW grc20_minting_status AS
SELECT
  'Artists' as entity_type,
  COUNT(DISTINCT ga.id) as total,
  COUNT(DISTINCT gam.grc20_entity_id) as minted,
  COUNT(DISTINCT ga.id) - COUNT(DISTINCT gam.grc20_entity_id) as unminted,
  ROUND(100.0 * COUNT(DISTINCT gam.grc20_entity_id) / NULLIF(COUNT(DISTINCT ga.id), 0), 1) as pct_minted
FROM grc20_artists ga
LEFT JOIN grc20_artist_mints gam ON ga.spotify_artist_id = gam.spotify_artist_id

UNION ALL

SELECT
  'Works',
  COUNT(*),
  COUNT(grc20_entity_id),
  COUNT(*) - COUNT(grc20_entity_id),
  ROUND(100.0 * COUNT(grc20_entity_id) / NULLIF(COUNT(*), 0), 1)
FROM grc20_works

UNION ALL

SELECT
  'Recordings',
  COUNT(*),
  COUNT(grc20_entity_id),
  COUNT(*) - COUNT(grc20_entity_id),
  ROUND(100.0 * COUNT(grc20_entity_id) / NULLIF(COUNT(*), 0), 1)
FROM grc20_work_recordings;

COMMENT ON VIEW grc20_minting_status IS 'Summary of GRC-20 v2 minting progress using separate minting tables';

-- Step 6: Update get_unminted_artists function to use grc20_artist_mints
CREATE OR REPLACE FUNCTION get_unminted_artists(batch_size INT DEFAULT 100)
RETURNS TABLE (
  id INT,
  name TEXT,
  spotify_artist_id TEXT,
  isni TEXT,
  mbid TEXT,
  pkp_address TEXT,
  lens_handle TEXT,
  lens_account_address TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ga.id,
    ga.name,
    ga.spotify_artist_id,
    ga.isni,
    ga.mbid,
    pkp.pkp_address,
    lens.lens_handle,
    lens.lens_account_address
  FROM grc20_artists ga
  LEFT JOIN pkp_accounts pkp ON ga.pkp_account_id = pkp.id
  LEFT JOIN lens_accounts lens ON ga.lens_account_id = lens.id
  LEFT JOIN grc20_artist_mints gam ON ga.spotify_artist_id = gam.spotify_artist_id
  WHERE gam.grc20_entity_id IS NULL  -- Not yet minted
    AND ga.spotify_artist_id IS NOT NULL
    AND pkp.pkp_address IS NOT NULL
    AND lens.lens_handle IS NOT NULL
  ORDER BY ga.id
  LIMIT batch_size;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_unminted_artists IS 'Get batch of artists ready for GRC-20 minting (queries grc20_artist_mints)';

-- Step 7: Create helper function to find artists needing updates
CREATE OR REPLACE FUNCTION get_artists_needing_update(batch_size INT DEFAULT 100)
RETURNS TABLE (
  id INT,
  name TEXT,
  spotify_artist_id TEXT,
  grc20_entity_id UUID,
  last_minted_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ga.id,
    ga.name,
    ga.spotify_artist_id,
    gam.grc20_entity_id,
    gam.minted_at
  FROM grc20_artists ga
  JOIN grc20_artist_mints gam ON ga.spotify_artist_id = gam.spotify_artist_id
  WHERE gam.needs_update = TRUE
  ORDER BY gam.updated_at
  LIMIT batch_size;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_artists_needing_update IS 'Get artists that need re-minting due to data updates';

-- Verify final state
SELECT * FROM grc20_minting_status;

COMMIT;
