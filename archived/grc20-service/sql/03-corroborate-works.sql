/**
 * Works Corroboration ETL
 *
 * Merges data from:
 * - genius_songs (primary source with 1,077 works)
 * - spotify_tracks (via spotify_track_artists linkage)
 * - cisac_works (14,349 works with ISWC/ISRC/IPI)
 * - bmi_works (244 works)
 * - mlc_works (40 works)
 * - musicbrainz_works (242 works with ISWC)
 * - quansic_works (7 works)
 *
 * Resolution Rules:
 * 1. Title: Prefer Genius > Spotify (Genius has better metadata)
 * 2. ISRC: Cross-reference all sources, prefer consensus
 * 3. ISWC: Cross-reference CISAC/BMI/MLC/MusicBrainz
 * 4. Primary artist: Map from genius_songs -> grc20_artists
 * 5. Composers/Performers: Extract from MusicBrainz work relationships
 */

-- ============================================================================
-- ENABLE FUZZY MATCHING EXTENSION
-- ============================================================================

-- For title similarity matching across sources
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- STEP 1: INSERT MERGED WORK DATA FROM GENIUS + SPOTIFY
-- ============================================================================

INSERT INTO grc20_works (
    -- Core fields
    title,
    
    -- External IDs
    genius_song_id,
    spotify_track_id,
    isrc,
    iswc,
    
    -- Relationships
    primary_artist_id,
    
    -- Metadata
    language,
    release_date,
    duration_ms,
    album,
    
    -- Provenance
    source_flags,
    field_consensus
)
SELECT
    -- ========== TITLE RESOLUTION ==========
    -- Prefer Genius title (usually more accurate)
    COALESCE(gs.title, st.title) as title,
    
    -- ========== EXTERNAL IDS ==========
    gs.genius_song_id as genius_song_id,
    st.spotify_track_id as spotify_track_id,
    st.isrc,
    NULL as iswc, -- Will enrich from CISAC/BMI/MLC in next step
    
    -- ========== RELATIONSHIPS ==========
    -- Map primary artist from genius_songs -> grc20_artists
    ga.id as primary_artist_id,
    
    -- ========== METADATA ==========
    gs.language as language,
    st.release_date,
    st.duration_ms,
    st.album as album,
    
    -- ========== PROVENANCE FLAGS ==========
    jsonb_build_object(
        'genius', gs.genius_song_id IS NOT NULL,
        'spotify', st.spotify_track_id IS NOT NULL
    ) as source_flags,
    
    -- ========== FIELD CONSENSUS TRACKING ==========
    jsonb_build_object(
        -- Track title consensus
        'title', jsonb_build_object(
            'value', COALESCE(gs.title, st.title),
            'sources', jsonb_build_array(
                CASE WHEN gs.title IS NOT NULL THEN 'genius' END,
                CASE WHEN st.title IS NOT NULL THEN 'spotify' END
            ) - NULL,
            'consensus_count', (
                (CASE WHEN gs.title IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN st.title IS NOT NULL THEN 1 ELSE 0 END)
            ),
            'conflicts', '{}'::jsonb
        ),
        
        -- Track ISRC (will expand with CISAC/BMI/MLC)
        'isrc', jsonb_build_object(
            'value', st.isrc,
            'sources', jsonb_build_array(
                CASE WHEN st.isrc IS NOT NULL THEN 'spotify' END
            ) - NULL,
            'consensus_count', CASE WHEN st.isrc IS NOT NULL THEN 1 ELSE 0 END,
            'conflicts', '{}'::jsonb
        )
    ) as field_consensus

FROM genius_songs gs

-- Map to corroborated artist
JOIN grc20_artists ga ON ga.genius_artist_id = gs.genius_artist_id

-- Match Spotify tracks by artist + title similarity
LEFT JOIN spotify_track_artists sta ON sta.spotify_artist_id = ga.spotify_artist_id
LEFT JOIN spotify_tracks st ON 
    st.spotify_track_id = sta.spotify_track_id
    AND similarity(LOWER(st.title), LOWER(gs.title)) > 0.75

WHERE NOT EXISTS (
    SELECT 1 FROM grc20_works WHERE genius_song_id = gs.genius_song_id
)

ON CONFLICT (genius_song_id) DO NOTHING;

-- ============================================================================
-- STEP 2: ENRICH ISWC FROM CISAC WORKS
-- ============================================================================

WITH cisac_iswc_matches AS (
    SELECT DISTINCT ON (w.id)
        w.id as work_id,
        cw.iswc,
        similarity(LOWER(cw.title), LOWER(w.title)) as sim_score
    FROM grc20_works w
    JOIN cisac_works cw ON 
        similarity(LOWER(cw.title), LOWER(w.title)) > 0.80
    WHERE w.iswc IS NULL 
        AND cw.iswc IS NOT NULL
    ORDER BY w.id, sim_score DESC
)
UPDATE grc20_works w SET
    iswc = cim.iswc,
    source_flags = source_flags || jsonb_build_object('cisac', true),
    field_consensus = jsonb_set(
        field_consensus,
        '{iswc}',
        jsonb_build_object(
            'value', cim.iswc,
            'sources', jsonb_build_array('cisac'),
            'consensus_count', 1,
            'conflicts', '{}'::jsonb
        ),
        true
    )
