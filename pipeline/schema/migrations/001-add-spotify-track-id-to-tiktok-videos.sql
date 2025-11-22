-- Add Spotify track ID column to tiktok_videos
-- This allows us to link TikTok videos directly to Spotify tracks

ALTER TABLE tiktok_videos
ADD COLUMN IF NOT EXISTS spotify_track_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tiktok_videos_spotify ON tiktok_videos(spotify_track_id);
