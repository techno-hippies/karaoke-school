-- Migration 019: Remove sitelinks column from wikidata_artists
-- Sitelinks (Wikipedia article titles) provide no useful value

ALTER TABLE wikidata_artists DROP COLUMN IF EXISTS sitelinks;

-- Update comments to reflect cleaned-up data
COMMENT ON COLUMN wikidata_artists.labels IS 'Artist names in different languages - ONLY stores names that are significantly different from English name (e.g., 肯伊·威斯特 for Kanye West). Always includes English as reference.';
COMMENT ON COLUMN wikidata_artists.aliases IS 'Alternate names by language - ONLY stores names that are meaningfully different from the main label (e.g., "Ye", "Yeezy" for Kanye West). Filters out redundant copies of main name.';
