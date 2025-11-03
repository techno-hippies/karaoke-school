-- Add missing foreign key constraints to song_pipeline
-- Critical for data integrity when wiping/rebuilding tables

-- 1. Add foreign key to tiktok_videos
-- Use ON DELETE CASCADE: if TikTok video deleted, remove pipeline entry
ALTER TABLE song_pipeline
  ADD CONSTRAINT song_pipeline_tiktok_video_fkey
  FOREIGN KEY (tiktok_video_id)
  REFERENCES tiktok_videos(video_id)
  ON DELETE CASCADE;

-- 2. Add foreign key to spotify_tracks
-- Use ON DELETE RESTRICT: don't allow deleting Spotify tracks still in pipeline
-- (Spotify metadata is shared across multiple TikTok videos)
ALTER TABLE song_pipeline
  ADD CONSTRAINT song_pipeline_spotify_track_fkey
  FOREIGN KEY (spotify_track_id)
  REFERENCES spotify_tracks(spotify_track_id)
  ON DELETE RESTRICT;

-- Add helpful comments
COMMENT ON CONSTRAINT song_pipeline_tiktok_video_fkey ON song_pipeline IS
  'CASCADE: Deleting TikTok video removes pipeline entry (video is source of truth)';

COMMENT ON CONSTRAINT song_pipeline_spotify_track_fkey ON song_pipeline IS
  'RESTRICT: Prevents deleting Spotify metadata while tracks are being processed';
