/**
 * Artist Corroboration ETL
 *
 * Merges data from:
 * - genius_artists (primary source, has most coverage)
 * - musicbrainz_artists (authoritative for MBID, ISNI, IPI, bio data)
 * - spotify_artists (via MB link, for popularity/genres)
 * - artist_images (Fal generated Grove images)
 *
 * Resolution Rules:
 * 1. Name: Prefer MusicBrainz canonical name > Genius name
 * 2. IDs: Prefer non-null, track consensus for ISNI/IPI
 * 3. Social: Prefer MusicBrainz handles > Genius handles
 * 4. Images: ALWAYS prefer Fal generated > Spotify > Genius
 * 5. Bio: MusicBrainz is authoritative
 * 6. Genres/Popularity: Spotify only
 */

-- ============================================================================
-- STEP 1: INSERT MERGED ARTIST DATA
-- ============================================================================

INSERT INTO grc20_artists (
    -- Core fields
    name,
    alternate_names,
    sort_name,

    -- External IDs
    genius_artist_id,
    mbid,
    spotify_artist_id,
    wikidata_id,
    discogs_id,
    isni,
    ipi,

    -- Social media
    instagram_handle,
    tiktok_handle,
    twitter_handle,
    facebook_handle,
    youtube_channel,
    soundcloud_handle,

    -- Platform IDs
    apple_music_id,
    deezer_id,
    tidal_id,

    -- URLs
    spotify_url,
    genius_url,

    -- Images
    image_url,
    image_source,
    header_image_url,

    -- Bio
    artist_type,
    country,
    gender,
    birth_date,
    death_date,
    disambiguation,

    -- Genres/Popularity
    genres,
    spotify_followers,
    spotify_popularity,

    -- Provenance
    source_flags,
    field_consensus
)
SELECT
    -- ========== NAME RESOLUTION ==========
    -- Prefer MusicBrainz > Genius
    COALESCE(ma.name, ga.name) as name,

    -- Combine alternate names from both sources
    ARRAY_REMOVE(
        ARRAY_CAT(
            ga.alternate_names,
            CASE WHEN ma.name IS NOT NULL AND ma.name != COALESCE(ma.name, ga.name)
                THEN ARRAY[ma.name]
                ELSE ARRAY[]::TEXT[]
            END
        ),
        NULL
    ) as alternate_names,

    ma.sort_name,

    -- ========== EXTERNAL IDS ==========
    ga.genius_artist_id,
    ma.mbid,
    COALESCE(sa.spotify_artist_id, ma.spotify_artist_id) as spotify_artist_id,
    ma.wikidata_id,
    ma.discogs_id,

    -- Industry IDs (will track consensus below - prefer Quansic > MusicBrainz > BMI)
    COALESCE(qa.isni, ma.isnis[1]) as isni, -- Quansic has 100% ISNI coverage
    COALESCE(ma.ipi, bmi.ipi) as ipi, -- Add BMI IPI enrichment

    -- ========== SOCIAL MEDIA (Prefer MB > Genius) ==========
    NULLIF(COALESCE(ma.instagram_handle, ga.instagram_name), '') as instagram_handle,
    NULLIF(ma.tiktok_handle, '') as tiktok_handle,
    NULLIF(COALESCE(ma.twitter_handle, ga.twitter_name), '') as twitter_handle,
    NULLIF(COALESCE(ma.facebook_handle, ga.facebook_name), '') as facebook_handle,
    -- Fix youtube_channel: ensure we get the actual channel ID, not 'channel' or 'user'
    CASE 
        WHEN ma.youtube_channel IS NOT NULL AND ma.youtube_channel != '' 
             AND ma.youtube_channel NOT IN ('channel', 'user', 'c')
        THEN ma.youtube_channel
        ELSE NULL
    END as youtube_channel,
    NULLIF(ma.soundcloud_handle, '') as soundcloud_handle,

    -- ========== PLATFORM IDS (Prefer Quansic > MusicBrainz) ==========
    COALESCE(qa.apple_music_id, ma.apple_music_id) as apple_music_id,
    ma.deezer_id, -- Quansic doesn't have deezer in separate column
    ma.tidal_id, -- Quansic doesn't have tidal in separate column

    -- ========== URLs ==========
    CASE
        WHEN sa.spotify_artist_id IS NOT NULL
            THEN 'https://open.spotify.com/artist/' || sa.spotify_artist_id
        WHEN ma.spotify_artist_id IS NOT NULL
            THEN 'https://open.spotify.com/artist/' || ma.spotify_artist_id
        ELSE NULL
    END as spotify_url,

    ga.url as genius_url,

    -- ========== IMAGES (PREFER FAL > SPOTIFY > GENIUS) ==========
    COALESCE(
        ai.generated_image_url,                                    -- Fal generated (priority 1)
        sa.images->0->>'url',                                      -- Spotify (priority 2) - first image from JSONB array
        ga.image_url                                               -- Genius fallback (priority 3)
    ) as image_url,

    CASE
        WHEN ai.generated_image_url IS NOT NULL THEN 'fal'
        WHEN sa.images->0->>'url' IS NOT NULL THEN 'spotify'
        WHEN ga.image_url IS NOT NULL THEN 'genius'
        ELSE NULL
    END as image_source,

    ga.header_image_url,

    -- ========== BIOGRAPHICAL (MusicBrainz authoritative) ==========
    ma.type as artist_type,
    ma.country,
    ma.gender,
    ma.birth_date,
    ma.death_date,
    ma.disambiguation,

    -- ========== GENRES/POPULARITY (Spotify only) ==========
    sa.genres,
    sa.followers as spotify_followers,
    sa.popularity as spotify_popularity,

    -- ========== PROVENANCE FLAGS ==========
    jsonb_build_object(
        'genius', ga.genius_artist_id IS NOT NULL,
        'musicbrainz', ma.mbid IS NOT NULL,
        'spotify', sa.spotify_artist_id IS NOT NULL,
        'fal_image', ai.generated_image_url IS NOT NULL
    ) as source_flags,

    -- ========== FIELD CONSENSUS TRACKING ==========
    jsonb_build_object(
        -- Track ISNI consensus (example - would expand with CISAC/BMI/MLC data)
        'isni', jsonb_build_object(
            'value', COALESCE(ma.isnis[1]),
            'sources', jsonb_build_array(
                CASE WHEN ma.isnis[1] IS NOT NULL THEN 'musicbrainz' END
                -- TODO: Add 'cisac', 'mlc', 'bmi', 'quansic' when we join those tables
            ) - NULL, -- Remove nulls from array
            'consensus_count', CASE WHEN ma.isnis[1] IS NOT NULL THEN 1 ELSE 0 END,
            'conflicts', '{}'::jsonb
        ),

        -- Track name consensus
        'name', jsonb_build_object(
            'value', COALESCE(ma.name, ga.name),
            'sources', jsonb_build_array(
                CASE WHEN ga.name IS NOT NULL THEN 'genius' END,
                CASE WHEN ma.name IS NOT NULL THEN 'musicbrainz' END,
                CASE WHEN sa.name IS NOT NULL THEN 'spotify' END
            ) - NULL,
            'consensus_count', (
                (CASE WHEN ga.name IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN ma.name IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN sa.name IS NOT NULL THEN 1 ELSE 0 END)
            ),
            'conflicts', '{}'::jsonb -- TODO: Detect name conflicts
        ),

        -- Track image consensus
        'image_url', jsonb_build_object(
            'value', COALESCE(ai.generated_image_url, sa.images->0->>'url', ga.image_url),
            'sources', jsonb_build_array(
                CASE WHEN ai.generated_image_url IS NOT NULL THEN 'fal' END,
                CASE WHEN sa.images->0->>'url' IS NOT NULL THEN 'spotify' END,
                CASE WHEN ga.image_url IS NOT NULL THEN 'genius' END
            ) - NULL,
            'consensus_count', (
                (CASE WHEN ai.generated_image_url IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN sa.images->0->>'url' IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN ga.image_url IS NOT NULL THEN 1 ELSE 0 END)
            ),
            'primary_source', CASE
                WHEN ai.generated_image_url IS NOT NULL THEN 'fal'
                WHEN sa.images->0->>'url' IS NOT NULL THEN 'spotify'
                WHEN ga.image_url IS NOT NULL THEN 'genius'
                ELSE NULL
            END
        )
    ) as field_consensus

