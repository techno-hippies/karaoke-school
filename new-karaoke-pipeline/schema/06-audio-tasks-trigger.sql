-- Migration 009: Pre-populate audio_tasks for queue visibility
-- Resolves: ISSUE-BACKLOG-VISIBILITY.md
--
-- Creates database trigger to insert pending audio_tasks rows when tracks
-- reach prerequisite stages, enabling proper queue monitoring and ops management.

-- Function to populate audio_tasks based on stage transitions
CREATE OR REPLACE FUNCTION populate_audio_tasks()
RETURNS TRIGGER AS $$
BEGIN
  -- Stage: audio_ready → align task should be pending
  IF NEW.stage = 'audio_ready' AND (OLD.stage IS NULL OR OLD.stage != 'audio_ready') THEN
    INSERT INTO audio_tasks (spotify_track_id, task_type, status, max_attempts)
    VALUES (NEW.spotify_track_id, 'align', 'pending', 3)
    ON CONFLICT (spotify_track_id, task_type) DO NOTHING;
  END IF;

  -- Stage: aligned → translate task should be pending
  IF NEW.stage = 'aligned' AND (OLD.stage IS NULL OR OLD.stage != 'aligned') THEN
    INSERT INTO audio_tasks (spotify_track_id, task_type, status, max_attempts)
    VALUES (NEW.spotify_track_id, 'translate', 'pending', 3)
    ON CONFLICT (spotify_track_id, task_type) DO NOTHING;
  END IF;

  -- Stage: translated → separate task should be pending
  IF NEW.stage = 'translated' AND (OLD.stage IS NULL OR OLD.stage != 'translated') THEN
    INSERT INTO audio_tasks (spotify_track_id, task_type, status, max_attempts)
    VALUES (NEW.spotify_track_id, 'separate', 'pending', 3)
    ON CONFLICT (spotify_track_id, task_type) DO NOTHING;
  END IF;

  -- Stage: separated → segment task should be pending
  IF NEW.stage = 'separated' AND (OLD.stage IS NULL OR OLD.stage != 'separated') THEN
    INSERT INTO audio_tasks (spotify_track_id, task_type, status, max_attempts)
    VALUES (NEW.spotify_track_id, 'segment', 'pending', 3)
    ON CONFLICT (spotify_track_id, task_type) DO NOTHING;
  END IF;

  -- Stage: segmented → enhance task should be pending
  IF NEW.stage = 'segmented' AND (OLD.stage IS NULL OR OLD.stage != 'segmented') THEN
    INSERT INTO audio_tasks (spotify_track_id, task_type, status, max_attempts)
    VALUES (NEW.spotify_track_id, 'enhance', 'pending', 3)
    ON CONFLICT (spotify_track_id, task_type) DO NOTHING;
  END IF;

  -- Stage: enhanced → clip task should be pending
  IF NEW.stage = 'enhanced' AND (OLD.stage IS NULL OR OLD.stage != 'enhanced') THEN
    INSERT INTO audio_tasks (spotify_track_id, task_type, status, max_attempts)
    VALUES (NEW.spotify_track_id, 'clip', 'pending', 3)
    ON CONFLICT (spotify_track_id, task_type) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on tracks stage updates
DROP TRIGGER IF EXISTS tracks_stage_populate_tasks ON tracks;
CREATE TRIGGER tracks_stage_populate_tasks
AFTER UPDATE OF stage ON tracks
FOR EACH ROW
EXECUTE FUNCTION populate_audio_tasks();

-- Backfill pending rows for existing tracks
-- This ensures tracks already at a stage get their pending audio_tasks rows
DO $$
BEGIN
  -- Tracks at audio_ready without align task
  INSERT INTO audio_tasks (spotify_track_id, task_type, status, max_attempts)
  SELECT spotify_track_id, 'align', 'pending', 3
  FROM tracks
  WHERE stage = 'audio_ready'
  ON CONFLICT (spotify_track_id, task_type) DO NOTHING;

  -- Tracks at aligned without translate task
  INSERT INTO audio_tasks (spotify_track_id, task_type, status, max_attempts)
  SELECT spotify_track_id, 'translate', 'pending', 3
  FROM tracks
  WHERE stage = 'aligned'
  ON CONFLICT (spotify_track_id, task_type) DO NOTHING;

  -- Tracks at translated without separate task
  INSERT INTO audio_tasks (spotify_track_id, task_type, status, max_attempts)
  SELECT spotify_track_id, 'separate', 'pending', 3
  FROM tracks
  WHERE stage = 'translated'
  ON CONFLICT (spotify_track_id, task_type) DO NOTHING;

  -- Tracks at separated without segment task
  INSERT INTO audio_tasks (spotify_track_id, task_type, status, max_attempts)
  SELECT spotify_track_id, 'segment', 'pending', 3
  FROM tracks
  WHERE stage = 'separated'
  ON CONFLICT (spotify_track_id, task_type) DO NOTHING;

  -- Tracks at segmented without enhance task
  INSERT INTO audio_tasks (spotify_track_id, task_type, status, max_attempts)
  SELECT spotify_track_id, 'enhance', 'pending', 3
  FROM tracks
  WHERE stage = 'segmented'
  ON CONFLICT (spotify_track_id, task_type) DO NOTHING;

  -- Tracks at enhanced without clip task
  INSERT INTO audio_tasks (spotify_track_id, task_type, status, max_attempts)
  SELECT spotify_track_id, 'clip', 'pending', 3
  FROM tracks
  WHERE stage = 'enhanced'
  ON CONFLICT (spotify_track_id, task_type) DO NOTHING;
END $$;

-- Verification queries (run after migration)
--
-- Check pending tasks per type:
-- SELECT task_type, COUNT(*) FROM audio_tasks WHERE status = 'pending' GROUP BY task_type;
--
-- Check tracks without expected audio_tasks:
-- SELECT t.spotify_track_id, t.stage FROM tracks t LEFT JOIN audio_tasks at ON t.spotify_track_id = at.spotify_track_id WHERE t.stage = 'audio_ready' AND at.task_type IS NULL;
