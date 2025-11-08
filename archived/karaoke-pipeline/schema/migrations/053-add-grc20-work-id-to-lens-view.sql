-- Migration 053: Add GRC-20 work ID to videos_ready_for_lens_posting view
--
-- Purpose: Include work_grc20_id in view so Lens posts can reference GRC-20 entities
--
-- Context:
-- - Lens posts need grc20_work_id attribute for proper song page routing
-- - App uses /song/{grc20WorkId} routes, not /song/{spotifyTrackId}
--
-- Created: 2025-11-04

-- Update View: Videos ready for Lens posting (add work_grc20_id)
-- Drop and recreate to handle column reordering
DROP VIEW IF EXISTS videos_ready_for_lens_posting CASCADE;

CREATE VIEW videos_ready_for_lens_posting AS
SELECT
  v.video_id,
  v.creator_username,
  tc.nickname as creator_nickname,
  tc.lens_account_address as creator_lens_address,
  tc.pkp_address as creator_pkp_address,
  v.spotify_track_id,
  v.grove_video_cid,
  v.grove_thumbnail_cid,
  v.video_url,
  v.story_ip_id,
  v.story_metadata_uri,
  v.story_tx_hash,
  v.lens_post_attempts,
  v.lens_last_error,
  st.title as track_title,
  st.artists->0->>'name' as artist_name,
  st.image_url as track_image_url,
  gwm.grc20_entity_id as work_grc20_id,
  t.transcription_text,
  t.detected_language
FROM tiktok_videos v
JOIN tiktok_video_transcriptions t ON v.video_id = t.video_id
JOIN spotify_tracks st ON st.spotify_track_id = v.spotify_track_id
JOIN tiktok_creators_with_accounts tc ON tc.username = v.creator_username
LEFT JOIN genius_songs gs ON gs.spotify_track_id = st.spotify_track_id
LEFT JOIN grc20_work_mints gwm ON gwm.genius_song_id = gs.genius_song_id
WHERE v.story_ip_id IS NOT NULL
  AND v.lens_post_hash IS NULL
  AND v.lens_post_attempts < 3
  AND tc.lens_account_address IS NOT NULL;

COMMENT ON VIEW videos_ready_for_lens_posting IS
  'Videos ready for Lens posting: minted to Story Protocol, not yet posted, with GRC-20 work ID';

-- Success!
SELECT
  'Migration 053 complete' as status,
  COUNT(*) as videos_ready_for_lens,
  COUNT(*) FILTER (WHERE work_grc20_id IS NOT NULL) as with_grc20_work_id
FROM videos_ready_for_lens_posting;
