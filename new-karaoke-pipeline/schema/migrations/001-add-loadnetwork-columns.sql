-- Migration 001: Add load.network storage columns to karaoke_segments
-- Purpose: Support dual-format storage (encrypted full song + public clip) on load.network
-- Date: 2025-01-07
--
-- Background:
-- - Old: Single format, grove-only storage
-- - New: Dual-format with load.network (decentralized IPFS)
--   1. Full song (encrypted + unencrypted backup)
--   2. Short clip (40-60s public preview)
--
-- Naming Convention:
-- - Column names match what they store (not generic "storage_provider")
-- - Explicit separation: grove vs loadnetwork

-- Add load.network columns for full song (both encrypted and unencrypted)
ALTER TABLE karaoke_segments
  ADD COLUMN IF NOT EXISTS full_song_loadnetwork_cid TEXT,
  ADD COLUMN IF NOT EXISTS full_song_loadnetwork_url TEXT,
  ADD COLUMN IF NOT EXISTS full_song_encrypted_loadnetwork_cid TEXT,
  ADD COLUMN IF NOT EXISTS full_song_encrypted_loadnetwork_url TEXT,
  ADD COLUMN IF NOT EXISTS full_song_lit_access_conditions JSONB;

-- Add load.network column for public clip
ALTER TABLE karaoke_segments
  ADD COLUMN IF NOT EXISTS clip_loadnetwork_cid TEXT,
  ADD COLUMN IF NOT EXISTS clip_loadnetwork_url TEXT;

-- Add indexes for querying
CREATE INDEX IF NOT EXISTS idx_karaoke_segments_full_encrypted
  ON karaoke_segments(full_song_encrypted_loadnetwork_cid)
  WHERE full_song_encrypted_loadnetwork_cid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_karaoke_segments_clip_public
  ON karaoke_segments(clip_loadnetwork_cid)
  WHERE clip_loadnetwork_cid IS NOT NULL;

-- Comments
COMMENT ON COLUMN karaoke_segments.full_song_loadnetwork_cid IS 'IPFS CID for complete enhanced instrumental (unencrypted backup) on load.network';
COMMENT ON COLUMN karaoke_segments.full_song_loadnetwork_url IS 'load.network URL for full song (https://ipfs.load.network/ipfs/{cid})';
COMMENT ON COLUMN karaoke_segments.full_song_encrypted_loadnetwork_cid IS 'IPFS CID for Lit Protocol encrypted full song on load.network';
COMMENT ON COLUMN karaoke_segments.full_song_encrypted_loadnetwork_url IS 'load.network URL for encrypted full song';
COMMENT ON COLUMN karaoke_segments.full_song_lit_access_conditions IS 'Lit Protocol access control conditions (JSONB). Checks Unlock NFT ownership.';
COMMENT ON COLUMN karaoke_segments.clip_loadnetwork_cid IS 'IPFS CID for 40-60s public clip on load.network';
COMMENT ON COLUMN karaoke_segments.clip_loadnetwork_url IS 'load.network URL for public clip (https://ipfs.load.network/ipfs/{cid})';
