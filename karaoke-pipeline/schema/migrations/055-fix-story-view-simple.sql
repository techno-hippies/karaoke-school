-- Migration 055 (Simple): Fix videos_ready_for_story_minting View
-- Problem: View only matches by genius_song_id, missing 80% of minted works
-- Solution: Use robust multi-identifier matching

DROP VIEW IF EXISTS videos_ready_for_story_minting CASCADE;

CREATE VIEW videos_ready_for_story_minting AS
SELECT
  v.video_id,
  v.creator_username,
  v.spotify_track_id,
  v.grove_video_cid,
  v.video_url,
  v.story_mint_attempts,
  st.title AS track_title,
  (st.artists -> 0) ->> 'name' AS artist_name,
  gs.genius_song_id,
  gwm.grc20_entity_id AS work_grc20_id,
  grm.grc20_entity_id AS recording_grc20_id,
  t.transcription_text,
  t.detected_language,
  tc.nickname AS creator_nickname,
  la.lens_account_address AS creator_lens_address,
  pkp.pkp_address AS creator_pkp_address
FROM tiktok_videos v
JOIN tiktok_video_transcriptions t ON v.video_id = t.video_id
JOIN spotify_tracks st ON st.spotify_track_id = v.spotify_track_id
LEFT JOIN genius_songs gs ON gs.spotify_track_id = st.spotify_track_id
LEFT JOIN grc20_works gw ON (
  gw.genius_song_id = gs.genius_song_id
  OR gw.spotify_track_id = st.spotify_track_id
)
LEFT JOIN grc20_work_mints gwm ON (
  -- Match by genius_song_id (preferred)
  (gwm.genius_song_id IS NOT NULL AND gwm.genius_song_id = gs.genius_song_id)
  OR
  -- Fall back to ISWC matching (for works minted by ISWC)
  (gwm.iswc IS NOT NULL AND gw.iswc IS NOT NULL AND gwm.iswc = gw.iswc)
)
LEFT JOIN grc20_recording_mints grm ON grm.spotify_track_id = st.spotify_track_id
JOIN tiktok_creators tc ON tc.username = v.creator_username
LEFT JOIN lens_accounts la ON tc.lens_account_id = la.id
LEFT JOIN pkp_accounts pkp ON tc.pkp_account_id = pkp.id
WHERE v.is_copyrighted = true
  AND v.grove_video_cid IS NOT NULL
  AND v.story_ip_id IS NULL
  AND t.status = 'translated'
  AND gwm.grc20_entity_id IS NOT NULL
  AND grm.grc20_entity_id IS NOT NULL
  AND v.story_mint_attempts < 3;

COMMENT ON VIEW videos_ready_for_story_minting IS
'Videos ready for Story Protocol minting with robust multi-identifier matching.
Uses fallback: genius_song_id OR ISWC for work matching. Designed for 10k-100k scale.';
