-- ============================================================================
-- ADD CORROBORATION LOGGING TO ETL
-- ============================================================================
-- 
-- This script adds comprehensive logging to the corroboration process
-- Run this after the main ETL to populate grc20_corroboration_log

-- ============================================================================
-- LOG NAME RESOLUTION DECISIONS
-- ============================================================================

INSERT INTO grc20_corroboration_log (
  entity_type, entity_id, field_name, source, 
  old_value, new_value, resolution_reason, consensus_count, conflict_detected
)
SELECT 
  'artist'::TEXT,
  ga.id,
  'name'::TEXT,
  CASE WHEN ma.name IS NOT NULL THEN 'musicbrainz' ELSE 'genius' END,
  NULL, -- old value would be from previous run
  COALESCE(ma.name, ga.name), -- new resolved value
  CASE 
    WHEN ma.name IS NOT NULL THEN 'MusicBrainz canonical name preferred over Genius'
    ELSE 'Genius name used (no MusicBrainz match)'
  END,
  CASE WHEN ma.name IS NOT NULL AND ga.name IS NOT NULL THEN 2 ELSE 1 END,
  CASE WHEN ma.name IS NOT NULL AND ga.name IS NOT NULL AND ma.name != ga.name THEN TRUE ELSE FALSE END
FROM grc20_artists ga
LEFT JOIN musicbrainz_artists ma ON ma.mbid = ga.mbid
WHERE ga.id IS NOT NULL;

-- ============================================================================
-- LOG ISNI RESOLUTION DECISIONS
-- ============================================================================

INSERT INTO grc20_corroboration_log (
  entity_type, entity_id, field_name, source, 
  old_value, new_value, resolution_reason, consensus_count, conflict_detected
)
SELECT 
  'artist'::TEXT,
  ga.id,
  'isni'::TEXT,
  'musicbrainz'::TEXT,
  NULL,
  ma.isnis[1],
  CASE 
    WHEN ma.isnis[1] IS NOT NULL THEN 'MusicBrainz ISNI accepted (single source)'
    ELSE 'No ISNI available from MusicBrainz'
  END,
  CASE WHEN ma.isnis[1] IS NOT NULL THEN 1 ELSE 0 END,
  FALSE
FROM grc20_artists ga
LEFT JOIN musicbrainz_artists ma ON ma.mbid = ga.mbid
WHERE ga.id IS NOT NULL;

-- ============================================================================
-- LOG IMAGE RESOLUTION DECISIONS
-- ============================================================================

INSERT INTO grc20_corroboration_log (
  entity_type, entity_id, field_name, source, 
  old_value, new_value, resolution_reason, consensus_count, conflict_detected
)
SELECT 
  'artist'::TEXT,
  ga.id,
  'image_url'::TEXT,
  CASE 
    WHEN ai.generated_image_url IS NOT NULL THEN 'fal'
    WHEN sa.images->0->>'url' IS NOT NULL THEN 'spotify'
    WHEN ga.image_url IS NOT NULL THEN 'genius'
    ELSE 'none'
  END,
  NULL,
  COALESCE(ai.generated_image_url, sa.images->0->>'url', ga.image_url),
  CASE 
    WHEN ai.generated_image_url IS NOT NULL THEN 'Fal AI-generated image (highest priority)'
    WHEN sa.images->0->>'url' IS NOT NULL THEN 'Spotify image (second priority)'
    WHEN ga.image_url IS NOT NULL THEN 'Genius image (fallback)'
    ELSE 'No image available'
  END,
  CASE 
    WHEN ai.generated_image_url IS NOT NULL THEN 1
    WHEN sa.images->0->>'url' IS NOT NULL THEN 1
    WHEN ga.image_url IS NOT NULL THEN 1
    ELSE 0
  END,
  FALSE
FROM grc20_artists ga
LEFT JOIN musicbrainz_artists ma ON ma.mbid = ga.mbid
LEFT JOIN spotify_artists sa ON sa.spotify_artist_id = COALESCE(ma.spotify_artist_id, ga.spotify_artist_id)
LEFT JOIN artist_images ai ON ai.spotify_artist_id = sa.spotify_artist_id AND ai.status = 'completed'
WHERE ga.id IS NOT NULL;

