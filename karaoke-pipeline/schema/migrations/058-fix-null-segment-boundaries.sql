-- Migration 058: Fix NULL segment boundaries
-- Purpose: Update segments that migration 057 missed
-- Issue: Migration 057 WHERE clause skipped segments where BOTH boundaries were NULL
--
-- This fixes 16 segments that have:
-- - NULL optimal_segment_start_ms
-- - NULL optimal_segment_end_ms
-- - Result: No lines sent to Grove metadata → broken sayitback exercises

-- ============================================================
-- STEP 1: Update NULL segments to use full song (up to 190s)
-- ============================================================

UPDATE karaoke_segments ks
SET
  optimal_segment_start_ms = 0,
  optimal_segment_end_ms = LEAST(
    (SELECT duration_ms
     FROM spotify_tracks st
     WHERE st.spotify_track_id = ks.spotify_track_id),
    190000
  ),
  updated_at = NOW()
WHERE optimal_segment_start_ms IS NULL
  AND optimal_segment_end_ms IS NULL;

-- ============================================================
-- STEP 2: Also update clip boundaries to match
-- ============================================================

UPDATE karaoke_segments ks
SET
  clip_start_ms = 0,
  clip_end_ms = optimal_segment_end_ms,
  clip_relative_start_ms = 0,
  clip_relative_end_ms = optimal_segment_end_ms,
  updated_at = NOW()
WHERE optimal_segment_start_ms = 0
  AND optimal_segment_end_ms IS NOT NULL
  AND (clip_start_ms != 0 OR clip_end_ms IS NULL OR clip_end_ms != optimal_segment_end_ms);

-- ============================================================
-- STEP 3: Force trigger to re-run for affected tracks
-- ============================================================

-- Get affected track IDs and update their karaoke_lines
UPDATE karaoke_lines
SET updated_at = NOW()
WHERE spotify_track_id IN (
  SELECT spotify_track_id
  FROM karaoke_segments
  WHERE optimal_segment_start_ms = 0
    AND optimal_segment_end_ms IS NOT NULL
);

-- ============================================================
-- VERIFICATION
-- ============================================================

DO $$
DECLARE
  v_complete_segments INT;
  v_incomplete_segments INT;
  v_lines_with_segment INT;
  v_total_lines INT;
BEGIN
  -- Count segment status
  SELECT
    COUNT(*) FILTER (WHERE optimal_segment_start_ms IS NOT NULL AND optimal_segment_end_ms IS NOT NULL),
    COUNT(*) FILTER (WHERE optimal_segment_start_ms IS NULL OR optimal_segment_end_ms IS NULL)
  INTO v_complete_segments, v_incomplete_segments
  FROM karaoke_segments;

  -- Count line associations
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE segment_hash IS NOT NULL)
  INTO v_total_lines, v_lines_with_segment
  FROM karaoke_lines;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Migration 058 Complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Segments:';
  RAISE NOTICE '  Complete:   % (have boundaries)', v_complete_segments;
  RAISE NOTICE '  Incomplete: % (NULL boundaries)', v_incomplete_segments;
  RAISE NOTICE '';
  RAISE NOTICE 'Lines:';
  RAISE NOTICE '  Total:        %', v_total_lines;
  RAISE NOTICE '  With segment: % (%.1f%%)',
    v_lines_with_segment,
    (v_lines_with_segment::FLOAT / NULLIF(v_total_lines, 0) * 100);
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;

-- Show sample of fixed segments
SELECT
  ks.spotify_track_id,
  st.title,
  ks.optimal_segment_start_ms,
  ks.optimal_segment_end_ms,
  ks.clip_start_ms,
  ks.clip_end_ms,
  COUNT(kl.line_id) as line_count
FROM karaoke_segments ks
JOIN spotify_tracks st ON ks.spotify_track_id = st.spotify_track_id
LEFT JOIN karaoke_lines kl ON kl.segment_hash = compute_segment_hash(ks.spotify_track_id, 0)
WHERE ks.optimal_segment_start_ms = 0
  AND ks.optimal_segment_end_ms IS NOT NULL
GROUP BY ks.spotify_track_id, st.title,
         ks.optimal_segment_start_ms, ks.optimal_segment_end_ms,
         ks.clip_start_ms, ks.clip_end_ms
ORDER BY ks.updated_at DESC
LIMIT 10;