FROM genius_artists ga

-- Join Spotify via Genius name match first (to get spotify_artist_id)
LEFT JOIN spotify_artists sa ON
    LOWER(sa.name) = LOWER(ga.name)

-- Join MusicBrainz via spotify_artist_id (94% coverage) or fallback to genius_slug (1%)
LEFT JOIN musicbrainz_artists ma ON
    ma.spotify_artist_id = sa.spotify_artist_id
    OR LOWER(ma.genius_slug) = LOWER(REGEXP_REPLACE(ga.url, 'https://genius.com/artists/', ''))

-- Join Fal generated images via Spotify ID
LEFT JOIN artist_images ai ON
    ai.spotify_artist_id = sa.spotify_artist_id
    AND ai.status = 'completed'

-- Join Quansic via MusicBrainz ID (for ISNI + Apple Music enrichment)
-- Use DISTINCT ON subquery to avoid duplicates
LEFT JOIN LATERAL (
    SELECT DISTINCT ON (qa.isni) qa.isni, qa.apple_music_id, qa.musicbrainz_mbid
    FROM quansic_artists qa
    WHERE qa.musicbrainz_mbid = ma.mbid
    LIMIT 1
) qa ON true

-- Join BMI IPIs via fuzzy name match (for IPI enrichment)
LEFT JOIN LATERAL (
    SELECT DISTINCT ON (bmi.ipi) bmi.ipi, bmi.artist_name
    FROM bmi_artist_ipis bmi
    WHERE similarity(LOWER(bmi.artist_name), LOWER(ga.name)) > 0.85
    ORDER BY bmi.ipi, similarity(LOWER(bmi.artist_name), LOWER(ga.name)) DESC
    LIMIT 1
) bmi ON true

