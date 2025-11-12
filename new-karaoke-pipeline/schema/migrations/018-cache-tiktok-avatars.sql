-- Cache TikTok creator avatars in Grove storage
-- Adds metadata columns for original avatar URL + upload timestamps
-- Existing avatar_url values are treated as source URLs until re-scraped

ALTER TABLE tiktok_creators
  ADD COLUMN IF NOT EXISTS avatar_source_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar_uploaded_at TIMESTAMPTZ;

COMMENT ON COLUMN tiktok_creators.avatar_url IS 'Creator avatar URI (grove://CID once uploaded)';
COMMENT ON COLUMN tiktok_creators.avatar_source_url IS 'Original TikTok CDN URL used to refresh the avatar cache';
COMMENT ON COLUMN tiktok_creators.avatar_uploaded_at IS 'Timestamp when avatar was last uploaded to Grove';

-- Preserve original TikTok URL as source reference if avatar_url already populated
UPDATE tiktok_creators
SET avatar_source_url = avatar_url
WHERE avatar_url IS NOT NULL
  AND avatar_source_url IS NULL;
