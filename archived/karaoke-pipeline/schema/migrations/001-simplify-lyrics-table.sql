-- Migration: Simplify track_lyrics table to optimal single-table design
-- Removes old validation columns and adds normalization/language detection fields

BEGIN;

-- Step 1: Add new columns
ALTER TABLE track_lyrics
  ADD COLUMN IF NOT EXISTS normalized_by TEXT,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS language_data JSONB,
  ADD COLUMN IF NOT EXISTS raw_sources JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Step 2: Migrate discovered_at to created_at for existing rows
UPDATE track_lyrics
SET created_at = discovered_at
WHERE created_at IS NULL AND discovered_at IS NOT NULL;

-- Step 3: Make plain_text NOT NULL (it should always have a value)
UPDATE track_lyrics SET plain_text = '' WHERE plain_text IS NULL;
ALTER TABLE track_lyrics ALTER COLUMN plain_text SET NOT NULL;

-- Step 4: Drop obsolete columns
ALTER TABLE track_lyrics
  DROP COLUMN IF EXISTS source_id,
  DROP COLUMN IF EXISTS source_url,
  DROP COLUMN IF EXISTS has_timing,
  DROP COLUMN IF EXISTS word_count,
  DROP COLUMN IF EXISTS line_count,
  DROP COLUMN IF EXISTS language,
  DROP COLUMN IF EXISTS is_validated,
  DROP COLUMN IF EXISTS validation_notes,
  DROP COLUMN IF EXISTS discovered_at;

-- Step 5: Update indexes
DROP INDEX IF EXISTS idx_lyrics_source;
DROP INDEX IF EXISTS idx_lyrics_confidence;
DROP INDEX IF EXISTS idx_lyrics_grove;
DROP INDEX IF EXISTS idx_lyrics_synced;

CREATE INDEX IF NOT EXISTS idx_lyrics_source ON track_lyrics(source);
CREATE INDEX IF NOT EXISTS idx_lyrics_confidence ON track_lyrics(confidence_score DESC) WHERE confidence_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lyrics_grove ON track_lyrics(grove_cid) WHERE grove_cid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lyrics_synced ON track_lyrics(spotify_track_id) WHERE synced_lrc IS NOT NULL;

COMMIT;
