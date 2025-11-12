-- Migration 017: Manual Spotify Track Ingestion Support
-- Purpose: Enable direct Spotify track ingestion without TikTok discovery
-- Date: 2025-11-12
--
-- Changes:
-- 1. Make tiktok_video_id nullable (manual Spotify tracks have no TikTok video)
-- 2. Drop strict UNIQUE + FK constraints, add partial UNIQUE index
-- 3. Add source_type column ('tiktok' | 'manual_spotify') to track origin
-- 4. Add metadata JSONB column for audit trails (submission logs, etc.)
-- 5. Add indexes for efficient manual track queries
--
-- Risk: LOW (zero-downtime, existing rows unaffected)

-- Step 1: Create partial unique index for non-null tiktok_video_id values
-- This preserves uniqueness for TikTok rows while allowing multiple NULLs
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_tiktok_not_null
  ON tracks(tiktok_video_id)
  WHERE tiktok_video_id IS NOT NULL;

-- Step 2: Drop the old strict unique constraint (before making nullable)
ALTER TABLE tracks
  DROP CONSTRAINT IF EXISTS tracks_tiktok_video_id_key;

-- Step 3: Make tiktok_video_id nullable
-- After this, manual Spotify tracks can have tiktok_video_id = NULL
ALTER TABLE tracks
  ALTER COLUMN tiktok_video_id DROP NOT NULL;

-- Step 4: Drop the FOREIGN KEY constraint
-- Manual tracks will have tiktok_video_id = NULL, so FK is not applicable
ALTER TABLE tracks
  DROP CONSTRAINT IF EXISTS tracks_tiktok_video_id_fkey;

-- Step 5: Add source_type column to distinguish track origins
-- Defaults to 'tiktok' for backward compatibility during backfill
ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'tiktok'
  CHECK (source_type IN ('tiktok', 'manual_spotify'));

-- Step 6: Add metadata JSONB column for audit trails
-- Stores manual submission details (timestamp, notes, etc.)
ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Step 7: Backfill all existing tracks with source_type = 'tiktok'
-- (All current tracks have valid tiktok_video_id, so they are TikTok-sourced)
UPDATE tracks
  SET source_type = 'tiktok'
  WHERE source_type = 'tiktok' OR source_type IS NULL;

-- Step 8: Make source_type NOT NULL
-- Now all rows must explicitly declare their origin
ALTER TABLE tracks
  ALTER COLUMN source_type SET NOT NULL;

-- Step 9: Add index for source_type queries
-- Commonly filtered when processing manual Spotify tracks separately
CREATE INDEX IF NOT EXISTS idx_tracks_source_type
  ON tracks(source_type)
  WHERE source_type = 'manual_spotify';

-- Step 10: Add composite index for manual track stage queries
-- Optimizes: SELECT * FROM tracks WHERE source_type='manual_spotify' AND stage NOT IN (...)
CREATE INDEX IF NOT EXISTS idx_tracks_manual_stage
  ON tracks(stage)
  WHERE source_type = 'manual_spotify' AND stage NOT IN ('ready', 'failed');

-- Step 11: Add index on metadata for audit queries (optional)
-- Allows fast lookups by submission metadata (when needed)
CREATE INDEX IF NOT EXISTS idx_tracks_metadata_gin
  ON tracks USING GIN (metadata);

-- Verification queries (run after migration)
--
-- Check that tiktok_video_id is nullable:
-- SELECT data_type, is_nullable FROM information_schema.columns
--   WHERE table_name='tracks' AND column_name='tiktok_video_id';
--
-- Check that source_type exists and is NOT NULL:
-- SELECT data_type, is_nullable FROM information_schema.columns
--   WHERE table_name='tracks' AND column_name='source_type';
--
-- Check that metadata exists:
-- SELECT data_type FROM information_schema.columns
--   WHERE table_name='tracks' AND column_name='metadata';
--
-- Check track distribution:
-- SELECT source_type, COUNT(*) FROM tracks GROUP BY source_type;
--
-- Check TikTok uniqueness is protected:
-- SELECT COUNT(*) as duplicate_null_count FROM tracks
--   WHERE tiktok_video_id IS NULL AND source_type='tiktok';
-- (Should be 0 - no TikTok tracks should have NULL tiktok_video_id)
