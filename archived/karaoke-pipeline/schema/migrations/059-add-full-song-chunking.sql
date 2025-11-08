-- Migration 059: Add Full-Song Chunking Support
-- Purpose: Enable processing entire songs in 190s chunks
-- Date: 2025-11-06

-- ============================================================
-- STEP 1: Add chunking columns to karaoke_segments
-- ============================================================

ALTER TABLE karaoke_segments
  ADD COLUMN IF NOT EXISTS fal_chunks JSONB,
  ADD COLUMN IF NOT EXISTS merged_instrumental_cid TEXT;

-- ============================================================
-- COLUMN DESCRIPTIONS
-- ============================================================

COMMENT ON COLUMN karaoke_segments.fal_chunks IS
  'Array of fal.ai chunk metadata: [{index, start_ms, end_ms, fal_url, fal_request_id, grove_cid}]';

COMMENT ON COLUMN karaoke_segments.merged_instrumental_cid IS
  'Grove CID of final merged instrumental (all chunks concatenated)';

-- ============================================================
-- EXAMPLE DATA STRUCTURE
-- ============================================================

/*
For a 200s song split into 2 chunks:

{
  "optimal_segment_start_ms": 0,
  "optimal_segment_end_ms": 200000,
  "clip_start_ms": 60000,
  "clip_end_ms": 105000,
  "fal_chunks": [
    {
      "index": 0,
      "start_ms": 0,
      "end_ms": 190000,
      "duration_ms": 190000,
      "fal_url": "https://fal.ai/files/...",
      "fal_request_id": "abc123",
      "grove_cid": "bafybeiabc..."
    },
    {
      "index": 1,
      "start_ms": 190000,
      "end_ms": 200000,
      "duration_ms": 10000,
      "fal_url": "https://fal.ai/files/...",
      "fal_request_id": "def456",
      "grove_cid": "bafybeidef..."
    }
  ],
  "merged_instrumental_cid": "bafybeifinal..."
}
*/

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check that columns were added
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'karaoke_segments'
  AND column_name IN ('fal_chunks', 'merged_instrumental_cid')
ORDER BY ordinal_position;
