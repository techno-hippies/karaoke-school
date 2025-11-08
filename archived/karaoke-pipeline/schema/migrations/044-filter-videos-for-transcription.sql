-- Update video selection logic for transcription
-- Only process:
-- 1. Copyrighted videos that completed the full pipeline (will be minted)
-- 2. Uncopyrighted videos (to detect if they're actually copyrighted via similarity)

-- Drop old views (CASCADE to handle dependent views)
DROP VIEW IF EXISTS copyrighted_videos_ready_for_transcription CASCADE;
DROP VIEW IF EXISTS uncopyrighted_videos_to_check CASCADE;
DROP VIEW IF EXISTS videos_ready_for_transcription CASCADE;

-- Recreate with proper filtering (use Grove URLs!)
CREATE OR REPLACE VIEW videos_ready_for_transcription AS
SELECT
  v.video_id,
  v.creator_username,
  v.description,
  v.duration_seconds,
  v.play_count,
  v.grove_video_url as video_url,  -- Use Grove URL instead of expiring TikTok URL
  v.video_created_at,
  v.is_copyrighted,
  sp.status as pipeline_status,
  sp.spotify_track_id
FROM tiktok_videos v
LEFT JOIN song_pipeline sp ON sp.tiktok_video_id = v.video_id
WHERE NOT EXISTS (
  SELECT 1 FROM tiktok_video_transcriptions t
  WHERE t.video_id = v.video_id
)
AND v.grove_video_url IS NOT NULL  -- Must have Grove URL
AND v.duration_seconds > 0
AND (
  -- Copyrighted videos that completed full pipeline
  (
    v.is_copyrighted = TRUE
    AND sp.status IN ('clips_cropped', 'audio_downloaded', 'translations_ready')
  )
  -- OR uncopyrighted videos (to check if actually copyrighted)
  OR (
    v.is_copyrighted = FALSE
    OR v.is_copyrighted IS NULL
  )
)
ORDER BY
  -- Priority: copyrighted pipeline-complete first, then uncopyrighted
  CASE
    WHEN v.is_copyrighted = TRUE AND sp.status IS NOT NULL THEN 1
    ELSE 2
  END,
  v.play_count DESC NULLS LAST;

-- View for copyrighted videos ready for transcription
CREATE OR REPLACE VIEW copyrighted_videos_ready_for_transcription AS
SELECT *
FROM videos_ready_for_transcription
WHERE is_copyrighted = TRUE
  AND pipeline_status IS NOT NULL;

-- View for uncopyrighted videos (potential false negatives)
CREATE OR REPLACE VIEW uncopyrighted_videos_to_check AS
SELECT *
FROM videos_ready_for_transcription
WHERE is_copyrighted = FALSE OR is_copyrighted IS NULL;

COMMENT ON VIEW videos_ready_for_transcription IS
  'Videos ready for transcription. Prioritizes copyrighted videos that completed pipeline (will be minted) and uncopyrighted videos (to detect false negatives via similarity).';

COMMENT ON VIEW copyrighted_videos_ready_for_transcription IS
  'Only copyrighted videos that completed the full pipeline. These will be minted to Story Protocol.';

COMMENT ON VIEW uncopyrighted_videos_to_check IS
  'Videos marked as uncopyrighted. Process these to detect if they are actually copyrighted via similarity to lrclib corpus.';
