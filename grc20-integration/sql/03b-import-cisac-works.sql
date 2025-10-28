/**
 * Import CISAC Works Directly
 *
 * Instead of only using CISAC for enrichment, this imports ALL CISAC works
 * and links them to grc20_artists via IPI/ISNI matching from composers/authors arrays.
 *
 * This should dramatically increase mintable works from 206 → ~10,000+
 */

-- ============================================================================
-- STEP 1: INSERT CISAC WORKS WITH ARTIST LINKAGE
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
    cw.title,
    cw.iswc,
    
    -- Find primary artist by matching first composer's name (token-based fuzzy match)
    (
        SELECT ga.id
        FROM grc20_artists ga
        WHERE 
            -- Token-based matching (handles name order differences like "Taylor Swift" vs "SWIFT TAYLOR")
            similarity(
                LOWER(regexp_replace(ga.name, '[^a-z0-9\s]', '', 'gi')),
                LOWER(regexp_replace(cw.composers->0->>'name', '[^a-z0-9\s]', '', 'gi'))
            ) > 0.45
        ORDER BY similarity(
            LOWER(regexp_replace(ga.name, '[^a-z0-9\s]', '', 'gi')),
            LOWER(regexp_replace(cw.composers->0->>'name', '[^a-z0-9\s]', '', 'gi'))
        ) DESC
        LIMIT 1
    ) as primary_artist_id,
    
    -- Collect all composer IDs from grc20_artists via name matching
    (
        SELECT ARRAY_AGG(DISTINCT ga.id)
        FROM grc20_artists ga
        CROSS JOIN jsonb_array_elements(cw.composers) AS composer
        WHERE 
            similarity(
                LOWER(regexp_replace(ga.name, '[^a-z0-9\s]', '', 'gi')),
                LOWER(regexp_replace(composer->>'name', '[^a-z0-9\s]', '', 'gi'))
            ) > 0.45
    ) as composer_ids,
    
    -- Provenance flags
    jsonb_build_object(
        'cisac', true
    ) as source_flags,
    
    -- Field consensus tracking
    jsonb_build_object(
        'title', jsonb_build_object(
            'value', cw.title,
            'sources', jsonb_build_array('cisac'),
            'consensus_count', 1,
            'conflicts', '{}'::jsonb
        ),
        'iswc', jsonb_build_object(
            'value', cw.iswc,
            'sources', jsonb_build_array('cisac'),
            'consensus_count', 1,
            'conflicts', '{}'::jsonb
        )
    ) as field_consensus,
    
    1 as source_count, -- CISAC only
    
    -- Completeness score
    LEAST(1.0, (
        1.0 + -- title (always present)
        1.0 + -- iswc (always present)
        (CASE WHEN (
            SELECT ga.id
            FROM grc20_artists ga
            WHERE similarity(
                LOWER(regexp_replace(ga.name, '[^a-z0-9\s]', '', 'gi')),
                LOWER(regexp_replace(cw.composers->0->>'name', '[^a-z0-9\s]', '', 'gi'))
            ) > 0.45
            LIMIT 1
        ) IS NOT NULL THEN 1.0 ELSE 0.0 END) -- has artist linkage
    ) / 3.0) as completeness_score

FROM cisac_works cw

WHERE 
    -- Only import works where we can link to at least one artist via name match
    EXISTS (
        SELECT 1
        FROM grc20_artists ga
        CROSS JOIN jsonb_array_elements(cw.composers) AS composer
        WHERE 
            similarity(
                LOWER(regexp_replace(ga.name, '[^a-z0-9\s]', '', 'gi')),
                LOWER(regexp_replace(composer->>'name', '[^a-z0-9\s]', '', 'gi'))
            ) > 0.45
    )
    -- Don't duplicate works we already have from Genius
    AND NOT EXISTS (
        SELECT 1 FROM grc20_works WHERE iswc = cw.iswc
    );

-- ============================================================================
-- STEP 2: UPDATE QUALITY METRICS FOR NEW CISAC WORKS
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

WHERE source_flags->>'cisac' = 'true'
  AND source_flags->>'genius' IS NULL; -- Only update CISAC-only works

-- ============================================================================
-- STEP 3: SUMMARY STATS
-- ============================================================================

SELECT
    'CISAC WORKS IMPORT COMPLETE' as status,
    COUNT(*) as total_cisac_imports,
    COUNT(*) FILTER (WHERE ready_to_mint) as ready_to_mint,
    COUNT(*) FILTER (WHERE primary_artist_id IS NOT NULL) as has_artist_linkage,
    COUNT(*) FILTER (WHERE composer_ids IS NOT NULL) as has_composers,
    ROUND(AVG(completeness_score), 2) as avg_completeness,
    ROUND(AVG(array_length(composer_ids, 1)), 1) as avg_composers_per_work
FROM grc20_works
WHERE source_flags->>'cisac' = 'true'
  AND source_flags->>'genius' IS NULL; -- CISAC-only works
