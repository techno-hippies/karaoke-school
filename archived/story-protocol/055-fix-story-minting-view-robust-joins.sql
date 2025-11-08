/**
 * Migration 055: Fix videos_ready_for_story_minting View with Robust JOINs
 *
 * PROBLEM: View fails at scale due to fragile JOIN strategy
 * - 80% of videos lost because view only joins grc20_work_mints by genius_song_id
 * - Works can be minted by ISWC OR genius_song_id, but view assumes only genius_song_id
 * - No fallback logic for missing identifiers
 *
 * ROOT CAUSE: Architectural mismatch between:
 *   1. Migration 050: Designed ISWC as primary join key
 *   2. Migration 051: Added genius_song_id as fallback
 *   3. View: Only uses genius_song_id (ignores ISWC)
 *
 * SOLUTION: Rebuild view with multi-identifier fallback strategy
 *
 * DESIGN PRINCIPLES FOR 10K-100K SCALE:
 * 1. Use COALESCE for fallback matching across multiple identifiers
 * 2. Prefer LEFT JOINs with NULL checks to identify missing data
 * 3. Add diagnostic columns to help debug pipeline failures
 * 4. Use CTEs for clarity and maintainability
 */

-- Step 1: Drop the broken view
DROP VIEW IF EXISTS videos_ready_for_story_minting;

-- Step 2: Create robust view with multi-identifier matching
CREATE OR REPLACE VIEW videos_ready_for_story_minting AS
WITH video_base AS (
  -- Get all copyrighted videos with Grove upload and transcriptions
  SELECT
    v.video_id,
    v.creator_username,
    v.spotify_track_id,
    v.grove_video_cid,
    v.video_url,
    v.story_mint_attempts,
    v.story_ip_id,
    t.transcription_text,
    t.detected_language,
    t.status as transcription_status
  FROM tiktok_videos v
  JOIN tiktok_video_transcriptions t ON v.video_id = t.video_id
  WHERE v.is_copyrighted = true
    AND v.grove_video_cid IS NOT NULL
    AND v.story_ip_id IS NULL
    AND t.status = 'translated'
    AND v.story_mint_attempts < 3
),
track_metadata AS (
  -- Get Spotify track metadata
  SELECT
    vb.*,
    st.title AS track_title,
    (st.artists -> 0) ->> 'name' AS artist_name
  FROM video_base vb
  JOIN spotify_tracks st ON st.spotify_track_id = vb.spotify_track_id
),
genius_metadata AS (
  -- Get Genius song metadata
  SELECT
    tm.*,
    gs.genius_song_id,
    gs.title as genius_title
  FROM track_metadata tm
  LEFT JOIN genius_songs gs ON gs.spotify_track_id = tm.spotify_track_id
),
work_mints AS (
  -- Join with grc20_work_mints using BOTH genius_song_id AND ISWC fallback
  -- This is the CRITICAL fix: Use LEFT JOIN to see why videos are failing
  SELECT
    gm.*,
    gwm.grc20_entity_id AS work_grc20_id,
    gwm.iswc AS minted_iswc,
    gwm.genius_song_id AS minted_genius_id,
    gw.iswc AS work_iswc,
    gw.id AS work_id
  FROM genius_metadata gm
  LEFT JOIN genius_songs gs ON gs.spotify_track_id = gm.spotify_track_id
  LEFT JOIN grc20_works gw ON (
    -- Try matching by genius_song_id first
    gw.genius_song_id = gm.genius_song_id
    -- Fall back to spotify_track_id if needed
    OR gw.spotify_track_id = gm.spotify_track_id
  )
  LEFT JOIN grc20_work_mints gwm ON (
    -- Match by genius_song_id (preferred for newer mints)
    (gwm.genius_song_id IS NOT NULL AND gwm.genius_song_id = gm.genius_song_id)
    -- Fall back to ISWC matching (for older mints)
    OR (gwm.iswc IS NOT NULL AND gwm.iswc = gw.iswc)
  )
),
recording_mints AS (
  -- Join with grc20_recording_mints
  SELECT
    wm.*,
    grm.grc20_entity_id AS recording_grc20_id
  FROM work_mints wm
  LEFT JOIN grc20_recording_mints grm ON grm.spotify_track_id = wm.spotify_track_id
),
creator_accounts AS (
  -- Join with creator accounts
  SELECT
    rm.*,
    tc.nickname AS creator_nickname,
    tc.lens_account_id,
    tc.pkp_account_id,
    la.lens_account_address AS creator_lens_address,
    pkp.pkp_address AS creator_pkp_address
  FROM recording_mints rm
  LEFT JOIN tiktok_creators tc ON tc.username = rm.creator_username
  LEFT JOIN lens_accounts la ON tc.lens_account_id = la.id
  LEFT JOIN pkp_accounts pkp ON tc.pkp_account_id = pkp.id
)
-- Final selection: Only include videos with BOTH work and recording minted
SELECT
  video_id,
  creator_username,
  spotify_track_id,
  grove_video_cid,
  video_url,
  story_mint_attempts,
  track_title,
  artist_name,
  genius_song_id,
  work_grc20_id,
  recording_grc20_id,
  transcription_text,
  detected_language,
  creator_nickname,
  creator_lens_address,
  creator_pkp_address
FROM creator_accounts
WHERE work_grc20_id IS NOT NULL
  AND recording_grc20_id IS NOT NULL;

