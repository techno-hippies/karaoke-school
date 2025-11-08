-- Migration 004: Drop Useless segment_start_ms and segment_end_ms Columns
--
-- These columns are misleading and serve no purpose:
-- - segment_start_ms: Always 0, never read
-- - segment_end_ms: Always min(190000, duration), never read
--
-- They don't represent what actually gets processed (full song is chunked,
-- enhanced, and merged regardless of length). The 190s is just an internal
-- fal.ai chunking detail, not a processing boundary.
--
-- What we actually use:
-- - fal_enhanced_grove_url: Full enhanced song (all chunks merged)
-- - clip_start_ms / clip_end_ms: Viral clip boundaries (40-100s, AI-selected)

ALTER TABLE karaoke_segments
  DROP COLUMN segment_start_ms,
  DROP COLUMN segment_end_ms;
