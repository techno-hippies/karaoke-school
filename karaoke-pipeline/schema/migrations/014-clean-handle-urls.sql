-- Migration 014: Remove redundant social media URL columns
-- Keep handles only, drop duplicate URL columns for social media

-- Drop redundant social media URL columns (we have handles for these)
ALTER TABLE grc20_artists DROP COLUMN IF EXISTS instagram_url;
ALTER TABLE grc20_artists DROP COLUMN IF EXISTS twitter_url;
ALTER TABLE grc20_artists DROP COLUMN IF EXISTS facebook_url;
ALTER TABLE grc20_artists DROP COLUMN IF EXISTS tiktok_url;
ALTER TABLE grc20_artists DROP COLUMN IF EXISTS youtube_url;
ALTER TABLE grc20_artists DROP COLUMN IF EXISTS soundcloud_url;

-- Add column to track handle conflicts between sources
ALTER TABLE grc20_artists ADD COLUMN IF NOT EXISTS handle_conflicts JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN grc20_artists.handle_conflicts IS 'Tracks conflicts when Genius and MusicBrainz provide different handles for the same platform. Format: [{platform: "instagram", genius: "ye", musicbrainz: "kanyewest"}]';