COMMENT ON VIEW videos_ready_for_story_minting IS
'Videos ready for Story Protocol minting with robust multi-identifier matching.
Uses fallback logic: genius_song_id → ISWC → spotify_track_id for work matching.
Designed to handle 10k-100k videos at scale.';

-- Step 3: Create diagnostic view to identify WHY videos are failing
CREATE OR REPLACE VIEW videos_story_mint_blockers AS
WITH video_base AS (
  SELECT
    v.video_id,
    v.creator_username,
    v.spotify_track_id,
    v.grove_video_cid,
    v.story_mint_attempts,
    t.status as transcription_status
  FROM tiktok_videos v
  LEFT JOIN tiktok_video_transcriptions t ON v.video_id = t.video_id
  WHERE v.is_copyrighted = true
    AND v.grove_video_cid IS NOT NULL
    AND v.story_ip_id IS NULL
    AND v.story_mint_attempts < 3
)
SELECT
  vb.video_id,
  vb.spotify_track_id,
  st.title,
  CASE
    WHEN vb.transcription_status IS NULL THEN 'missing_transcription'
    WHEN vb.transcription_status != 'translated' THEN 'transcription_not_translated'
    WHEN st.spotify_track_id IS NULL THEN 'missing_spotify_track'
    WHEN gs.genius_song_id IS NULL THEN 'missing_genius_song'
    WHEN gw.id IS NULL THEN 'work_not_in_grc20_works'
    WHEN gwm.grc20_entity_id IS NULL THEN 'work_not_minted'
    WHEN grm.grc20_entity_id IS NULL THEN 'recording_not_minted'
    ELSE 'unknown'
  END AS blocker_reason,
  -- Diagnostic fields
  vb.transcription_status,
  gs.genius_song_id,
  gw.id AS work_id,
  gw.iswc,
  gwm.grc20_entity_id AS work_minted,
  grm.grc20_entity_id AS recording_minted
FROM video_base vb
LEFT JOIN spotify_tracks st ON st.spotify_track_id = vb.spotify_track_id
LEFT JOIN genius_songs gs ON gs.spotify_track_id = vb.spotify_track_id
LEFT JOIN grc20_works gw ON (
  gw.genius_song_id = gs.genius_song_id
  OR gw.spotify_track_id = vb.spotify_track_id
)
LEFT JOIN grc20_work_mints gwm ON (
  (gwm.genius_song_id IS NOT NULL AND gwm.genius_song_id = gs.genius_song_id)
  OR (gwm.iswc IS NOT NULL AND gwm.iswc = gw.iswc)
)
LEFT JOIN grc20_recording_mints grm ON grm.spotify_track_id = vb.spotify_track_id
WHERE NOT EXISTS (
  SELECT 1 FROM videos_ready_for_story_minting
  WHERE video_id = vb.video_id
);

COMMENT ON VIEW videos_story_mint_blockers IS
'Diagnostic view showing WHY videos are not appearing in videos_ready_for_story_minting.
Use this to identify systematic pipeline failures and missing data at scale.';

-- Step 4: Add index to support the new view's JOIN strategy
-- (Most indexes already exist, but ensure genius_song_id is indexed in grc20_works)
CREATE INDEX IF NOT EXISTS idx_grc20_works_genius_song_id
ON grc20_works(genius_song_id)
WHERE genius_song_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_grc20_works_spotify_track_id
ON grc20_works(spotify_track_id)
WHERE spotify_track_id IS NOT NULL;

-- Step 5: Create function to backfill missing genius_song_id in grc20_work_mints
CREATE OR REPLACE FUNCTION backfill_work_mints_genius_id()
RETURNS TABLE (
  updated_count BIGINT,
  message TEXT
) AS $$
DECLARE
  v_count BIGINT;
BEGIN
  -- Update grc20_work_mints to populate genius_song_id from grc20_works
  WITH updated AS (
    UPDATE grc20_work_mints gwm
    SET genius_song_id = gw.genius_song_id
    FROM grc20_works gw
    WHERE (
      -- Match by ISWC
      (gwm.iswc IS NOT NULL AND gwm.iswc = gw.iswc)
      -- Or match by spotify_track_id via grc20_work_recordings
      OR EXISTS (
        SELECT 1 FROM grc20_work_recordings gwr
        WHERE gwr.spotify_track_id IN (
          SELECT spotify_track_id FROM grc20_recording_mints
          WHERE grc20_entity_id = gwm.grc20_entity_id
        )
        AND gwr.iswc = gwm.iswc
      )
    )
    AND gwm.genius_song_id IS NULL
    AND gw.genius_song_id IS NOT NULL
    RETURNING gwm.id
  )
  SELECT COUNT(*) INTO v_count FROM updated;

  RETURN QUERY SELECT v_count, format('Updated %s grc20_work_mints records with genius_song_id', v_count);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION backfill_work_mints_genius_id IS
'Backfills missing genius_song_id values in grc20_work_mints from grc20_works.
Run this after minting works by ISWC to enable genius_song_id matching.';

-- Step 6: Run the backfill immediately
SELECT * FROM backfill_work_mints_genius_id();

-- Step 7: Verify the fix
DO $$
DECLARE
  v_before INT;
  v_after INT;
BEGIN
  -- This is a post-migration check
  SELECT COUNT(*) INTO v_after FROM videos_ready_for_story_minting;

  RAISE NOTICE 'Migration 055 complete:';
  RAISE NOTICE '  - videos_ready_for_story_minting now has % videos', v_after;
  RAISE NOTICE '  - Run: SELECT * FROM videos_story_mint_blockers; to see remaining blockers';
END $$;
