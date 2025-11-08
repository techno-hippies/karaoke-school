-- Migration 038: Add UNIQUE constraint on spotify_track_id
-- Date: 2025-11-02
-- Purpose: Prevent duplicate pipeline entries for the same song
--
-- Context:
--   Multiple TikTok videos can reference the same Spotify track.
--   The pipeline processes songs, not videos - each song should only be processed once.
--   Before this migration, the same song could be inserted multiple times,
--   causing wasted processing and data integrity issues.
--
-- Changes:
--   1. Remove duplicate entries (keep earliest entry per spotify_track_id)
--   2. Add UNIQUE constraint on spotify_track_id
--   3. Update createPipelineEntrySQL() to UPSERT on spotify_track_id
--
-- Impact:
--   - Future insertions will either create new entry or update tiktok_video_id reference
--   - Pipeline progress preserved on conflict (status, metadata, etc.)
--   - Prevents UNIQUE constraint violations at application level

-- Step 1: Identify and log duplicates before cleanup
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT spotify_track_id
    FROM song_pipeline
    GROUP BY spotify_track_id
    HAVING COUNT(*) > 1
  ) duplicates;

  RAISE NOTICE 'Found % spotify_track_ids with duplicates', duplicate_count;
END $$;

-- Step 2: Remove duplicates (keep earliest entry)
-- This was executed manually via MCP on 2025-11-02
-- Deleted 20 duplicate entries
-- Result: 85 total tracks = 85 unique tracks

WITH duplicates AS (
  SELECT spotify_track_id, MIN(id) as keep_id
  FROM song_pipeline
  GROUP BY spotify_track_id
  HAVING COUNT(*) > 1
)
DELETE FROM song_pipeline
WHERE id IN (
  SELECT sp.id
  FROM song_pipeline sp
  JOIN duplicates d ON sp.spotify_track_id = d.spotify_track_id
  WHERE sp.id != d.keep_id
);

-- Step 3: Add UNIQUE constraint
ALTER TABLE song_pipeline
  ADD CONSTRAINT song_pipeline_spotify_track_id_unique
  UNIQUE (spotify_track_id);

-- Verify constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'song_pipeline_spotify_track_id_unique'
  ) THEN
    RAISE NOTICE 'UNIQUE constraint on spotify_track_id successfully added';
  ELSE
    RAISE EXCEPTION 'Failed to add UNIQUE constraint';
  END IF;
END $$;

-- Final verification: Confirm no duplicates remain
DO $$
DECLARE
  duplicate_count INTEGER;
  total_tracks INTEGER;
  unique_tracks INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_tracks FROM song_pipeline;
  SELECT COUNT(DISTINCT spotify_track_id) INTO unique_tracks FROM song_pipeline;

  duplicate_count := total_tracks - unique_tracks;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Still have % duplicates after cleanup!', duplicate_count;
  END IF;

  RAISE NOTICE 'Verification passed: % total tracks = % unique tracks', total_tracks, unique_tracks;
END $$;
