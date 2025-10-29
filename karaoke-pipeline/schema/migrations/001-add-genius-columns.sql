-- Add Genius enrichment columns to song_pipeline
-- Run with: psql $DATABASE_URL -f schema/migrations/001-add-genius-columns.sql

BEGIN;

-- Add Genius IDs for corroboration and enrichment
ALTER TABLE song_pipeline
  ADD COLUMN IF NOT EXISTS genius_song_id INTEGER,
  ADD COLUMN IF NOT EXISTS genius_artist_id INTEGER,
  ADD COLUMN IF NOT EXISTS genius_url TEXT,
  ADD COLUMN IF NOT EXISTS genius_artist_name TEXT;

-- Add index for Genius lookup
CREATE INDEX IF NOT EXISTS idx_pipeline_genius_song
  ON song_pipeline(genius_song_id)
  WHERE genius_song_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_genius_artist
  ON song_pipeline(genius_artist_id)
  WHERE genius_artist_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN song_pipeline.genius_song_id IS 'Genius song ID for lyrics corroboration';
COMMENT ON COLUMN song_pipeline.genius_artist_id IS 'Genius artist ID for metadata corroboration';
COMMENT ON COLUMN song_pipeline.genius_url IS 'Genius song page URL';
COMMENT ON COLUMN song_pipeline.genius_artist_name IS 'Artist name from Genius (for validation)';

COMMIT;
