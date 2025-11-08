-- Migration: Update karaoke_segments storage references
-- Replace Grove references with fal.ai + load.network references

-- ============================================================================
-- Enhanced Audio: Add fal.ai reference + change to load.network
-- ============================================================================

-- Add fal.ai request ID column
ALTER TABLE karaoke_segments
  ADD COLUMN IF NOT EXISTS fal_request_id TEXT;

-- Rename enhanced audio columns to load.network
ALTER TABLE karaoke_segments
  RENAME COLUMN fal_enhanced_grove_cid TO fal_enhanced_load_cid;

ALTER TABLE karaoke_segments
  RENAME COLUMN fal_enhanced_grove_url TO fal_enhanced_load_url;

-- ============================================================================
-- Viral Clip: Change to load.network
-- ============================================================================

ALTER TABLE karaoke_segments
  RENAME COLUMN clip_cropped_grove_cid TO clip_load_cid;

ALTER TABLE karaoke_segments
  RENAME COLUMN clip_cropped_grove_url TO clip_load_url;

-- ============================================================================
-- Comments for clarity
-- ============================================================================

COMMENT ON COLUMN karaoke_segments.fal_request_id IS 'fal.ai Stable Audio 2.5 request ID for reference';
COMMENT ON COLUMN karaoke_segments.fal_enhanced_load_cid IS 'IPFS CID of enhanced instrumental on load.network';
COMMENT ON COLUMN karaoke_segments.fal_enhanced_load_url IS 'load.network IPFS gateway URL for enhanced audio';
COMMENT ON COLUMN karaoke_segments.clip_load_cid IS 'IPFS CID of viral clip on load.network';
COMMENT ON COLUMN karaoke_segments.clip_load_url IS 'load.network IPFS gateway URL for clip';
