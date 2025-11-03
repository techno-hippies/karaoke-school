-- Migration 050: Create Separate Minting Tables for Works and Recordings
--
-- Purpose: Apply the same separate table architecture to works and recordings
-- Matches the grc20_artist_mints pattern for consistency
--
-- Join Keys:
--   - grc20_work_mints: iswc (International Standard Musical Work Code)
--   - grc20_recording_mints: spotify_track_id (primary identifier for recordings)

-- === CREATE MINTING TABLES ===

-- Works Minting Table
CREATE TABLE IF NOT EXISTS grc20_work_mints (
  id SERIAL PRIMARY KEY,
  iswc TEXT NOT NULL UNIQUE,         -- Join key to grc20_works
  grc20_entity_id UUID NOT NULL,
  minted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  needs_update BOOLEAN NOT NULL DEFAULT FALSE,
  last_edit_cid TEXT,               -- CID of last GRC-20 edit transaction
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grc20_work_mints_iswc ON grc20_work_mints(iswc);
CREATE INDEX idx_grc20_work_mints_entity_id ON grc20_work_mints(grc20_entity_id);
CREATE INDEX idx_grc20_work_mints_needs_update ON grc20_work_mints(needs_update) WHERE needs_update = TRUE;

COMMENT ON TABLE grc20_work_mints IS 'GRC-20 minting state for musical works';
COMMENT ON COLUMN grc20_work_mints.iswc IS 'Join key to grc20_works table';
COMMENT ON COLUMN grc20_work_mints.grc20_entity_id IS 'UUID of minted entity in GRC-20';
COMMENT ON COLUMN grc20_work_mints.needs_update IS 'True if work data changed and needs re-minting';

-- Recordings Minting Table
CREATE TABLE IF NOT EXISTS grc20_recording_mints (
  id SERIAL PRIMARY KEY,
  spotify_track_id TEXT NOT NULL UNIQUE,  -- Join key to grc20_work_recordings
  grc20_entity_id UUID NOT NULL,
  minted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  needs_update BOOLEAN NOT NULL DEFAULT FALSE,
  last_edit_cid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grc20_recording_mints_spotify ON grc20_recording_mints(spotify_track_id);
CREATE INDEX idx_grc20_recording_mints_entity_id ON grc20_recording_mints(grc20_entity_id);
CREATE INDEX idx_grc20_recording_mints_needs_update ON grc20_recording_mints(needs_update) WHERE needs_update = TRUE;

COMMENT ON TABLE grc20_recording_mints IS 'GRC-20 minting state for audio recordings';
COMMENT ON COLUMN grc20_recording_mints.spotify_track_id IS 'Join key to grc20_work_recordings table';

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_grc20_work_mints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_grc20_work_mints_updated_at
  BEFORE UPDATE ON grc20_work_mints
  FOR EACH ROW
  EXECUTE FUNCTION update_grc20_work_mints_updated_at();

CREATE OR REPLACE FUNCTION update_grc20_recording_mints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_grc20_recording_mints_updated_at
  BEFORE UPDATE ON grc20_recording_mints
  FOR EACH ROW
  EXECUTE FUNCTION update_grc20_recording_mints_updated_at();

-- === MIGRATE EXISTING DATA ===

-- Migrate Works
INSERT INTO grc20_work_mints (iswc, grc20_entity_id, minted_at, needs_update)
SELECT
  iswc,
  grc20_entity_id,
  minted_at,
  FALSE as needs_update
FROM grc20_works
WHERE grc20_entity_id IS NOT NULL
  AND iswc IS NOT NULL
ON CONFLICT (iswc) DO UPDATE SET
  grc20_entity_id = EXCLUDED.grc20_entity_id,
  minted_at = EXCLUDED.minted_at,
  updated_at = NOW();

-- Migrate Recordings
INSERT INTO grc20_recording_mints (spotify_track_id, grc20_entity_id, minted_at, needs_update)
SELECT
  spotify_track_id,
  grc20_entity_id,
  minted_at,
  FALSE as needs_update
FROM grc20_work_recordings
WHERE grc20_entity_id IS NOT NULL
  AND spotify_track_id IS NOT NULL
ON CONFLICT (spotify_track_id) DO UPDATE SET
  grc20_entity_id = EXCLUDED.grc20_entity_id,
  minted_at = EXCLUDED.minted_at,
  updated_at = NOW();

-- Verify migrations
DO $$
DECLARE
  works_source_count INT;
  works_target_count INT;
  recordings_source_count INT;
  recordings_target_count INT;
BEGIN
  SELECT COUNT(*) INTO works_source_count FROM grc20_works WHERE grc20_entity_id IS NOT NULL;
  SELECT COUNT(*) INTO works_target_count FROM grc20_work_mints;

  SELECT COUNT(*) INTO recordings_source_count FROM grc20_work_recordings WHERE grc20_entity_id IS NOT NULL;
  SELECT COUNT(*) INTO recordings_target_count FROM grc20_recording_mints;

  IF works_source_count != works_target_count THEN
    RAISE EXCEPTION 'Works migration failed: % in grc20_works but % in grc20_work_mints',
      works_source_count, works_target_count;
  END IF;

  IF recordings_source_count != recordings_target_count THEN
    RAISE EXCEPTION 'Recordings migration failed: % in grc20_work_recordings but % in grc20_recording_mints',
      recordings_source_count, recordings_target_count;
  END IF;

  RAISE NOTICE 'Successfully migrated % works and % recordings to separate minting tables',
    works_target_count, recordings_target_count;
END $$;

-- === DROP OLD COLUMNS ===

-- Drop from grc20_works
ALTER TABLE grc20_works
  DROP COLUMN IF EXISTS grc20_entity_id,
  DROP COLUMN IF EXISTS minted_at;

-- Drop from grc20_work_recordings
ALTER TABLE grc20_work_recordings
  DROP COLUMN IF EXISTS grc20_entity_id,
  DROP COLUMN IF EXISTS minted_at;

-- Drop old indexes if they exist
DROP INDEX IF EXISTS idx_grc20_works_unminted;
DROP INDEX IF EXISTS idx_grc20_works_entity_id;
DROP INDEX IF EXISTS idx_grc20_work_recordings_unminted;
DROP INDEX IF EXISTS idx_grc20_work_recordings_entity_id;

-- === UPDATE VIEWS ===

-- Update grc20_minting_status view to use separate minting tables
DROP VIEW IF EXISTS grc20_minting_status;

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
  COUNT(DISTINCT gw.id),
  COUNT(DISTINCT gwm.grc20_entity_id),
  COUNT(DISTINCT gw.id) - COUNT(DISTINCT gwm.grc20_entity_id),
  ROUND(100.0 * COUNT(DISTINCT gwm.grc20_entity_id) / NULLIF(COUNT(DISTINCT gw.id), 0), 1)
FROM grc20_works gw
LEFT JOIN grc20_work_mints gwm ON gw.iswc = gwm.iswc

UNION ALL

SELECT
  'Recordings',
  COUNT(DISTINCT gwr.id),
  COUNT(DISTINCT grm.grc20_entity_id),
  COUNT(DISTINCT gwr.id) - COUNT(DISTINCT grm.grc20_entity_id),
  ROUND(100.0 * COUNT(DISTINCT grm.grc20_entity_id) / NULLIF(COUNT(DISTINCT gwr.id), 0), 1)
FROM grc20_work_recordings gwr
LEFT JOIN grc20_recording_mints grm ON gwr.spotify_track_id = grm.spotify_track_id;

COMMENT ON VIEW grc20_minting_status IS 'Summary of GRC-20 v2 minting progress using all separate minting tables';

-- === CREATE HELPER FUNCTIONS ===

-- Get unminted works
CREATE OR REPLACE FUNCTION get_unminted_works(batch_size INT DEFAULT 100)
RETURNS TABLE (
  id INT,
  iswc TEXT,
  title TEXT,
  spotify_track_id TEXT,
  genius_song_id INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gw.id,
    gw.iswc,
    gw.title,
    gw.spotify_track_id,
    gw.genius_song_id
  FROM grc20_works gw
  LEFT JOIN grc20_work_mints gwm ON gw.iswc = gwm.iswc
  WHERE gwm.grc20_entity_id IS NULL
    AND gw.iswc IS NOT NULL
  ORDER BY gw.id
  LIMIT batch_size;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_unminted_works IS 'Get batch of works ready for GRC-20 minting';

-- Get works needing updates
CREATE OR REPLACE FUNCTION get_works_needing_update(batch_size INT DEFAULT 100)
RETURNS TABLE (
  id INT,
  iswc TEXT,
  title TEXT,
  grc20_entity_id UUID,
  last_minted_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gw.id,
    gw.iswc,
    gw.title,
    gwm.grc20_entity_id,
    gwm.minted_at
  FROM grc20_works gw
  JOIN grc20_work_mints gwm ON gw.iswc = gwm.iswc
  WHERE gwm.needs_update = TRUE
  ORDER BY gwm.updated_at
  LIMIT batch_size;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_works_needing_update IS 'Get works that need re-minting due to data updates';

-- Get unminted recordings
CREATE OR REPLACE FUNCTION get_unminted_recordings(batch_size INT DEFAULT 100)
RETURNS TABLE (
  id INT,
  spotify_track_id TEXT,
  title TEXT,
  iswc TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gwr.id,
    gwr.spotify_track_id,
    gwr.title,
    gwr.iswc
  FROM grc20_work_recordings gwr
  LEFT JOIN grc20_recording_mints grm ON gwr.spotify_track_id = grm.spotify_track_id
  WHERE grm.grc20_entity_id IS NULL
    AND gwr.spotify_track_id IS NOT NULL
  ORDER BY gwr.id
  LIMIT batch_size;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_unminted_recordings IS 'Get batch of recordings ready for GRC-20 minting';

-- Get recordings needing updates
CREATE OR REPLACE FUNCTION get_recordings_needing_update(batch_size INT DEFAULT 100)
RETURNS TABLE (
  id INT,
  spotify_track_id TEXT,
  title TEXT,
  grc20_entity_id UUID,
  last_minted_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gwr.id,
    gwr.spotify_track_id,
    gwr.title,
    grm.grc20_entity_id,
    grm.minted_at
  FROM grc20_work_recordings gwr
  JOIN grc20_recording_mints grm ON gwr.spotify_track_id = grm.spotify_track_id
  WHERE grm.needs_update = TRUE
  ORDER BY grm.updated_at
  LIMIT batch_size;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_recordings_needing_update IS 'Get recordings that need re-minting due to data updates';

-- Verify final state
SELECT * FROM grc20_minting_status;
