-- Fix wikidata_id extraction from raw_data
UPDATE musicbrainz_artists
SET wikidata_id = (
  SELECT REGEXP_REPLACE(
    jsonb_array_element->'url'->>'resource',
    '.*wikidata\.org/(?:entity|wiki)/(Q\d+).*',
    '\1'
  )
  FROM jsonb_array_elements(raw_data->'relations') AS jsonb_array_element
  WHERE 
    jsonb_array_element->'url'->>'resource' ~ 'wikidata\.org/(?:entity|wiki)/Q\d+'
  LIMIT 1
)
WHERE 
  raw_data IS NOT NULL
  AND (wikidata_id = 'wiki' OR wikidata_id IS NULL)
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(raw_data->'relations') AS rel
    WHERE rel->'url'->>'resource' LIKE '%wikidata.org%'
  );

-- Verify
SELECT 
  'Fixed wikidata_id' as status,
  COUNT(*) as total,
  COUNT(wikidata_id) as has_wikidata,
  COUNT(*) FILTER (WHERE wikidata_id = 'wiki') as still_broken
FROM musicbrainz_artists;
