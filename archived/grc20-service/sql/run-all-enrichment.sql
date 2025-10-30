/**
 * Master Enrichment Script
 * 
 * Runs all GRC-20 enrichment steps in correct order:
 * 1. Create corroboration schema (if not exists)
 * 2. Corroborate artists from multiple sources
 * 3. Corroborate works from multiple sources
 * 4. Backfill corroboration log with audit trail
 * 5. Enrich artists with IPI from CISAC
 * 
 * Usage:
 *   psql -d your_database < run-all-enrichment.sql
 * 
 * Or via Neon MCP:
 *   Call run_sql for each file in sequence
 */

\echo '=========================================='
\echo 'GRC-20 DATA ENRICHMENT PIPELINE'
\echo '=========================================='
\echo ''

-- ============================================================================
-- STEP 1: CREATE SCHEMA (IDEMPOTENT)
-- ============================================================================

\echo 'Step 1: Creating GRC-20 corroboration schema...'
\i 01-create-corroboration-schema.sql
\echo ''

-- ============================================================================
-- STEP 2: CORROBORATE ARTISTS
-- ============================================================================

\echo 'Step 2: Corroborating artists from Genius, MusicBrainz, Spotify...'
\i 02-corroborate-artists.sql
\echo ''

-- ============================================================================
-- STEP 3: CORROBORATE WORKS
-- ============================================================================

\echo 'Step 3: Corroborating works from Genius, Spotify, CISAC, BMI, MusicBrainz...'
\i 03-corroborate-works.sql
\echo ''

-- ============================================================================
-- STEP 4: BACKFILL CORROBORATION LOG
-- ============================================================================

\echo 'Step 4: Backfilling corroboration log with historical decisions...'
\i 04-backfill-corroboration-log.sql
\echo ''

-- ============================================================================
-- STEP 5: ENRICH ARTISTS WITH IPI FROM CISAC
-- ============================================================================

\echo 'Step 5: Enriching artists with IPI from CISAC works...'
\i 05-enrich-artists-ipi-from-cisac.sql
\echo ''

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

\echo '=========================================='
\echo 'ENRICHMENT COMPLETE - SUMMARY STATISTICS'
\echo '=========================================='
\echo ''

-- Overall data quality
SELECT * FROM data_quality_dashboard;

\echo ''
\echo 'Artist Enrichment Details:'
\echo '--------------------------'

SELECT 
    COUNT(*) as total_artists,
    COUNT(*) FILTER (WHERE ready_to_mint = true) as ready_to_mint,
    COUNT(*) FILTER (WHERE isni IS NOT NULL) as has_isni,
    COUNT(*) FILTER (WHERE ipi IS NOT NULL) as has_ipi,
    COUNT(*) FILTER (WHERE mbid IS NOT NULL) as has_mbid,
    COUNT(*) FILTER (WHERE wikidata_id IS NOT NULL) as has_wikidata,
    COUNT(*) FILTER (WHERE source_flags->>'cisac' = 'true') as enriched_from_cisac,
    COUNT(*) FILTER (WHERE source_count >= 3) as multi_source_artists,
    ROUND(AVG(completeness_score), 2) as avg_completeness,
    ROUND(AVG(consensus_score), 2) as avg_consensus
FROM grc20_artists;

\echo ''
\echo 'Work Enrichment Details:'
\echo '------------------------'

SELECT 
    COUNT(*) as total_works,
    COUNT(*) FILTER (WHERE ready_to_mint = true) as ready_to_mint,
    COUNT(*) FILTER (WHERE isrc IS NOT NULL) as has_isrc,
    COUNT(*) FILTER (WHERE iswc IS NOT NULL) as has_iswc,
    COUNT(*) FILTER (WHERE primary_artist_id IS NOT NULL) as has_artist_link,
    COUNT(*) FILTER (WHERE source_flags->>'cisac' = 'true') as enriched_from_cisac,
    COUNT(*) FILTER (WHERE source_flags->>'bmi' = 'true') as enriched_from_bmi,
    COUNT(*) FILTER (WHERE source_count >= 2) as multi_source_works,
    ROUND(AVG(completeness_score), 2) as avg_completeness,
    ROUND(AVG(consensus_score), 2) as avg_consensus
FROM grc20_works;

\echo ''
\echo 'Corroboration Log Summary:'
\echo '--------------------------'

SELECT
    COUNT(*) as total_log_entries,
    COUNT(DISTINCT entity_id) as unique_entities,
    COUNT(DISTINCT field_name) as unique_fields,
    COUNT(*) FILTER (WHERE consensus_count > 1) as multi_source_fields,
    COUNT(*) FILTER (WHERE conflict_detected = true) as conflicts_detected
FROM grc20_corroboration_log;

\echo ''
\echo '=========================================='
\echo 'NEXT STEPS:'
\echo '1. Review data_quality_dashboard view'
\echo '2. Check mintable_artists_summary view'
\echo '3. Run validation checks'
\echo '4. Begin GRC-20 minting process'
\echo '=========================================='
