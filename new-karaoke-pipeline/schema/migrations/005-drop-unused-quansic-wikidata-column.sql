-- Drop unused wikidata_id column from quansic_artists
-- This data is already stored in the metadata JSONB column

ALTER TABLE quansic_artists
DROP COLUMN IF EXISTS wikidata_id;
