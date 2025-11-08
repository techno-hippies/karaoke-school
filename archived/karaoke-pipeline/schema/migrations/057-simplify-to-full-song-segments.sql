-- Migration 057: Simplify to Full-Song Segments
-- Purpose: Remove "optimal segment" complexity, use full song (up to 190s)
-- Reason: AI-selected segments cause broken line breaks ("Gone blind can't.")
--
-- Changes:
-- 1. Update all segments to use 0ms → min(duration, 190000ms)
-- 2. Simplify trigger: assign segment_hash if line.start_ms < 190000ms
-- 3. Re-compute all segment_hash associations

-- ============================================================
-- STEP 1: Update existing segments to use full 190s
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
WHERE optimal_segment_start_ms IS NOT NULL
  OR optimal_segment_end_ms IS NOT NULL;

-- Also update clip boundaries to match (for consistency)
UPDATE karaoke_segments ks
SET
  clip_start_ms = 0,
  clip_end_ms = optimal_segment_end_ms,
  clip_relative_start_ms = 0,
  clip_relative_end_ms = optimal_segment_end_ms,
  updated_at = NOW();

-- ============================================================
-- STEP 2: Replace trigger with simplified logic
-- ============================================================

-- Drop old trigger
DROP TRIGGER IF EXISTS trg_karaoke_lines_segment_association ON karaoke_lines;

-- Replace trigger function with simplified version
CREATE OR REPLACE FUNCTION update_line_segment_association()
RETURNS TRIGGER AS $$
BEGIN
  -- Simplified logic: assign segment_hash if line starts within first 190s
  -- Uses sha256 since we don't have keccak256 in PostgreSQL
  -- Format: sha256(spotify_track_id || '0')

  IF NEW.start_ms < 190000 THEN
    -- Line is within first 190s → belongs to segment
    SELECT compute_segment_hash(NEW.spotify_track_id, 0)
    INTO NEW.segment_hash;
  ELSE
    -- Line is beyond 190s → no segment
    NEW.segment_hash = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create trigger
CREATE TRIGGER trg_karaoke_lines_segment_association
  BEFORE INSERT OR UPDATE ON karaoke_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_line_segment_association();

-- ============================================================
-- STEP 3: Re-compute all segment associations
-- ============================================================

-- Force trigger to re-run for all existing lines
UPDATE karaoke_lines
SET updated_at = NOW();

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check how many lines now have segments
DO $$
DECLARE
  v_total_lines INT;
  v_lines_with_segment INT;
  v_lines_without_segment INT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE segment_hash IS NOT NULL),
    COUNT(*) FILTER (WHERE segment_hash IS NULL)
  INTO v_total_lines, v_lines_with_segment, v_lines_without_segment
  FROM karaoke_lines;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Migration 057 Complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total lines:            %', v_total_lines;
  RAISE NOTICE 'Lines with segment:     % (%.1f%%)',
    v_lines_with_segment,
    (v_lines_with_segment::FLOAT / NULLIF(v_total_lines, 0) * 100);
  RAISE NOTICE 'Lines without segment:  % (%.1f%%)',
    v_lines_without_segment,
    (v_lines_without_segment::FLOAT / NULLIF(v_total_lines, 0) * 100);
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;

-- Show sample of segment boundaries
SELECT
  st.spotify_track_id,
  st.title,
  st.duration_ms,
  ks.optimal_segment_start_ms,
  ks.optimal_segment_end_ms,
  (ks.optimal_segment_end_ms - ks.optimal_segment_start_ms) as segment_duration_ms,
  COUNT(kl.line_id) as line_count
FROM karaoke_segments ks
JOIN spotify_tracks st ON ks.spotify_track_id = st.spotify_track_id
LEFT JOIN karaoke_lines kl ON kl.segment_hash = compute_segment_hash(ks.spotify_track_id, 0)
GROUP BY st.spotify_track_id, st.title, st.duration_ms,
         ks.optimal_segment_start_ms, ks.optimal_segment_end_ms
ORDER BY st.title
LIMIT 10;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON FUNCTION update_line_segment_association() IS
  'Simplified trigger: assigns segment_hash if line starts within first 190s. All segments now start at 0ms.';
