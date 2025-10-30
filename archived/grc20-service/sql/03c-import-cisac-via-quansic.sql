/**
 * Import CISAC Works via Quansic Enrichment
 *
 * Uses Quansic works data (which has clean IPI/ISNI contributor data)
 * to import CISAC works and link them to grc20_artists.
 *
 * Prerequisite: Run enrich-cisac-via-quansic.ts to populate quansic_works
 */

-- ============================================================================
-- STEP 1: INSERT QUANSIC-ENRICHED CISAC WORKS
-- ============================================================================

INSERT INTO grc20_works (
    title,
    iswc,
    primary_artist_id,
    composer_ids,
    source_flags,
    field_consensus,
    source_count,
    completeness_score
)
SELECT
    qw.title,
    qw.iswc,
    
    -- Find primary artist by matching first contributor's IPI/ISNI from Quansic
    (
        SELECT ga.id
        FROM grc20_artists ga
        WHERE 
            -- Match by IPI (most reliable)
            ga.ipi = (qw.raw_data->'work'->'contributors'->0->'ids'->'ipis'->>0)
            OR
            -- Fallback to ISNI match
            ga.isni = (qw.raw_data->'work'->'contributors'->0->'ids'->'isnis'->>0)
        LIMIT 1
    ) as primary_artist_id,
    
    -- Collect all composer IDs from grc20_artists via IPI/ISNI matching
    (
        SELECT ARRAY_AGG(DISTINCT ga.id)
        FROM grc20_artists ga
        CROSS JOIN jsonb_array_elements(qw.raw_data->'work'->'contributors') AS contributor
        WHERE 
            -- Match by IPI
            ga.ipi = ANY(
                SELECT jsonb_array_elements_text(contributor->'ids'->'ipis')
            )
            OR
            -- Match by ISNI
            ga.isni = ANY(
                SELECT jsonb_array_elements_text(contributor->'ids'->'isnis')
            )
    ) as composer_ids,
    
    -- Provenance flags
    jsonb_build_object(
        'cisac', true,
        'quansic', true
    ) as source_flags,
    
    -- Field consensus tracking
    jsonb_build_object(
        'title', jsonb_build_object(
            'value', qw.title,
            'sources', jsonb_build_array('cisac', 'quansic'),
            'consensus_count', 2,
            'conflicts', '{}'::jsonb
        ),
        'iswc', jsonb_build_object(
            'value', qw.iswc,
            'sources', jsonb_build_array('cisac', 'quansic'),
            'consensus_count', 2,
            'conflicts', '{}'::jsonb
        )
    ) as field_consensus,
    
    2 as source_count, -- CISAC + Quansic
    
    -- Completeness score
    LEAST(1.0, (
        1.0 + -- title (always present)
        1.0 + -- iswc (always present)
        (CASE WHEN (
            SELECT ga.id
            FROM grc20_artists ga
            WHERE 
                ga.ipi = (qw.raw_data->'work'->'contributors'->0->'ids'->'ipis'->>0)
                OR ga.isni = (qw.raw_data->'work'->'contributors'->0->'ids'->'isnis'->>0)
            LIMIT 1
        ) IS NOT NULL THEN 1.0 ELSE 0.0 END) -- has artist linkage
    ) / 3.0) as completeness_score

FROM quansic_works qw

WHERE 
    -- Only import works where we can link to at least one artist via IPI/ISNI
    EXISTS (
        SELECT 1
        FROM grc20_artists ga
        CROSS JOIN jsonb_array_elements(qw.raw_data->'work'->'contributors') AS contributor
        WHERE 
            ga.ipi = ANY(
                SELECT jsonb_array_elements_text(contributor->'ids'->'ipis')
            )
            OR ga.isni = ANY(
                SELECT jsonb_array_elements_text(contributor->'ids'->'isnis')
            )
    )
    -- Don't duplicate works we already have
    AND NOT EXISTS (
        SELECT 1 FROM grc20_works WHERE iswc = qw.iswc
    );

-- ============================================================================
-- STEP 2: UPDATE QUALITY METRICS FOR QUANSIC-IMPORTED WORKS
-- ============================================================================

UPDATE grc20_works SET
    -- Set blocking reasons
    mint_blocking_reasons = ARRAY_REMOVE(ARRAY[
        CASE WHEN primary_artist_id IS NULL THEN 'missing_primary_artist' END,
        CASE WHEN iswc IS NULL THEN 'missing_iswc' END,
        CASE WHEN completeness_score < 0.60 THEN 'low_completeness_score' END
    ], NULL),
    
    -- Set ready to mint flag
    ready_to_mint = (
        primary_artist_id IS NOT NULL AND
        iswc IS NOT NULL AND
        completeness_score >= 0.60
    )

WHERE source_flags->>'quansic' = 'true'
  AND source_flags->>'genius' IS NULL; -- Only update Quansic-only works

-- ============================================================================
-- STEP 3: SUMMARY STATS
-- ============================================================================

SELECT
    'QUANSIC WORKS IMPORT COMPLETE' as status,
    COUNT(*) as total_quansic_imports,
    COUNT(*) FILTER (WHERE ready_to_mint) as ready_to_mint,
    COUNT(*) FILTER (WHERE primary_artist_id IS NOT NULL) as has_artist_linkage,
    COUNT(*) FILTER (WHERE composer_ids IS NOT NULL) as has_composers,
    ROUND(AVG(completeness_score), 2) as avg_completeness,
    ROUND(AVG(array_length(composer_ids, 1)), 1) as avg_composers_per_work
FROM grc20_works
WHERE source_flags->>'quansic' = 'true'
  AND source_flags->>'genius' IS NULL; -- Quansic-only works
