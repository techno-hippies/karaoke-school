-- Migration 002: Add Lit Protocol Encryption Columns
-- Purpose: Enable encrypted full-length karaoke segments gated by Unlock Protocol NFT keys
-- Dependencies: 05-identity-grc20.sql (lens_accounts table)
--
-- Architecture:
-- - karaoke_segments stores encrypted full audio (vs. public preview chunks)
-- - FK to lens_accounts ties encryption to artist's Unlock lock
-- - JSONB stores complete Lit Protocol Access Control Conditions
-- - Users must own Unlock subscription key to decrypt

ALTER TABLE karaoke_segments
  ADD COLUMN encrypted_full_cid TEXT,
  ADD COLUMN encrypted_full_url TEXT,
  ADD COLUMN encryption_lens_account_id INTEGER REFERENCES lens_accounts(id) ON DELETE SET NULL,
  ADD COLUMN encryption_accs JSONB;

-- Index for querying encrypted segments by lens account (artist)
CREATE INDEX idx_karaoke_segments_encryption_lens_account
  ON karaoke_segments(encryption_lens_account_id)
  WHERE encryption_lens_account_id IS NOT NULL;

-- Index for finding segments that need encryption
CREATE INDEX idx_karaoke_segments_needs_encryption
  ON karaoke_segments(spotify_track_id, encryption_lens_account_id)
  WHERE fal_enhanced_grove_url IS NOT NULL
    AND encrypted_full_cid IS NULL;

COMMENT ON COLUMN karaoke_segments.encrypted_full_cid IS 'Grove CID for Lit Protocol encrypted full-length audio';
COMMENT ON COLUMN karaoke_segments.encrypted_full_url IS 'Grove URL for Lit Protocol encrypted full-length audio';
COMMENT ON COLUMN karaoke_segments.encryption_lens_account_id IS 'FK to lens_accounts - ties encrypted content to artist''s Unlock lock';
COMMENT ON COLUMN karaoke_segments.encryption_accs IS 'Lit Protocol Access Control Conditions (JSONB) - includes Unlock lock address, chain, and decryption rules';
