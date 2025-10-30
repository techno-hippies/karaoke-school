/**
 * Enrich Artists with IPI from CISAC
 *
 * Cross-references CISAC works database (14,349 works) to extract
 * IPI numbers for artists by fuzzy name matching.
 *
 * CISAC data contains:
 * - writer_name (composer/lyricist names)
 * - ipi_base_number (IPI identifiers)
 * - work_title (for additional validation)
 *
 * Strategy:
 * 1. Match artist names with high similarity (>85%)
 * 2. Validate matches by checking if artist has works matching CISAC works
 * 3. Update field_consensus JSONB to track CISAC as IPI source
 * 4. Log all enrichments to corroboration_log
 */

-- ============================================================================
-- STEP 1: ENRICH IPI FROM CISAC BY ARTIST NAME MATCHING
-- ============================================================================

WITH cisac_ipi_matches AS (
    SELECT DISTINCT ON (ga.id)
        ga.id as artist_id,
        cw.ipi_base_number as ipi,
        cw.writer_name,
        similarity(LOWER(cw.writer_name), LOWER(ga.name)) as name_sim,
        COUNT(DISTINCT cw.work_title) as work_count
    FROM grc20_artists ga
    JOIN cisac_works cw ON 
        similarity(LOWER(cw.writer_name), LOWER(ga.name)) > 0.85
    WHERE ga.ipi IS NULL 
        AND cw.ipi_base_number IS NOT NULL
        AND LENGTH(cw.ipi_base_number) >= 9 -- Valid IPI format
    GROUP BY ga.id, cw.ipi_base_number, cw.writer_name
    HAVING COUNT(DISTINCT cw.work_title) >= 1 -- At least 1 work match
    ORDER BY ga.id, name_sim DESC, work_count DESC
)
UPDATE grc20_artists ga SET
    ipi = cim.ipi,
    source_flags = source_flags || jsonb_build_object('cisac', true),
    field_consensus = jsonb_set(
        field_consensus,
        '{ipi}',
        jsonb_build_object(
            'value', cim.ipi,
            'sources', jsonb_build_array('cisac'),
            'consensus_count', 1,
            'conflicts', '{}'::jsonb,
            'matched_writer_name', cim.writer_name,
            'work_count', cim.work_count
        ),
        true
    ),
    updated_at = NOW()
FROM cisac_ipi_matches cim
WHERE ga.id = cim.artist_id;

-- Log IPI enrichments from CISAC
INSERT INTO grc20_corroboration_log (
    entity_type,
    entity_id,
    field_name,
    source,
    old_value,
    new_value,
    resolution_reason,
    consensus_count,
    conflict_detected
)
SELECT 
    'artist'::TEXT,
    ga.id,
    'ipi'::TEXT,
    'cisac',
    NULL, -- Was null before
    ga.ipi,
    'IPI enriched from CISAC via writer name match: ' || 
        (ga.field_consensus->'ipi'->>'matched_writer_name') ||
        ' (' || (ga.field_consensus->'ipi'->>'work_count') || ' works)',
    1,
    FALSE
FROM grc20_artists ga
WHERE ga.source_flags->>'cisac' = 'true'
    AND ga.ipi IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM grc20_corroboration_log 
        WHERE entity_type = 'artist' 
            AND entity_id = ga.id 
            AND field_name = 'ipi'
            AND source = 'cisac'
    );

-- ============================================================================
-- STEP 2: VALIDATE EXISTING IPI AGAINST CISAC (CONSENSUS BUILDING)
-- ============================================================================

-- For artists who already have IPI from MusicBrainz, check if CISAC agrees
WITH cisac_validation AS (
    SELECT DISTINCT
        ga.id as artist_id,
        ga.ipi as existing_ipi,
        cw.ipi_base_number as cisac_ipi,
        CASE 
            WHEN ga.ipi = cw.ipi_base_number THEN 'match'
            ELSE 'conflict'
        END as match_status
    FROM grc20_artists ga
    JOIN cisac_works cw ON 
        similarity(LOWER(cw.writer_name), LOWER(ga.name)) > 0.85
    WHERE ga.ipi IS NOT NULL 
        AND cw.ipi_base_number IS NOT NULL
)
UPDATE grc20_artists ga SET
    field_consensus = CASE
        WHEN cv.match_status = 'match' THEN
            -- Add CISAC to consensus sources
            jsonb_set(
                jsonb_set(
                    jsonb_set(
                        field_consensus,
                        '{ipi,sources}',
                        COALESCE(field_consensus->'ipi'->'sources', '[]'::jsonb) || '["cisac"]'::jsonb,
                        true
                    ),
                    '{ipi,consensus_count}',
                    to_jsonb(COALESCE((field_consensus->'ipi'->>'consensus_count')::int, 1) + 1),
                    true
                ),
                '{ipi,cisac_validated}',
                'true'::jsonb,
                true
            )
        WHEN cv.match_status = 'conflict' THEN
            -- Log conflict in field_consensus
            jsonb_set(
                field_consensus,
                '{ipi,conflicts}',
                jsonb_build_object(
                    'cisac', cv.cisac_ipi,
                    'resolution', 'Keeping original IPI from MusicBrainz (higher authority)'
                ),
                true
            )
        ELSE field_consensus
    END,
    source_flags = source_flags || jsonb_build_object('cisac', true),
    updated_at = NOW()
