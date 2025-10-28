/**
 * Backfill Corroboration Log
 *
 * Retroactively populate grc20_corroboration_log with historical
 * field resolution decisions for artists and works.
 *
 * This provides an audit trail showing:
 * - Which sources contributed to each field
 * - What values were chosen and why
 * - Consensus counts and conflicts
 */

-- ============================================================================
-- ARTISTS: LOG ISNI RESOLUTIONS
-- ============================================================================

INSERT INTO grc20_corroboration_log (
    entity_type,
    entity_id,
    field_name,
    source,
    new_value,
    resolution_reason,
    consensus_count,
    conflict_detected
)
SELECT 
    'artist'::TEXT,
    ga.id,
    'isni'::TEXT,
    COALESCE(
        (ga.field_consensus->'isni'->'sources'->>0)::TEXT,
        'musicbrainz'
    ),
    ga.isni,
    CASE 
        WHEN ga.isni IS NOT NULL THEN 
            'ISNI from ' || COALESCE((ga.field_consensus->'isni'->'sources'->>0)::TEXT, 'musicbrainz') || 
            ' (consensus count: ' || COALESCE((ga.field_consensus->'isni'->>'consensus_count')::TEXT, '1') || ')'
        ELSE 'No ISNI available'
    END,
    COALESCE((ga.field_consensus->'isni'->>'consensus_count')::INTEGER, 0),
    FALSE -- No conflicts detected in initial load
FROM grc20_artists ga
WHERE ga.isni IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ARTISTS: LOG IPI RESOLUTIONS
-- ============================================================================

INSERT INTO grc20_corroboration_log (
    entity_type,
    entity_id,
    field_name,
    source,
    new_value,
    resolution_reason,
    consensus_count,
    conflict_detected
)
SELECT 
    'artist'::TEXT,
    ga.id,
    'ipi'::TEXT,
    'musicbrainz',
    ga.ipi,
    'IPI from MusicBrainz',
    1,
    FALSE
FROM grc20_artists ga
WHERE ga.ipi IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ARTISTS: LOG NAME RESOLUTIONS
-- ============================================================================

INSERT INTO grc20_corroboration_log (
    entity_type,
    entity_id,
    field_name,
    source,
    new_value,
    resolution_reason,
    consensus_count,
    conflict_detected
)
SELECT 
    'artist'::TEXT,
    ga.id,
    'name'::TEXT,
    COALESCE(
        (ga.field_consensus->'name'->'sources'->>0)::TEXT,
        'genius'
    ),
    ga.name,
    CASE 
        WHEN (ga.field_consensus->'name'->>'consensus_count')::INTEGER > 1 THEN
            'Name consensus from ' || (ga.field_consensus->'name'->>'consensus_count') || ' sources: ' ||
            (ga.field_consensus->'name'->'sources')::TEXT
        ELSE 
            'Name from primary source'
    END,
    COALESCE((ga.field_consensus->'name'->>'consensus_count')::INTEGER, 1),
    FALSE
FROM grc20_artists ga
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ARTISTS: LOG IMAGE RESOLUTIONS  
-- ============================================================================

INSERT INTO grc20_corroboration_log (
    entity_type,
    entity_id,
    field_name,
    source,
    new_value,
    resolution_reason,
    consensus_count,
    conflict_detected
)
SELECT 
    'artist'::TEXT,
    ga.id,
    'image_url'::TEXT,
    ga.image_source,
    ga.image_url,
    CASE ga.image_source
        WHEN 'fal' THEN 'Fal Grove generated image (highest priority)'
        WHEN 'spotify' THEN 'Spotify artist image (fallback from Fal)'
        WHEN 'genius' THEN 'Genius artist image (final fallback)'
        ELSE 'Unknown source'
    END,
    COALESCE((ga.field_consensus->'image_url'->>'consensus_count')::INTEGER, 1),
    FALSE
FROM grc20_artists ga
WHERE ga.image_url IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ARTISTS: LOG MBID (MUSICBRAINZ ID) RESOLUTIONS
-- ============================================================================

INSERT INTO grc20_corroboration_log (
    entity_type,
    entity_id,
    field_name,
    source,
    new_value,
    resolution_reason,
    consensus_count,
    conflict_detected
)
SELECT 
    'artist'::TEXT,
    ga.id,
    'mbid'::TEXT,
    'musicbrainz',
    ga.mbid,
    'MusicBrainz ID linked via genius_slug match',
    1,
    FALSE
FROM grc20_artists ga
WHERE ga.mbid IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ARTISTS: LOG WIKIDATA ID RESOLUTIONS
-- ============================================================================