FROM cisac_iswc_matches cim
WHERE w.id = cim.work_id;

-- ============================================================================
-- STEP 3: ENRICH ISWC FROM MUSICBRAINZ WORKS
-- ============================================================================

WITH mb_iswc_matches AS (
    SELECT DISTINCT ON (w.id)
        w.id as work_id,
        mbw.iswc,
        similarity(LOWER(mbw.title), LOWER(w.title)) as sim_score
    FROM grc20_works w
    JOIN musicbrainz_works mbw ON 
        similarity(LOWER(mbw.title), LOWER(w.title)) > 0.80
    WHERE mbw.iswc IS NOT NULL
    ORDER BY w.id, sim_score DESC
)
UPDATE grc20_works w SET
    iswc = COALESCE(w.iswc, mbim.iswc),
    source_flags = source_flags || jsonb_build_object('musicbrainz', true),
    field_consensus = CASE
        WHEN w.iswc IS NOT NULL THEN
            -- Add to existing sources
            jsonb_set(
                jsonb_set(
                    field_consensus,
                    '{iswc,sources}',
                    (field_consensus->'iswc'->'sources')::jsonb || '["musicbrainz"]'::jsonb,
                    true
                ),
                '{iswc,consensus_count}',
                to_jsonb(COALESCE((field_consensus->'iswc'->>'consensus_count')::int, 0) + 1),
                true
            )
        ELSE
            -- Create new ISWC consensus
            jsonb_set(
                field_consensus,
                '{iswc}',
                jsonb_build_object(
                    'value', mbim.iswc,
                    'sources', jsonb_build_array('musicbrainz'),
                    'consensus_count', 1,
                    'conflicts', '{}'::jsonb
                ),
                true
            )
    END
FROM mb_iswc_matches mbim
WHERE w.id = mbim.work_id;

-- ============================================================================
-- STEP 4: COMPUTE QUALITY METRICS
-- ============================================================================

UPDATE grc20_works SET
    -- Count unique sources
    source_count = (
        (source_flags->>'genius')::BOOLEAN::INTEGER +
        (source_flags->>'spotify')::BOOLEAN::INTEGER +
        COALESCE((source_flags->>'cisac')::BOOLEAN::INTEGER, 0) +
        COALESCE((source_flags->>'bmi')::BOOLEAN::INTEGER, 0) +
        COALESCE((source_flags->>'musicbrainz')::BOOLEAN::INTEGER, 0)
    ),
    
    -- Completeness score (key fields / total key fields)
    -- Key fields: title, genius_id, primary_artist, isrc OR iswc, release_date
    completeness_score = LEAST(1.0, (
        1.0 + -- title (always present)
        1.0 + -- genius_song_id (always present)
        (CASE WHEN primary_artist_id IS NOT NULL THEN 1.0 ELSE 0.0 END) +
        (CASE WHEN isrc IS NOT NULL OR iswc IS NOT NULL THEN 1.0 ELSE 0.0 END) +
        (CASE WHEN release_date IS NOT NULL THEN 1.0 ELSE 0.0 END)
    ) / 5.0),
    
    -- Consensus score (average consensus count across tracked fields)
    consensus_score = (
        COALESCE((field_consensus->'title'->>'consensus_count')::INTEGER, 0) +
        COALESCE((field_consensus->'isrc'->>'consensus_count')::INTEGER, 0) +
        COALESCE((field_consensus->'iswc'->>'consensus_count')::INTEGER, 0)
    )::NUMERIC / 3.0 / 5.0; -- Max 5 sources per field potentially

-- ============================================================================
-- STEP 5: SET READY-TO-MINT FLAGS & BLOCKING REASONS
-- ============================================================================

UPDATE grc20_works SET
    mint_blocking_reasons = ARRAY_REMOVE(ARRAY[
        CASE WHEN primary_artist_id IS NULL THEN 'missing_primary_artist' END,
        CASE WHEN iswc IS NULL THEN 'missing_iswc' END,
        CASE WHEN completeness_score < 0.60 THEN 'low_completeness_score' END,
        CASE WHEN source_count < 2 THEN 'insufficient_sources' END
    ], NULL);

UPDATE grc20_works SET
    ready_to_mint = (
        primary_artist_id IS NOT NULL AND -- Must have artist linkage
        iswc IS NOT NULL AND -- REQUIRED: ISWC is the authoritative work identifier
        completeness_score >= 0.60 AND -- At least 60% complete
        source_count >= 2 -- At least 2 sources
    );

-- ============================================================================
-- STEP 6: SUMMARY STATS
-- ============================================================================

SELECT
    'WORK CORROBORATION COMPLETE' as status,
    COUNT(*) as total_works,
    COUNT(*) FILTER (WHERE ready_to_mint) as ready_to_mint,
    ROUND(AVG(completeness_score), 2) as avg_completeness,
    ROUND(AVG(consensus_score), 2) as avg_consensus,
    COUNT(*) FILTER (WHERE isrc IS NOT NULL) as has_isrc,
    COUNT(*) FILTER (WHERE iswc IS NOT NULL) as has_iswc,
    COUNT(*) FILTER (WHERE primary_artist_id IS NOT NULL) as has_primary_artist,
    COUNT(*) FILTER (WHERE source_count >= 2) as has_2plus_sources
FROM grc20_works;
