-- Add Grove video storage to tiktok_videos
ALTER TABLE tiktok_videos
  ADD COLUMN IF NOT EXISTS grove_video_cid TEXT,
  ADD COLUMN IF NOT EXISTS grove_video_url TEXT,
  ADD COLUMN IF NOT EXISTS grove_thumbnail_cid TEXT,
  ADD COLUMN IF NOT EXISTS grove_thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS grove_uploaded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_videos_grove_missing
  ON tiktok_videos(video_id)
  WHERE grove_video_cid IS NULL;

COMMENT ON COLUMN tiktok_videos.grove_video_cid IS 'Grove/IPFS CID for permanent video storage';
COMMENT ON COLUMN tiktok_videos.grove_video_url IS 'Grove public URL for video download';
COMMENT ON COLUMN tiktok_videos.grove_thumbnail_cid IS 'Grove/IPFS CID for video thumbnail';
