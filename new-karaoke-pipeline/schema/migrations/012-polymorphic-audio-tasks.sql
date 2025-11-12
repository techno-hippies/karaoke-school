-- Migration 012: Polymorphic audio_tasks for TikTok video publishing
--
-- Extends audio_tasks to support multiple subject types (tracks + TikTok videos)
-- by adding subject_type and subject_id columns for polymorphic relationships.
--
-- This allows reusing the battle-tested BaseTask infrastructure (retry logic,
-- exponential backoff, monitoring queries) for TikTok→Lens publishing flow.

-- 1. Add polymorphic columns
ALTER TABLE audio_tasks
  ADD COLUMN IF NOT EXISTS subject_type TEXT DEFAULT 'track',
  ADD COLUMN IF NOT EXISTS subject_id TEXT;

-- 2. Backfill existing rows (all current tasks are track-level)
UPDATE audio_tasks
SET subject_type = 'track',
    subject_id = spotify_track_id
WHERE subject_type IS NULL OR subject_id IS NULL;

-- 3. Make subject_id NOT NULL now that backfill is complete
ALTER TABLE audio_tasks
  ALTER COLUMN subject_id SET NOT NULL;

-- 4. Make spotify_track_id nullable (kept for backward compatibility)
--    New TikTok video tasks will have subject_type='tiktok_video', subject_id=video_id, spotify_track_id=NULL
ALTER TABLE audio_tasks
  ALTER COLUMN spotify_track_id DROP NOT NULL;

-- 5. Add constraint: subject_type must be 'track' or 'tiktok_video'
ALTER TABLE audio_tasks
  ADD CONSTRAINT audio_tasks_subject_type_check
  CHECK (subject_type IN ('track', 'tiktok_video'));

-- 6. Add constraint: if subject_type='track', spotify_track_id must be set
ALTER TABLE audio_tasks
  ADD CONSTRAINT audio_tasks_track_consistency_check
  CHECK (
    (subject_type = 'track' AND spotify_track_id IS NOT NULL AND subject_id = spotify_track_id)
    OR
    (subject_type = 'tiktok_video' AND spotify_track_id IS NULL)
  );

-- 7. Update unique constraint to use polymorphic keys
--    Drop old constraint (spotify_track_id, task_type)
ALTER TABLE audio_tasks
  DROP CONSTRAINT IF EXISTS audio_tasks_spotify_track_id_task_type_key;

-- Add new constraint (subject_type, subject_id, task_type)
ALTER TABLE audio_tasks
  ADD CONSTRAINT audio_tasks_subject_task_unique
  UNIQUE (subject_type, subject_id, task_type);

-- 8. Add composite index for efficient queries
CREATE INDEX IF NOT EXISTS idx_audio_tasks_subject
  ON audio_tasks(subject_type, subject_id, task_type, status);

-- 9. Add index for TikTok video lookups
CREATE INDEX IF NOT EXISTS idx_audio_tasks_tiktok_videos
  ON audio_tasks(subject_id, status)
  WHERE subject_type = 'tiktok_video';

-- 10. Add 'skipped' status to TaskStatus enum (for tasks not applicable to subject)
ALTER TABLE audio_tasks
  DROP CONSTRAINT IF EXISTS audio_tasks_status_check;

ALTER TABLE audio_tasks
  ADD CONSTRAINT audio_tasks_status_check
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped'));

-- 11. Update populate_audio_tasks() trigger to use subject_type
--     (Keeps existing track-level behavior, TikTok tasks populated manually)
DROP TRIGGER IF EXISTS populate_audio_tasks_trigger ON tracks;
DROP FUNCTION IF EXISTS populate_audio_tasks();

CREATE OR REPLACE FUNCTION populate_audio_tasks()
RETURNS TRIGGER AS $$
BEGIN
  -- All existing stage transitions use subject_type='track', subject_id=spotify_track_id

  -- Stage: audio_ready → align task should be pending
  IF NEW.stage = 'audio_ready' AND (OLD.stage IS NULL OR OLD.stage != 'audio_ready') THEN
    INSERT INTO audio_tasks (subject_type, subject_id, spotify_track_id, task_type, status, max_attempts)
    VALUES ('track', NEW.spotify_track_id, NEW.spotify_track_id, 'align', 'pending', 3)
    ON CONFLICT (subject_type, subject_id, task_type) DO NOTHING;
  END IF;

  -- Stage: aligned → translate task should be pending
  IF NEW.stage = 'aligned' AND (OLD.stage IS NULL OR OLD.stage != 'aligned') THEN
    INSERT INTO audio_tasks (subject_type, subject_id, spotify_track_id, task_type, status, max_attempts)
    VALUES ('track', NEW.spotify_track_id, NEW.spotify_track_id, 'translate', 'pending', 3)
    ON CONFLICT (subject_type, subject_id, task_type) DO NOTHING;
  END IF;

  -- Stage: translated → separate task should be pending
  IF NEW.stage = 'translated' AND (OLD.stage IS NULL OR OLD.stage != 'translated') THEN
    INSERT INTO audio_tasks (subject_type, subject_id, spotify_track_id, task_type, status, max_attempts)
    VALUES ('track', NEW.spotify_track_id, NEW.spotify_track_id, 'separate', 'pending', 3)
    ON CONFLICT (subject_type, subject_id, task_type) DO NOTHING;
  END IF;

  -- Stage: separated → segment task should be pending
  IF NEW.stage = 'separated' AND (OLD.stage IS NULL OR OLD.stage != 'separated') THEN
    INSERT INTO audio_tasks (subject_type, subject_id, spotify_track_id, task_type, status, max_attempts)
    VALUES ('track', NEW.spotify_track_id, NEW.spotify_track_id, 'segment', 'pending', 3)
    ON CONFLICT (subject_type, subject_id, task_type) DO NOTHING;
  END IF;

  -- Stage: segmented → enhance task should be pending
  IF NEW.stage = 'segmented' AND (OLD.stage IS NULL OR OLD.stage != 'segmented') THEN
    INSERT INTO audio_tasks (subject_type, subject_id, spotify_track_id, task_type, status, max_attempts)
    VALUES ('track', NEW.spotify_track_id, NEW.spotify_track_id, 'enhance', 'pending', 3)
    ON CONFLICT (subject_type, subject_id, task_type) DO NOTHING;
  END IF;

  -- Stage: enhanced → clip task should be pending
  IF NEW.stage = 'enhanced' AND (OLD.stage IS NULL OR OLD.stage != 'enhanced') THEN
    INSERT INTO audio_tasks (subject_type, subject_id, spotify_track_id, task_type, status, max_attempts)
    VALUES ('track', NEW.spotify_track_id, NEW.spotify_track_id, 'clip', 'pending', 3)
    ON CONFLICT (subject_type, subject_id, task_type) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER populate_audio_tasks_trigger
  AFTER INSERT OR UPDATE OF stage ON tracks
  FOR EACH ROW
  EXECUTE FUNCTION populate_audio_tasks();

COMMENT ON COLUMN audio_tasks.subject_type IS 'Type of subject being processed: ''track'' (Spotify song) or ''tiktok_video'' (TikTok creator video)';
COMMENT ON COLUMN audio_tasks.subject_id IS 'Polymorphic ID: spotify_track_id for tracks, video_id for TikTok videos';
COMMENT ON CONSTRAINT audio_tasks_track_consistency_check ON audio_tasks IS 'Ensures spotify_track_id is set for track tasks and NULL for tiktok_video tasks';
