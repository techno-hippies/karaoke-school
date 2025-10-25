-- Add social media and external identifier columns to musicbrainz_artists table
-- Migration: add-musicbrainz-social-columns
-- Date: 2025-10-25

-- Add social media handle columns
ALTER TABLE musicbrainz_artists
ADD COLUMN IF NOT EXISTS tiktok_handle TEXT,
ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
ADD COLUMN IF NOT EXISTS twitter_handle TEXT,
ADD COLUMN IF NOT EXISTS facebook_handle TEXT,
ADD COLUMN IF NOT EXISTS youtube_channel TEXT,
ADD COLUMN IF NOT EXISTS soundcloud_handle TEXT;

-- Add other external identifier columns
ALTER TABLE musicbrainz_artists
ADD COLUMN IF NOT EXISTS wikidata_id TEXT,
ADD COLUMN IF NOT EXISTS genius_slug TEXT,
ADD COLUMN IF NOT EXISTS discogs_id TEXT;

-- Create indexes for social media lookups (critical for linking)
CREATE INDEX IF NOT EXISTS idx_musicbrainz_artists_tiktok
  ON musicbrainz_artists(tiktok_handle)
  WHERE tiktok_handle IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_musicbrainz_artists_instagram
  ON musicbrainz_artists(instagram_handle)
  WHERE instagram_handle IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_musicbrainz_artists_twitter
  ON musicbrainz_artists(twitter_handle)
  WHERE twitter_handle IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_musicbrainz_artists_genius
  ON musicbrainz_artists(genius_slug)
  WHERE genius_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_musicbrainz_artists_wikidata
  ON musicbrainz_artists(wikidata_id)
  WHERE wikidata_id IS NOT NULL;

-- Add comment documenting the purpose
COMMENT ON COLUMN musicbrainz_artists.tiktok_handle IS 'TikTok handle (without @) extracted from MusicBrainz URL relations';
COMMENT ON COLUMN musicbrainz_artists.instagram_handle IS 'Instagram handle (without @) extracted from MusicBrainz URL relations';
COMMENT ON COLUMN musicbrainz_artists.twitter_handle IS 'Twitter/X handle (without @) extracted from MusicBrainz URL relations';
COMMENT ON COLUMN musicbrainz_artists.wikidata_id IS 'Wikidata entity ID (e.g., Q7396400) extracted from MusicBrainz URL relations';
