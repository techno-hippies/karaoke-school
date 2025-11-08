-- Add Grove video storage to tiktok_videos
-- Stores permanent video URLs on Grove/IPFS so we don't rely on expiring TikTok CDN URLs

ALTER TABLE tiktok_videos
  ADD COLUMN IF NOT EXISTS grove_video_cid TEXT,
  ADD COLUMN IF NOT EXISTS grove_video_url TEXT,
  ADD COLUMN IF NOT EXISTS grove_uploaded_at TIMESTAMPTZ;

-- Index for finding videos not yet uploaded to Grove
CREATE INDEX IF NOT EXISTS idx_videos_grove_missing
  ON tiktok_videos(video_id)
  WHERE grove_video_cid IS NULL;

-- View: Videos ready for transcription (have Grove URLs)
CREATE OR REPLACE VIEW videos_with_grove_storage AS
SELECT
  v.video_id,
  v.creator_username,
  v.grove_video_url,
  v.grove_uploaded_at,
  v.is_copyrighted,
  v.spotify_track_id,
  v.music_title,
  v.music_author
FROM tiktok_videos v
WHERE v.grove_video_cid IS NOT NULL;

COMMENT ON COLUMN tiktok_videos.grove_video_cid IS
  'Grove/IPFS CID for permanent video storage (never expires)';

COMMENT ON COLUMN tiktok_videos.grove_video_url IS
  'Grove public URL (https://api.grove.storage/<cid>) for video download';

COMMENT ON COLUMN tiktok_videos.grove_uploaded_at IS
  'Timestamp when video was uploaded to Grove';
