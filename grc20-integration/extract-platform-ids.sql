-- Extract platform IDs from existing raw_data in musicbrainz_artists

-- Apple Music ID
UPDATE musicbrainz_artists
SET apple_music_id = (
  SELECT REGEXP_REPLACE(
    jsonb_array_element->'url'->>'resource',
    '.*(?:music\.apple\.com|itunes\.apple\.com)/[a-z]{2}/artist/(?:id)?(\d+).*',
    '\1'
  )
  FROM jsonb_array_elements(raw_data->'relations') AS jsonb_array_element
  WHERE 
    jsonb_array_element->'url'->>'resource' ~ '(music\.apple\.com|itunes\.apple\.com)/[a-z]{2}/artist/(?:id)?\d+'
  LIMIT 1
)
WHERE raw_data IS NOT NULL
  AND apple_music_id IS NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(raw_data->'relations') AS rel
    WHERE rel->'url'->>'resource' LIKE '%apple.com%artist%'
  );

-- Deezer ID
UPDATE musicbrainz_artists
SET deezer_id = (
  SELECT REGEXP_REPLACE(
    jsonb_array_element->'url'->>'resource',
    '.*deezer\.com/artist/(\d+).*',
    '\1'
  )
  FROM jsonb_array_elements(raw_data->'relations') AS jsonb_array_element
  WHERE 
    jsonb_array_element->'url'->>'resource' ~ 'deezer\.com/artist/\d+'
  LIMIT 1
)
WHERE raw_data IS NOT NULL
  AND deezer_id IS NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(raw_data->'relations') AS rel
    WHERE rel->'url'->>'resource' LIKE '%deezer.com/artist%'
  );

-- Tidal ID
UPDATE musicbrainz_artists
SET tidal_id = (
  SELECT REGEXP_REPLACE(
    jsonb_array_element->'url'->>'resource',
    '.*tidal\.com/(?:browse/)?artist/(\d+).*',
    '\1'
  )
  FROM jsonb_array_elements(raw_data->'relations') AS jsonb_array_element
  WHERE 
    jsonb_array_element->'url'->>'resource' ~ 'tidal\.com/(?:browse/)?artist/\d+'
  LIMIT 1
)
WHERE raw_data IS NOT NULL
  AND tidal_id IS NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(raw_data->'relations') AS rel
    WHERE rel->'url'->>'resource' LIKE '%tidal.com%artist%'
  );

-- Verify
SELECT 
  'Platform IDs extracted' as status,
  COUNT(*) as total,
  COUNT(apple_music_id) as has_apple,
  COUNT(deezer_id) as has_deezer,
  COUNT(tidal_id) as has_tidal
FROM musicbrainz_artists;
