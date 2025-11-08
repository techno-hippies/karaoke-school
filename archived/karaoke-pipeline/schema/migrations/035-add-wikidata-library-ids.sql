-- Migration 035: Add Wikidata and Library IDs to GRC-20 Tables
-- Purpose: Add Wikidata QIDs and clean library IDs (VIAF, GND, BNF, LOC) for canonical reference
-- Why: Wikidata provides universal entity IDs and fills gaps in library identifiers

-- Add Wikidata and library IDs to grc20_artists
ALTER TABLE grc20_artists
ADD COLUMN IF NOT EXISTS wikidata_id TEXT,
ADD COLUMN IF NOT EXISTS viaf_id TEXT,
ADD COLUMN IF NOT EXISTS gnd_id TEXT,
ADD COLUMN IF NOT EXISTS bnf_id TEXT,
ADD COLUMN IF NOT EXISTS loc_id TEXT;

-- Add Wikidata ID to grc20_works
ALTER TABLE grc20_works
ADD COLUMN IF NOT EXISTS wikidata_id TEXT;

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_grc20_artists_wikidata_id ON grc20_artists(wikidata_id);
CREATE INDEX IF NOT EXISTS idx_grc20_artists_viaf_id ON grc20_artists(viaf_id);
CREATE INDEX IF NOT EXISTS idx_grc20_works_wikidata_id ON grc20_works(wikidata_id);

-- Add comments
COMMENT ON COLUMN grc20_artists.wikidata_id IS 'Wikidata QID (universal entity identifier)';
COMMENT ON COLUMN grc20_artists.viaf_id IS 'Virtual International Authority File ID (clean ID, not URL)';
COMMENT ON COLUMN grc20_artists.gnd_id IS 'Gemeinsame Normdatei ID (German National Library)';
COMMENT ON COLUMN grc20_artists.bnf_id IS 'Bibliothèque nationale de France ID';
COMMENT ON COLUMN grc20_artists.loc_id IS 'Library of Congress ID';
COMMENT ON COLUMN grc20_works.wikidata_id IS 'Wikidata QID for musical work';
