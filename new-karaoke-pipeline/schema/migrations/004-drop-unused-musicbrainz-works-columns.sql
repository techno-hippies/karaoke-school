-- Drop unused legacy columns from musicbrainz_works
-- These columns were replaced by:
--   - 'contributors' (jsonb) replaces 'composers' and 'writers'
--   - 'work_type' replaces 'type'

ALTER TABLE musicbrainz_works
DROP COLUMN IF EXISTS type,
DROP COLUMN IF EXISTS composers,
DROP COLUMN IF EXISTS writers;
