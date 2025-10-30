-- Add platform ID columns to musicbrainz_artists
ALTER TABLE musicbrainz_artists 
ADD COLUMN IF NOT EXISTS apple_music_id TEXT,
ADD COLUMN IF NOT EXISTS deezer_id TEXT,
ADD COLUMN IF NOT EXISTS tidal_id TEXT;

-- Add platform ID columns to grc20_artists
ALTER TABLE grc20_artists
ADD COLUMN IF NOT EXISTS apple_music_id TEXT,
ADD COLUMN IF NOT EXISTS deezer_id TEXT,
ADD COLUMN IF NOT EXISTS tidal_id TEXT;

-- Verify
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'musicbrainz_artists' 
AND column_name IN ('apple_music_id', 'deezer_id', 'tidal_id');

SELECT column_name FROM information_schema.columns 
WHERE table_name = 'grc20_artists' 
AND column_name IN ('apple_music_id', 'deezer_id', 'tidal_id');
