-- Migration 019: Fix audio_tasks trigger for polymorphic schema
-- Date: 2025-01-12
--
-- Fixes the populate_audio_tasks trigger to work with the modern polymorphic
-- audio_tasks schema (subject_type, subject_id) instead of the old spotify_track_id-only schema.

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS tracks_stage_populate_tasks ON tracks;

-- Recreate function with polymorphic schema support
CREATE OR REPLACE FUNCTION populate_audio_tasks()
RETURNS TRIGGER AS $$
BEGIN
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

-- Create trigger on tracks stage updates
CREATE TRIGGER tracks_stage_populate_tasks
AFTER UPDATE OF stage ON tracks
FOR EACH ROW
EXECUTE FUNCTION populate_audio_tasks();

-- Backfill pending rows for existing tracks at audio_ready stage
INSERT INTO audio_tasks (subject_type, subject_id, spotify_track_id, task_type, status, max_attempts)
SELECT 'track', spotify_track_id, spotify_track_id, 'align', 'pending', 3
FROM tracks
WHERE stage = 'audio_ready'
ON CONFLICT (subject_type, subject_id, task_type) DO NOTHING;

-- Backfill for other stages (if any tracks are already further along)
INSERT INTO audio_tasks (subject_type, subject_id, spotify_track_id, task_type, status, max_attempts)
SELECT 'track', spotify_track_id, spotify_track_id, 'translate', 'pending', 3
FROM tracks
WHERE stage = 'aligned'
ON CONFLICT (subject_type, subject_id, task_type) DO NOTHING;

INSERT INTO audio_tasks (subject_type, subject_id, spotify_track_id, task_type, status, max_attempts)
SELECT 'track', spotify_track_id, spotify_track_id, 'separate', 'pending', 3
FROM tracks
WHERE stage = 'translated'
ON CONFLICT (subject_type, subject_id, task_type) DO NOTHING;

INSERT INTO audio_tasks (subject_type, subject_id, spotify_track_id, task_type, status, max_attempts)
SELECT 'track', spotify_track_id, spotify_track_id, 'segment', 'pending', 3
FROM tracks
WHERE stage = 'separated'
ON CONFLICT (subject_type, subject_id, task_type) DO NOTHING;

INSERT INTO audio_tasks (subject_type, subject_id, spotify_track_id, task_type, status, max_attempts)
SELECT 'track', spotify_track_id, spotify_track_id, 'enhance', 'pending', 3
FROM tracks
WHERE stage = 'segmented'
ON CONFLICT (subject_type, subject_id, task_type) DO NOTHING;

INSERT INTO audio_tasks (subject_type, subject_id, spotify_track_id, task_type, status, max_attempts)
SELECT 'track', spotify_track_id, spotify_track_id, 'clip', 'pending', 3
FROM tracks
WHERE stage = 'enhanced'
ON CONFLICT (subject_type, subject_id, task_type) DO NOTHING;
