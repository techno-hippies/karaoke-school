-- Migration: Revert to Grove storage naming
-- Renames fal_enhanced_load_* columns back to fal_enhanced_grove_*
-- Renames clip_load_* columns back to clip_grove_*

ALTER TABLE karaoke_segments
  RENAME COLUMN fal_enhanced_load_cid TO fal_enhanced_grove_cid;

ALTER TABLE karaoke_segments
  RENAME COLUMN fal_enhanced_load_url TO fal_enhanced_grove_url;

ALTER TABLE karaoke_segments
  RENAME COLUMN clip_load_cid TO clip_grove_cid;

ALTER TABLE karaoke_segments
  RENAME COLUMN clip_load_url TO clip_grove_url;

-- Update comments
COMMENT ON COLUMN karaoke_segments.fal_enhanced_grove_cid IS 'Grove/IPFS CID for enhanced audio';
COMMENT ON COLUMN karaoke_segments.fal_enhanced_grove_url IS 'Full Grove URL for enhanced audio';
COMMENT ON COLUMN karaoke_segments.clip_grove_cid IS 'Grove/IPFS CID for viral clip';
COMMENT ON COLUMN karaoke_segments.clip_grove_url IS 'Full Grove URL for viral clip';