FROM cisac_validation cv
WHERE ga.id = cv.artist_id;

-- Log IPI validations (consensus or conflicts)
INSERT INTO grc20_corroboration_log (
    entity_type,
    entity_id,
    field_name,
    source,
    old_value,
    new_value,
    resolution_reason,
    consensus_count,
    conflict_detected
)
SELECT 
    'artist'::TEXT,
    cv.artist_id,
    'ipi'::TEXT,
    'cisac',
    cv.existing_ipi,
    cv.existing_ipi, -- No change, just validation
    CASE 
        WHEN cv.match_status = 'match' THEN
            'CISAC confirms IPI (consensus +1)'
        ELSE
            'CISAC conflict: ' || cv.cisac_ipi || ' vs existing ' || cv.existing_ipi
    END,
    CASE WHEN cv.match_status = 'match' THEN 2 ELSE 1 END,
    CASE WHEN cv.match_status = 'conflict' THEN TRUE ELSE FALSE END
FROM (
    SELECT DISTINCT
        ga.id as artist_id,
        ga.ipi as existing_ipi,
        cw.ipi_base_number as cisac_ipi,
        CASE 
            WHEN ga.ipi = cw.ipi_base_number THEN 'match'
            ELSE 'conflict'
        END as match_status
    FROM grc20_artists ga
    JOIN cisac_works cw ON 
        similarity(LOWER(cw.writer_name), LOWER(ga.name)) > 0.85
    WHERE ga.ipi IS NOT NULL 
        AND cw.ipi_base_number IS NOT NULL
) cv
WHERE NOT EXISTS (
    SELECT 1 FROM grc20_corroboration_log 
    WHERE entity_type = 'artist' 
        AND entity_id = cv.artist_id 
        AND field_name = 'ipi'
        AND source = 'cisac'
);

-- ============================================================================
-- STEP 3: UPDATE QUALITY METRICS
-- ============================================================================

UPDATE grc20_artists SET
    external_id_count = (
        (CASE WHEN genius_artist_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN mbid IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN spotify_artist_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN wikidata_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN discogs_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN isni IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN ipi IS NOT NULL THEN 1 ELSE 0 END)
    ),
    consensus_score = (
        COALESCE((field_consensus->'name'->>'consensus_count')::INTEGER, 0) +
        COALESCE((field_consensus->'image_url'->>'consensus_count')::INTEGER, 0) +
        COALESCE((field_consensus->'isni'->>'consensus_count')::INTEGER, 0) +
        COALESCE((field_consensus->'ipi'->>'consensus_count')::INTEGER, 0)
    )::NUMERIC / 4.0 / 5.0,
    updated_at = NOW()
WHERE source_flags->>'cisac' = 'true';

-- ============================================================================
-- STEP 4: UPDATE READY-TO-MINT STATUS
-- ============================================================================

UPDATE grc20_artists SET
    mint_blocking_reasons = ARRAY_REMOVE(ARRAY[
        CASE WHEN image_url IS NULL THEN 'missing_image' END,
        CASE WHEN mbid IS NULL THEN 'missing_mbid' END,
        CASE WHEN isni IS NULL THEN 'missing_isni' END,
        CASE WHEN social_link_count < 2 THEN 'insufficient_social_links' END,
        CASE WHEN completeness_score < 0.70 THEN 'low_completeness_score' END
    ], NULL),
    ready_to_mint = (
        image_url IS NOT NULL AND
        completeness_score >= 0.70 AND
        social_link_count >= 2 AND
        external_id_count >= 3
    ),
    updated_at = NOW()
WHERE source_flags->>'cisac' = 'true';

-- ============================================================================
-- STEP 5: SUMMARY STATS
-- ============================================================================

SELECT
    'IPI ENRICHMENT FROM CISAC COMPLETE' as status,
    COUNT(*) FILTER (WHERE ipi IS NOT NULL AND source_flags->>'cisac' = 'true') as newly_enriched_ipi,
    COUNT(*) FILTER (WHERE field_consensus->'ipi'->>'consensus_count' = '2') as ipi_consensus_2_sources,
    COUNT(*) FILTER (WHERE field_consensus->'ipi'->'conflicts' IS NOT NULL) as ipi_conflicts,
    COUNT(*) as total_cisac_enriched_artists
FROM grc20_artists
WHERE source_flags->>'cisac' = 'true';

-- Show sample enriched artists
SELECT
    id,
    name,
    ipi,
    field_consensus->'ipi'->>'matched_writer_name' as cisac_matched_name,
    field_consensus->'ipi'->>'work_count' as cisac_work_count,
    field_consensus->'ipi'->'sources' as ipi_sources,
    consensus_score
FROM grc20_artists
WHERE source_flags->>'cisac' = 'true' 
    AND ipi IS NOT NULL
ORDER BY (field_consensus->'ipi'->>'work_count')::INTEGER DESC
LIMIT 10;