WHERE ga.genius_artist_id IS NOT NULL; -- Only process artists with Genius ID

-- ============================================================================
-- STEP 2: COMPUTE QUALITY METRICS
-- ============================================================================

UPDATE grc20_artists SET
    -- Count non-null external IDs
    external_id_count = (
        (CASE WHEN genius_artist_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN mbid IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN spotify_artist_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN wikidata_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN discogs_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN isni IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN ipi IS NOT NULL THEN 1 ELSE 0 END)
    ),

    -- Count non-null social links
    social_link_count = (
        (CASE WHEN instagram_handle IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN tiktok_handle IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN twitter_handle IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN facebook_handle IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN youtube_channel IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN soundcloud_handle IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN spotify_url IS NOT NULL THEN 1 ELSE 0 END)
    ),

    -- Count music-oriented platforms (TikTok/YouTube/SoundCloud/Spotify/Genius)
    music_platform_count = (
        (CASE WHEN tiktok_handle IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN youtube_channel IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN soundcloud_handle IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN spotify_url IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN genius_url IS NOT NULL THEN 1 ELSE 0 END)
    ),

    -- Count unique sources
    source_count = (
        (source_flags->>'genius')::BOOLEAN::INTEGER +
        (source_flags->>'musicbrainz')::BOOLEAN::INTEGER +
        (source_flags->>'spotify')::BOOLEAN::INTEGER +
        (source_flags->>'fal_image')::BOOLEAN::INTEGER
    ),

    -- Completeness score (key fields / total key fields)
    -- Key fields: name, genius_id, image_url, at least 2 social links, at least 3 external IDs
    completeness_score = LEAST(1.0, (
        1.0 + -- name (always present)
        1.0 + -- genius_id (always present)
        (CASE WHEN image_url IS NOT NULL THEN 1.0 ELSE 0.0 END) +
        (CASE WHEN (
            (CASE WHEN instagram_handle IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN tiktok_handle IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN twitter_handle IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN facebook_handle IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN youtube_channel IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN soundcloud_handle IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN spotify_url IS NOT NULL THEN 1 ELSE 0 END)
        ) >= 2 THEN 1.0 ELSE 0.0 END) +
        (CASE WHEN (
            (CASE WHEN genius_artist_id IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN mbid IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN spotify_artist_id IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN wikidata_id IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN isni IS NOT NULL THEN 1 ELSE 0 END)
        ) >= 3 THEN 1.0 ELSE 0.0 END)
    ) / 5.0),

    -- Consensus score (average consensus count across tracked fields)
    consensus_score = (
        COALESCE((field_consensus->'name'->>'consensus_count')::INTEGER, 0) +
        COALESCE((field_consensus->'image_url'->>'consensus_count')::INTEGER, 0) +
        COALESCE((field_consensus->'isni'->>'consensus_count')::INTEGER, 0)
    )::NUMERIC / 3.0 / 4.0; -- Max 4 sources per field currently

-- ============================================================================
-- STEP 3: SET READY-TO-MINT FLAGS & BLOCKING REASONS
-- ============================================================================

UPDATE grc20_artists SET
    mint_blocking_reasons = ARRAY_REMOVE(ARRAY[
        CASE WHEN image_url IS NULL THEN 'missing_image' END,
        CASE WHEN mbid IS NULL THEN 'missing_mbid' END,
        CASE WHEN isni IS NULL THEN 'missing_isni' END,
        CASE WHEN music_platform_count < 1 THEN 'missing_music_platform' END,
        CASE WHEN completeness_score < 0.70 THEN 'low_completeness_score' END
    ], NULL);

UPDATE grc20_artists SET
    ready_to_mint = (
        image_url IS NOT NULL AND -- Just need ANY image (Fal > Spotify > Genius)
        mbid IS NOT NULL AND -- Required: MusicBrainz ID for ecosystem linking
        isni IS NOT NULL AND -- Required: ISNI for authoritative identification
        music_platform_count >= 1 AND -- At least one music-oriented platform
        completeness_score >= 0.70 AND -- At least 70% complete
        external_id_count >= 3 -- At least 3 external IDs
    );

-- ============================================================================
-- STEP 4: SUMMARY STATS
-- ============================================================================

SELECT
    'ARTIST CORROBORATION COMPLETE' as status,
    COUNT(*) as total_artists,
    COUNT(*) FILTER (WHERE ready_to_mint) as ready_to_mint,
    ROUND(AVG(completeness_score), 2) as avg_completeness,
    ROUND(AVG(consensus_score), 2) as avg_consensus,
    COUNT(*) FILTER (WHERE mbid IS NOT NULL) as has_mbid,
    COUNT(*) FILTER (WHERE isni IS NOT NULL) as has_isni,
    COUNT(*) FILTER (WHERE image_url IS NOT NULL) as has_image,
    COUNT(*) FILTER (WHERE social_link_count >= 2) as has_2plus_social
FROM grc20_artists;
