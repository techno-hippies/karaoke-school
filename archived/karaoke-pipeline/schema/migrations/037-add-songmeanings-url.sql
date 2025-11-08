-- Migration 037: Add songmeanings_url column to grc20_artists
-- SongMeanings artist URLs should be stored as dedicated columns for GRC-20 minting

-- Add songmeanings_url column
ALTER TABLE grc20_artists
ADD COLUMN songmeanings_url TEXT;

-- Create index for faster lookups
CREATE INDEX idx_grc20_artists_songmeanings
ON grc20_artists(songmeanings_url)
WHERE songmeanings_url IS NOT NULL;

-- Add comment
COMMENT ON COLUMN grc20_artists.songmeanings_url IS 'SongMeanings artist page URL (e.g., https://songmeanings.com/artist/view/songs/96/)';