-- ============================================================================
-- LOG SOCIAL MEDIA RESOLUTION DECISIONS
-- ============================================================================

INSERT INTO grc20_corroboration_log (
  entity_type, entity_id, field_name, source, 
  old_value, new_value, resolution_reason, consensus_count, conflict_detected
)
SELECT 
  'artist'::TEXT,
  ga.id,
  'instagram_handle'::TEXT,
  CASE 
    WHEN ma.instagram_handle IS NOT NULL THEN 'musicbrainz'
    WHEN ga.instagram_name IS NOT NULL THEN 'genius'
    ELSE 'none'
  END,
  NULL,
  NULLIF(COALESCE(ma.instagram_handle, ga.instagram_name), ''),
  CASE 
    WHEN ma.instagram_handle IS NOT NULL THEN 'MusicBrainz Instagram handle preferred over Genius'
    WHEN ga.instagram_name IS NOT NULL THEN 'Genius Instagram handle used (no MusicBrainz)'
    ELSE 'No Instagram handle available'
  END,
  CASE 
    WHEN ma.instagram_handle IS NOT NULL THEN 1
    WHEN ga.instagram_name IS NOT NULL THEN 1
    ELSE 0
  END,
  CASE 
    WHEN ma.instagram_handle IS NOT NULL AND ga.instagram_name IS NOT NULL 
     AND ma.instagram_handle != ga.instagram_name THEN TRUE
    ELSE FALSE
  END
FROM grc20_artists ga
LEFT JOIN musicbrainz_artists ma ON ma.mbid = ga.mbid
WHERE ga.id IS NOT NULL;

-- ============================================================================
-- LOG SPOTIFY LINK RESOLUTION DECISIONS
-- ============================================================================

INSERT INTO grc20_corroboration_log (
  entity_type, entity_id, field_name, source, 
  old_value, new_value, resolution_reason, consensus_count, conflict_detected
)
SELECT 
  'artist'::TEXT,
  ga.id,
  'spotify_url'::TEXT,
  'constructed'::TEXT,
  NULL,
  CASE 
    WHEN sa.spotify_artist_id IS NOT NULL OR ma.spotify_artist_id IS NOT NULL 
    THEN 'https://open.spotify.com/artist/' || COALESCE(sa.spotify_artist_id, ma.spotify_artist_id)
    ELSE NULL
  END,
  CASE 
    WHEN COALESCE(sa.spotify_artist_id, ma.spotify_artist_id) IS NOT NULL 
    THEN 'Spotify URL constructed from artist ID'
    ELSE 'No Spotify artist ID available'
  END,
  CASE WHEN COALESCE(sa.spotify_artist_id, ma.spotify_artist_id) IS NOT NULL THEN 1 ELSE 0 END,
  FALSE
FROM grc20_artists ga
LEFT JOIN musicbrainz_artists ma ON ma.mbid = ga.mbid
LEFT JOIN spotify_artists sa ON sa.spotify_artist_id = COALESCE(ma.spotify_artist_id, ga.spotify_artist_id)
WHERE ga.id IS NOT NULL;

-- ============================================================================
-- SUMMARY STATISTICS
-- ============================================================================

SELECT 
  'CORROBORATION LOGGING COMPLETE' as status,
  COUNT(*) as total_log_entries,
  COUNT(DISTINCT entity_id) as entities_logged,
  COUNT(DISTINCT field_name) as fields_tracked,
  COUNT(*) FILTER (WHERE conflict_detected = TRUE) as conflicts_detected,
  COUNT(*) FILTER (WHERE consensus_count > 1) as multi_source_consensus
FROM grc20_corroboration_log;

-- ============================================================================
-- SAMPLE LOG ENTRIES FOR REVIEW
-- ============================================================================

SELECT 
  entity_type,
  entity_id,
  field_name,
  source,
  new_value,
  resolution_reason,
  consensus_count,
  conflict_detected,
  created_at
FROM grc20_corroboration_log 
ORDER BY created_at DESC, entity_id, field_name 
LIMIT 20;
