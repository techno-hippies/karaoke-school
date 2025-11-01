-- Migration 031: Create grc20_artist_mints table
-- Purpose: Track GRC-20 minting state separately from aggregation table
-- Rationale: grc20_artists is compiled from source tables, minting state is a separate concern
--
-- Created: 2025-11-01

-- Create grc20_artist_mints table (similar to pkp_accounts, lens_accounts)
CREATE TABLE IF NOT EXISTS grc20_artist_mints (
  id SERIAL PRIMARY KEY,

  -- Join key
  spotify_artist_id TEXT NOT NULL UNIQUE,

  -- GRC-20 minting result
  grc20_entity_id UUID NOT NULL,

  -- Minting metadata
  minted_at TIMESTAMPTZ DEFAULT NOW(),
  needs_update BOOLEAN DEFAULT FALSE,
  last_edit_cid TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_grc20_artist_mints_spotify ON grc20_artist_mints(spotify_artist_id);
CREATE INDEX idx_grc20_artist_mints_entity_id ON grc20_artist_mints(grc20_entity_id);
CREATE INDEX idx_grc20_artist_mints_needs_update ON grc20_artist_mints(needs_update) WHERE needs_update = TRUE;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_grc20_artist_mints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_grc20_artist_mints_updated_at
  BEFORE UPDATE ON grc20_artist_mints
  FOR EACH ROW
  EXECUTE FUNCTION update_grc20_artist_mints_updated_at();

-- Comments
COMMENT ON TABLE grc20_artist_mints IS 'GRC-20 minting state for artists. Source table - populated after minting to GRC-20.';
COMMENT ON COLUMN grc20_artist_mints.spotify_artist_id IS 'Join key to grc20_artists table';
COMMENT ON COLUMN grc20_artist_mints.grc20_entity_id IS 'UUID of the minted entity in GRC-20';
COMMENT ON COLUMN grc20_artist_mints.needs_update IS 'True if artist data changed and needs re-minting';
COMMENT ON COLUMN grc20_artist_mints.last_edit_cid IS 'CID of the last edit transaction on GRC-20';
