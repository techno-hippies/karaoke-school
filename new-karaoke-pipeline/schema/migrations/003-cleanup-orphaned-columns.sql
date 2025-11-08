-- Migration 003: Cleanup orphaned load.network columns and clip_reason
-- Purpose: Remove unused columns from failed load.network experiment
-- Date: 2025-01-08
--
-- Background:
-- - Migration 001 added load.network columns for dual-format storage
-- - Migration 002 renamed SOME columns back to Grove (enhanced + clip)
-- - But left orphaned: full_song_*, clip_loadnetwork_*, clip_reason
-- - Decision: Use Grove-only storage (simpler, free CDN, no ANS-104 complexity)
--
-- This migration:
-- 1. Drops all orphaned load.network columns (never used)
-- 2. Drops clip_reason (waste of AI tokens, unused in app)
-- 3. Drops indexes created by migration 001

-- Drop indexes from migration 001
DROP INDEX IF EXISTS idx_karaoke_segments_full_encrypted;
DROP INDEX IF EXISTS idx_karaoke_segments_clip_public;

-- Drop orphaned load.network columns (from migration 001, never renamed)
ALTER TABLE karaoke_segments
  DROP COLUMN IF EXISTS full_song_loadnetwork_cid,
  DROP COLUMN IF EXISTS full_song_loadnetwork_url,
  DROP COLUMN IF EXISTS full_song_encrypted_loadnetwork_cid,
  DROP COLUMN IF EXISTS full_song_encrypted_loadnetwork_url,
  DROP COLUMN IF EXISTS full_song_lit_access_conditions,
  DROP COLUMN IF EXISTS clip_loadnetwork_cid,
  DROP COLUMN IF EXISTS clip_loadnetwork_url;

-- Drop wasteful clip_reason column (AI explanation never used)
ALTER TABLE karaoke_segments
  DROP COLUMN IF EXISTS clip_reason;

-- Final state: Clean Grove-only storage
-- - fal_enhanced_grove_cid / fal_enhanced_grove_url (enhanced full song)
-- - clip_grove_cid / clip_grove_url (viral clip)
-- - clip_start_ms / clip_end_ms (viral clip boundaries)
