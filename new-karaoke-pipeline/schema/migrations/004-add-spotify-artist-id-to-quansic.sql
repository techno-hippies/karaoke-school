-- Add spotify_artist_id column to quansic_artists table
-- The processor expects this FK but the schema was missing it

ALTER TABLE quansic_artists
  ADD COLUMN spotify_artist_id TEXT;

-- Add foreign key constraint
ALTER TABLE quansic_artists
  ADD CONSTRAINT quansic_artists_spotify_artist_id_fkey
  FOREIGN KEY (spotify_artist_id)
  REFERENCES spotify_artists(spotify_artist_id)
  ON DELETE CASCADE;

-- Create index for lookups
CREATE INDEX idx_quansic_artists_spotify_id
  ON quansic_artists(spotify_artist_id)
  WHERE spotify_artist_id IS NOT NULL;

-- Update existing rows to add spotify_artist_id (from metadata JSONB)
UPDATE quansic_artists
SET spotify_artist_id = metadata->'ids'->>'spotifyIds'->0
WHERE metadata->'ids'->>'spotifyIds' IS NOT NULL;
