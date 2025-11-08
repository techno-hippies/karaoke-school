-- Migration 032: Drop GRC-20 minting columns from grc20_artists
-- Purpose: Remove minting state columns that violate source/aggregation separation
-- Rationale: grc20_artists should only be populated via populate-grc20-artists.ts
--            Minting state now lives in grc20_artist_mints table (source table)
--
-- Created: 2025-11-01

-- Drop minting state columns (now in grc20_artist_mints)
ALTER TABLE grc20_artists
  DROP COLUMN IF EXISTS grc20_entity_id,
  DROP COLUMN IF EXISTS minted_at,
  DROP COLUMN IF EXISTS needs_update,
  DROP COLUMN IF EXISTS last_edit_cid;

-- These columns are now sourced from grc20_artist_mints via LEFT JOIN
-- during grc20_artists population (populate-grc20-artists.ts)
