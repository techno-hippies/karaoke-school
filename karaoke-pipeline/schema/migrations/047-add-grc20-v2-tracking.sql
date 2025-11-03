-- Migration 047: Add GRC-20 v2 Entity Tracking
--
-- Purpose: Track which entities have been minted to GRC-20 Songverse v2
-- This prevents duplicate mints and enables incremental minting
--
-- Tables affected:
--   - grc20_artists (add grc20_entity_id, minted_at)
--   - grc20_works (already has these columns, verify structure)
--   - grc20_work_recordings (add grc20_entity_id, minted_at)

-- === ARTISTS ===
-- Add GRC-20 entity tracking
ALTER TABLE grc20_artists
  ADD COLUMN IF NOT EXISTS grc20_entity_id UUID,
  ADD COLUMN IF NOT EXISTS minted_at TIMESTAMPTZ;

-- Index for quick lookups of unminted artists
CREATE INDEX IF NOT EXISTS idx_grc20_artists_unminted
  ON grc20_artists(id)
  WHERE grc20_entity_id IS NULL;

-- Index for entity ID lookups
CREATE INDEX IF NOT EXISTS idx_grc20_artists_entity_id
  ON grc20_artists(grc20_entity_id)
  WHERE grc20_entity_id IS NOT NULL;

COMMENT ON COLUMN grc20_artists.grc20_entity_id IS 'UUID of minted entity in GRC-20 Songverse v2 space';
COMMENT ON COLUMN grc20_artists.minted_at IS 'Timestamp when entity was minted to GRC-20';

-- === WORKS ===
-- Verify structure (already created in earlier migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grc20_works'
      AND column_name = 'grc20_entity_id'
  ) THEN
    ALTER TABLE grc20_works
      ADD COLUMN grc20_entity_id UUID,
      ADD COLUMN minted_at TIMESTAMPTZ;
  END IF;
END$$;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_grc20_works_unminted
  ON grc20_works(id)
  WHERE grc20_entity_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_grc20_works_entity_id
  ON grc20_works(grc20_entity_id)
  WHERE grc20_entity_id IS NOT NULL;

COMMENT ON COLUMN grc20_works.grc20_entity_id IS 'UUID of minted entity in GRC-20 Songverse v2 space';
COMMENT ON COLUMN grc20_works.minted_at IS 'Timestamp when entity was minted to GRC-20';

-- === RECORDINGS ===
-- Add GRC-20 entity tracking
ALTER TABLE grc20_work_recordings
  ADD COLUMN IF NOT EXISTS grc20_entity_id UUID,
  ADD COLUMN IF NOT EXISTS minted_at TIMESTAMPTZ;

-- Index for quick lookups of unminted recordings
CREATE INDEX IF NOT EXISTS idx_grc20_recordings_unminted
  ON grc20_work_recordings(id)
  WHERE grc20_entity_id IS NULL;

-- Index for entity ID lookups
CREATE INDEX IF NOT EXISTS idx_grc20_recordings_entity_id
  ON grc20_work_recordings(grc20_entity_id)
  WHERE grc20_entity_id IS NOT NULL;

COMMENT ON COLUMN grc20_work_recordings.grc20_entity_id IS 'UUID of minted entity in GRC-20 Songverse v2 space';
COMMENT ON COLUMN grc20_work_recordings.minted_at IS 'Timestamp when entity was minted to GRC-20';

-- === STATS VIEW ===
-- Create view to easily check minting status
CREATE OR REPLACE VIEW grc20_minting_status AS
SELECT
  'Artists' as entity_type,
  COUNT(*) as total,
  COUNT(grc20_entity_id) as minted,
  COUNT(*) - COUNT(grc20_entity_id) as unminted,
  ROUND(100.0 * COUNT(grc20_entity_id) / NULLIF(COUNT(*), 0), 1) as pct_minted
FROM grc20_artists

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

COMMENT ON VIEW grc20_minting_status IS 'Summary of GRC-20 v2 minting progress across all entity types';

-- === QUERY HELPERS ===
-- Function to get unminted artists ready for minting
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
  WHERE ga.grc20_entity_id IS NULL
    AND ga.spotify_artist_id IS NOT NULL
    AND pkp.pkp_address IS NOT NULL
    AND lens.lens_handle IS NOT NULL
  ORDER BY ga.id
  LIMIT batch_size;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_unminted_artists IS 'Get batch of artists ready for GRC-20 minting (have Spotify ID, PKP, and Lens)';