INSERT INTO grc20_corroboration_log (
    entity_type,
    entity_id,
    field_name,
    source,
    new_value,
    resolution_reason,
    consensus_count,
    conflict_detected
)
SELECT 
    'artist'::TEXT,
    ga.id,
    'wikidata_id'::TEXT,
    'musicbrainz',
    ga.wikidata_id,
    'Wikidata ID from MusicBrainz relationships',
    1,
    FALSE
FROM grc20_artists ga
WHERE ga.wikidata_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- WORKS: LOG ISRC RESOLUTIONS
-- ============================================================================

INSERT INTO grc20_corroboration_log (
    entity_type,
    entity_id,
    field_name,
    source,
    new_value,
    resolution_reason,
    consensus_count,
    conflict_detected
)
SELECT 
    'work'::TEXT,
    w.id,
    'isrc'::TEXT,
    COALESCE(
        (w.field_consensus->'isrc'->'sources'->>0)::TEXT,
        'spotify'
    ),
    w.isrc,
    CASE 
        WHEN (w.field_consensus->'isrc'->>'consensus_count')::INTEGER > 1 THEN
            'ISRC consensus from ' || (w.field_consensus->'isrc'->>'consensus_count') || ' sources: ' ||
            (w.field_consensus->'isrc'->'sources')::TEXT
        ELSE 
            'ISRC from ' || COALESCE((w.field_consensus->'isrc'->'sources'->>0)::TEXT, 'spotify')
    END,
    COALESCE((w.field_consensus->'isrc'->>'consensus_count')::INTEGER, 1),
    FALSE
FROM grc20_works w
WHERE w.isrc IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- WORKS: LOG ISWC RESOLUTIONS
-- ============================================================================

INSERT INTO grc20_corroboration_log (
    entity_type,
    entity_id,
    field_name,
    source,
    new_value,
    resolution_reason,
    consensus_count,
    conflict_detected
)
SELECT 
    'work'::TEXT,
    w.id,
    'iswc'::TEXT,
    COALESCE(
        (w.field_consensus->'iswc'->'sources'->>0)::TEXT,
        'cisac'
    ),
    w.iswc,
    CASE 
        WHEN (w.field_consensus->'iswc'->>'consensus_count')::INTEGER > 1 THEN
            'ISWC consensus from ' || (w.field_consensus->'iswc'->>'consensus_count') || ' sources: ' ||
            (w.field_consensus->'iswc'->'sources')::TEXT
        ELSE 
            'ISWC from ' || COALESCE((w.field_consensus->'iswc'->'sources'->>0)::TEXT, 'cisac')
    END,
    COALESCE((w.field_consensus->'iswc'->>'consensus_count')::INTEGER, 1),
    FALSE
FROM grc20_works w
WHERE w.iswc IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- WORKS: LOG TITLE RESOLUTIONS
-- ============================================================================

INSERT INTO grc20_corroboration_log (
    entity_type,
    entity_id,
    field_name,
    source,
    new_value,
    resolution_reason,
    consensus_count,
    conflict_detected
)
SELECT 
    'work'::TEXT,
    w.id,
    'title'::TEXT,
    COALESCE(
        (w.field_consensus->'title'->'sources'->>0)::TEXT,
        'genius'
    ),
    w.title,
    CASE 
        WHEN (w.field_consensus->'title'->>'consensus_count')::INTEGER > 1 THEN
            'Title consensus from ' || (w.field_consensus->'title'->>'consensus_count') || ' sources'
        ELSE 
            'Title from Genius (primary source)'
    END,
    COALESCE((w.field_consensus->'title'->>'consensus_count')::INTEGER, 1),
    FALSE
FROM grc20_works w
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SUMMARY STATS
-- ============================================================================

SELECT
    'CORROBORATION LOG BACKFILL COMPLETE' as status,
    COUNT(*) as total_log_entries,
    COUNT(*) FILTER (WHERE entity_type = 'artist') as artist_entries,
    COUNT(*) FILTER (WHERE entity_type = 'work') as work_entries,
    COUNT(DISTINCT field_name) as unique_fields_tracked,
    COUNT(*) FILTER (WHERE consensus_count > 1) as multi_source_entries,
    COUNT(*) FILTER (WHERE conflict_detected) as conflicts_detected
FROM grc20_corroboration_log;

-- Show breakdown by field
SELECT
    entity_type,
    field_name,
    COUNT(*) as log_entries,
    ROUND(AVG(consensus_count), 2) as avg_consensus,
    COUNT(*) FILTER (WHERE conflict_detected) as conflicts
FROM grc20_corroboration_log
GROUP BY entity_type, field_name
ORDER BY entity_type, field_name;
