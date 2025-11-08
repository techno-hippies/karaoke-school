-- Extend musicbrainz_recordings with columns needed by enrichment task

ALTER TABLE musicbrainz_recordings
  ADD COLUMN IF NOT EXISTS spotify_track_id TEXT,
  ADD COLUMN IF NOT EXISTS artist_credits JSONB,
  ADD COLUMN IF NOT EXISTS tags JSONB,
  ADD COLUMN IF NOT EXISTS first_release_date DATE,
  ADD COLUMN IF NOT EXISTS video BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS raw_data JSONB;

-- Rename artist_credit → artist_credits for consistency
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'musicbrainz_recordings'
    AND column_name = 'artist_credit'
  ) THEN
    ALTER TABLE musicbrainz_recordings RENAME COLUMN artist_credit TO artist_credits;
  END IF;
END $$;

-- Add index on spotify_track_id for lookups
CREATE INDEX IF NOT EXISTS idx_mb_recordings_spotify
  ON musicbrainz_recordings(spotify_track_id)
  WHERE spotify_track_id IS NOT NULL;
