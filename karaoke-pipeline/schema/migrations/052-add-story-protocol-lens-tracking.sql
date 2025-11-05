-- Migration 052: Add Story Protocol and Lens tracking to tiktok_videos
--
-- Purpose: Track Story Protocol IP asset minting and Lens Protocol posting
-- for copyrighted TikTok creator videos
--
-- Context:
-- - Each video = ONE Story IP asset (18% creator / 82% rights holders)
-- - Each video = ONE Lens post to custom feed
-- - Simple 1:1 relationship, no need for separate tables
--
-- Created: 2025-11-04

-- Add Story Protocol columns
ALTER TABLE tiktok_videos
  ADD COLUMN IF NOT EXISTS story_ip_id TEXT,
  ADD COLUMN IF NOT EXISTS story_metadata_uri TEXT,
  ADD COLUMN IF NOT EXISTS story_tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS story_license_terms_ids TEXT[],
  ADD COLUMN IF NOT EXISTS story_royalty_vault TEXT,
  ADD COLUMN IF NOT EXISTS story_minted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS story_mint_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS story_last_error TEXT;

-- Add Lens Protocol columns
ALTER TABLE tiktok_videos
  ADD COLUMN IF NOT EXISTS lens_post_hash TEXT,
  ADD COLUMN IF NOT EXISTS lens_post_uri TEXT,
  ADD COLUMN IF NOT EXISTS lens_posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lens_post_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lens_last_error TEXT;

-- Add comments for clarity
COMMENT ON COLUMN tiktok_videos.story_ip_id IS 'Story Protocol IP Asset ID (0x...)';
COMMENT ON COLUMN tiktok_videos.story_metadata_uri IS 'Grove URI for Story Protocol metadata JSON';
COMMENT ON COLUMN tiktok_videos.story_tx_hash IS 'Transaction hash of Story Protocol minting';
COMMENT ON COLUMN tiktok_videos.story_license_terms_ids IS 'Array of license term IDs (usually one for Commercial Remix)';
COMMENT ON COLUMN tiktok_videos.story_royalty_vault IS 'Royalty vault address for IP asset';
COMMENT ON COLUMN tiktok_videos.story_minted_at IS 'Timestamp when video was minted to Story Protocol';
COMMENT ON COLUMN tiktok_videos.story_mint_attempts IS 'Number of minting attempts (for retry logic)';
COMMENT ON COLUMN tiktok_videos.story_last_error IS 'Last error message if minting failed';
COMMENT ON COLUMN tiktok_videos.lens_post_hash IS 'Lens Protocol post hash/ID';
COMMENT ON COLUMN tiktok_videos.lens_post_uri IS 'Grove URI for Lens post metadata JSON';
COMMENT ON COLUMN tiktok_videos.lens_posted_at IS 'Timestamp when posted to Lens feed';
COMMENT ON COLUMN tiktok_videos.lens_post_attempts IS 'Number of post attempts (for retry logic)';
COMMENT ON COLUMN tiktok_videos.lens_last_error IS 'Last error message if Lens posting failed';

-- Index: Videos ready for Story Protocol minting
-- (copyrighted + grove uploaded + not yet minted + under retry limit)
CREATE INDEX IF NOT EXISTS idx_videos_story_mintable
  ON tiktok_videos(video_id)
  WHERE is_copyrighted = TRUE
    AND grove_video_cid IS NOT NULL
    AND story_ip_id IS NULL
    AND story_mint_attempts < 3;

-- Index: Videos ready for Lens posting
-- (minted to Story + not yet posted + under retry limit)
CREATE INDEX IF NOT EXISTS idx_videos_lens_postable
  ON tiktok_videos(video_id)
  WHERE story_ip_id IS NOT NULL
    AND lens_post_hash IS NULL
    AND lens_post_attempts < 3;

-- Index: Videos with Story Protocol IP assets (for queries)
CREATE INDEX IF NOT EXISTS idx_videos_story_ip_id
  ON tiktok_videos(story_ip_id)
  WHERE story_ip_id IS NOT NULL;

-- Index: Videos with Lens posts (for feed queries)
CREATE INDEX IF NOT EXISTS idx_videos_lens_post_hash
  ON tiktok_videos(lens_post_hash)
  WHERE lens_post_hash IS NOT NULL;

-- Index: Failed minting attempts (for debugging)
CREATE INDEX IF NOT EXISTS idx_videos_story_failed
  ON tiktok_videos(video_id, story_last_error, story_mint_attempts)
  WHERE story_last_error IS NOT NULL;

-- View: Videos ready for Story Protocol minting
CREATE OR REPLACE VIEW videos_ready_for_story_minting AS
SELECT
  v.video_id,
  v.creator_username,
  v.spotify_track_id,
  v.grove_video_cid,
  v.story_mint_attempts,
  v.story_last_error,
  st.title as track_title,
  st.artists->0->>'name' as artist_name,
  gs.genius_song_id,
  gwm.grc20_entity_id as work_grc20_id,
  grm.grc20_entity_id as recording_grc20_id,
  t.transcription_text,
  t.detected_language
FROM tiktok_videos v
JOIN tiktok_video_transcriptions t ON v.video_id = t.video_id
JOIN spotify_tracks st ON st.spotify_track_id = v.spotify_track_id
JOIN genius_songs gs ON gs.spotify_track_id = st.spotify_track_id
JOIN grc20_work_mints gwm ON gwm.genius_song_id = gs.genius_song_id
JOIN grc20_recording_mints grm ON grm.spotify_track_id = st.spotify_track_id
WHERE v.is_copyrighted = TRUE
  AND v.grove_video_cid IS NOT NULL
  AND v.story_ip_id IS NULL
  AND t.status = 'translated'
  AND gwm.grc20_entity_id IS NOT NULL
  AND grm.grc20_entity_id IS NOT NULL
  AND v.story_mint_attempts < 3;

COMMENT ON VIEW videos_ready_for_story_minting IS
  'Videos ready for Story Protocol minting: copyrighted, transcribed, grove uploaded, GRC-20 minted, not yet minted to Story';

-- View: Videos ready for Lens posting
CREATE OR REPLACE VIEW videos_ready_for_lens_posting AS
SELECT
  v.video_id,
  v.creator_username,
  v.spotify_track_id,
  v.grove_video_cid,
  v.story_ip_id,
  v.story_metadata_uri,
  v.lens_post_attempts,
  v.lens_last_error,
  st.title as track_title,
  st.artists->0->>'name' as artist_name,
  t.transcription_text
FROM tiktok_videos v
JOIN tiktok_video_transcriptions t ON v.video_id = t.video_id
JOIN spotify_tracks st ON st.spotify_track_id = v.spotify_track_id
WHERE v.story_ip_id IS NOT NULL
  AND v.lens_post_hash IS NULL
  AND v.lens_post_attempts < 3;

COMMENT ON VIEW videos_ready_for_lens_posting IS
  'Videos ready for Lens posting: minted to Story Protocol but not yet posted to Lens feed';

-- Success!
SELECT
  'Migration 052 complete' as status,
  COUNT(*) FILTER (WHERE story_ip_id IS NULL AND grove_video_cid IS NOT NULL AND is_copyrighted = TRUE) as videos_ready_for_story,
  COUNT(*) FILTER (WHERE story_ip_id IS NOT NULL) as videos_minted_to_story,
  COUNT(*) FILTER (WHERE lens_post_hash IS NOT NULL) as videos_posted_to_lens
FROM tiktok_videos;
