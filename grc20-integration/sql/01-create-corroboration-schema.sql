/**
 * GRC-20 Corroboration Schema
 *
 * Creates consensus-based "golden record" tables that merge data from:
 * - Genius (genius_artists, genius_songs)
 * - MusicBrainz (musicbrainz_artists, musicbrainz_works)
 * - Spotify (spotify_artists, spotify_tracks)
 * - Industry sources (CISAC, BMI, MLC, Quansic)
 * - Generated assets (artist_images from Fal)
 *
 * Key features:
 * - Per-field provenance tracking (which sources contributed)
 * - Consensus counting (e.g., "ISNI confirmed in 4 sources")
 * - Conflict resolution with audit trail
 * - Quality scoring (completeness, consensus)
 * - Ready-to-mint gating
 */

-- ============================================================================
-- CORROBORATED ARTISTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS grc20_artists (
    id SERIAL PRIMARY KEY,

    -- ========== RESOLVED CORE FIELDS ==========
    -- (These are the "winner" values after applying resolution rules)

    name TEXT NOT NULL,
    alternate_names TEXT[], -- From Genius + MusicBrainz aliases
    sort_name TEXT, -- From MusicBrainz

    -- ========== EXTERNAL IDS (LINKING KEYS) ==========

    -- Primary identifiers (prefer non-null, track consensus below)
    genius_artist_id INTEGER UNIQUE,
    mbid TEXT, -- MusicBrainz ID (stored as TEXT, not UUID to handle edge cases)
    spotify_artist_id TEXT,
    wikidata_id TEXT,
    discogs_id TEXT,

    -- Industry identifiers (HIGH VALUE - track consensus)
    isni TEXT, -- International Standard Name Identifier
    ipi TEXT, -- Interested Party Information

    -- ========== SOCIAL MEDIA & STREAMING LINKS ==========
    -- (Prefer MusicBrainz > Genius for handles)

    instagram_handle TEXT,
    tiktok_handle TEXT,
    twitter_handle TEXT,
    facebook_handle TEXT,
    youtube_channel TEXT,
    soundcloud_handle TEXT,

    -- Platform IDs (for URL construction)
    apple_music_id TEXT,
    deezer_id TEXT,
    tidal_id TEXT,

    -- Full URLs (constructed or from sources)
    spotify_url TEXT,
    genius_url TEXT,

    -- ========== VISUAL ASSETS ==========
    -- (Prefer Fal generated > Spotify > Genius)

    image_url TEXT, -- Primary image (prefer Fal Grove image)
    image_source TEXT, -- 'fal' | 'spotify' | 'genius'
    header_image_url TEXT, -- Banner/header (usually from Genius)

    -- ========== BIOGRAPHICAL METADATA ==========

    artist_type TEXT, -- 'person' | 'group' | 'orchestra' | etc
    country CHAR(2), -- ISO country code
    gender TEXT,
    birth_date DATE,
    death_date DATE,
    disambiguation TEXT, -- MusicBrainz disambiguation

    -- ========== GENRE & POPULARITY ==========

    genres TEXT[], -- Array from Spotify/MusicBrainz
    spotify_followers INTEGER, -- For discovery (not priority)
    spotify_popularity INTEGER, -- 0-100 score

    -- ========== PROVENANCE & CONSENSUS TRACKING ==========
    -- (JSONB for flexible per-field tracking)

    -- Which sources contributed to this entity
    source_flags JSONB DEFAULT '{}', -- e.g., {"genius": true, "musicbrainz": true, "spotify": true, "fal_image": true}

    -- Per-field consensus details
    -- Example: {
    --   "isni": {
    --     "value": "0000000123456789",
    --     "sources": ["cisac", "mlc", "bmi", "quansic"],
    --     "consensus_count": 4,
    --     "conflicts": {}
    --   },
    --   "name": {
    --     "value": "Lil Wayne",
    --     "sources": ["genius", "musicbrainz", "spotify"],
    --     "consensus_count": 3,
    --     "conflicts": {}
    --   }
    -- }
    field_consensus JSONB DEFAULT '{}',

    -- ========== QUALITY METRICS ==========

    completeness_score NUMERIC(3,2) DEFAULT 0.00, -- 0.00 to 1.00 (% of key fields filled)
    consensus_score NUMERIC(3,2) DEFAULT 0.00, -- Average consensus across tracked fields
    external_id_count INTEGER DEFAULT 0, -- Count of non-null external IDs
    social_link_count INTEGER DEFAULT 0, -- Count of non-null social links
    music_platform_count INTEGER DEFAULT 0, -- Count of music-oriented platforms (TikTok/YouTube/SoundCloud/Spotify/Genius)
    source_count INTEGER DEFAULT 0, -- Total unique sources

    -- ========== GRC-20 MINTING STATUS ==========

    ready_to_mint BOOLEAN DEFAULT FALSE,
    mint_blocking_reasons TEXT[], -- e.g., ["missing_isni", "low_consensus_score"]
    minted_at TIMESTAMP,
    grc20_entity_id UUID, -- Set after successful mint

    -- ========== TIMESTAMPS ==========

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- CORROBORATED WORKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS grc20_works (
    id SERIAL PRIMARY KEY,

    -- ========== RESOLVED CORE FIELDS ==========

    title TEXT NOT NULL,

    -- ========== EXTERNAL IDS ==========

    genius_song_id INTEGER UNIQUE,
    spotify_track_id TEXT,
    apple_music_id TEXT,

    -- Industry identifiers (CRITICAL for consensus)
    isrc TEXT, -- International Standard Recording Code
    iswc TEXT, -- International Standard Musical Work Code

    -- ========== RELATIONSHIPS ==========

    primary_artist_id INTEGER REFERENCES grc20_artists(id),
    composer_ids INTEGER[], -- Array of grc20_artists.id (from MusicBrainz)
    performer_ids INTEGER[], -- Array of grc20_artists.id

    -- ========== METADATA ==========

    language CHAR(2), -- ISO 639-1 code
    release_date DATE,
    duration_ms INTEGER,
    album TEXT,

    -- ========== PROVENANCE & CONSENSUS ==========

    -- Which sources have this work
    source_flags JSONB DEFAULT '{}', -- e.g., {"genius": true, "spotify": true, "cisac": true, "bmi": true}

    -- Per-field consensus
    -- Example: {
    --   "isrc": {
    --     "value": "USRC17607839",
    --     "sources": ["cisac", "bmi", "mlc"],
    --     "consensus_count": 3,
    --     "conflicts": {}
    --   }
    -- }
    field_consensus JSONB DEFAULT '{}',

    -- ========== QUALITY METRICS ==========

    completeness_score NUMERIC(3,2) DEFAULT 0.00,
    consensus_score NUMERIC(3,2) DEFAULT 0.00,
    source_count INTEGER DEFAULT 0,

    -- ========== GRC-20 STATUS ==========

    ready_to_mint BOOLEAN DEFAULT FALSE,
    mint_blocking_reasons TEXT[],
    minted_at TIMESTAMP,
    grc20_entity_id UUID,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS grc20_corroboration_log (
    id SERIAL PRIMARY KEY,

    entity_type TEXT NOT NULL CHECK (entity_type IN ('artist', 'work')),
    entity_id INTEGER NOT NULL, -- References grc20_artists.id or grc20_works.id

    field_name TEXT NOT NULL,
    source TEXT NOT NULL,

    old_value TEXT,
    new_value TEXT,

    resolution_reason TEXT, -- e.g., 'MusicBrainz ISNI preferred over CISAC due to source priority'
    consensus_count INTEGER,
    conflict_detected BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Linking key indexes (for JOINs during population)
CREATE INDEX IF NOT EXISTS idx_grc20_artists_genius_id ON grc20_artists(genius_artist_id);
CREATE INDEX IF NOT EXISTS idx_grc20_artists_mbid ON grc20_artists(mbid);
CREATE INDEX IF NOT EXISTS idx_grc20_artists_spotify_id ON grc20_artists(spotify_artist_id);
CREATE INDEX IF NOT EXISTS idx_grc20_artists_isni ON grc20_artists(isni);
CREATE INDEX IF NOT EXISTS idx_grc20_artists_ipi ON grc20_artists(ipi);

CREATE INDEX IF NOT EXISTS idx_grc20_works_genius_id ON grc20_works(genius_song_id);
CREATE INDEX IF NOT EXISTS idx_grc20_works_spotify_id ON grc20_works(spotify_track_id);
CREATE INDEX IF NOT EXISTS idx_grc20_works_isrc ON grc20_works(isrc);
CREATE INDEX IF NOT EXISTS idx_grc20_works_iswc ON grc20_works(iswc);

-- JSONB GIN indexes for consensus queries
CREATE INDEX IF NOT EXISTS idx_artists_field_consensus ON grc20_artists USING GIN(field_consensus);
CREATE INDEX IF NOT EXISTS idx_artists_source_flags ON grc20_artists USING GIN(source_flags);
CREATE INDEX IF NOT EXISTS idx_works_field_consensus ON grc20_works USING GIN(field_consensus);
CREATE INDEX IF NOT EXISTS idx_works_source_flags ON grc20_works USING GIN(source_flags);

-- Quality/status indexes (for filtering ready-to-mint)
CREATE INDEX IF NOT EXISTS idx_artists_ready_to_mint ON grc20_artists(ready_to_mint) WHERE ready_to_mint = TRUE;
CREATE INDEX IF NOT EXISTS idx_artists_consensus_score ON grc20_artists(consensus_score);
CREATE INDEX IF NOT EXISTS idx_works_ready_to_mint ON grc20_works(ready_to_mint) WHERE ready_to_mint = TRUE;

-- Relationship indexes
CREATE INDEX IF NOT EXISTS idx_works_primary_artist ON grc20_works(primary_artist_id);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_log_entity ON grc20_corroboration_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_log_created_at ON grc20_corroboration_log(created_at);

-- ============================================================================
-- USEFUL VIEWS FOR QUERYING CONSENSUS
-- ============================================================================

-- View: Artists with high-consensus ISNI (confirmed in 3+ sources)
CREATE OR REPLACE VIEW high_consensus_isni_artists AS
SELECT
    id,
    name,
    isni,
    (field_consensus->'isni'->>'consensus_count')::INTEGER as isni_consensus_count,
    field_consensus->'isni'->'sources' as isni_sources,
    consensus_score,
    completeness_score
FROM grc20_artists
WHERE (field_consensus->'isni'->>'consensus_count')::INTEGER >= 3;

-- View: Artists ready to mint with quality breakdown
CREATE OR REPLACE VIEW mintable_artists_summary AS
SELECT
    id,
    name,
    ready_to_mint,
    completeness_score,
    consensus_score,
    source_count,
    external_id_count,
    social_link_count,
    mint_blocking_reasons,
    CASE
        WHEN image_source = 'fal' THEN '✅ Fal (Grove)'
        WHEN image_source = 'spotify' THEN '✅ Spotify'
        WHEN image_source = 'genius' THEN '✅ Genius'
        ELSE '❌ No image'
    END as image_status
FROM grc20_artists
ORDER BY ready_to_mint DESC, consensus_score DESC;

-- View: Works with ISRC consensus across industry sources
CREATE OR REPLACE VIEW isrc_consensus_works AS
SELECT
    id,
    title,
    isrc,
    (field_consensus->'isrc'->>'consensus_count')::INTEGER as isrc_consensus_count,
    field_consensus->'isrc'->'sources' as isrc_sources,
    source_flags,
    consensus_score
FROM grc20_works
WHERE isrc IS NOT NULL
ORDER BY (field_consensus->'isrc'->>'consensus_count')::INTEGER DESC;

-- View: Data quality dashboard
CREATE OR REPLACE VIEW data_quality_dashboard AS
SELECT
    'Artists' as entity_type,
    COUNT(*) as total_entities,
    COUNT(*) FILTER (WHERE ready_to_mint) as ready_to_mint,
    ROUND(AVG(completeness_score), 2) as avg_completeness,
    ROUND(AVG(consensus_score), 2) as avg_consensus,
    COUNT(*) FILTER (WHERE isni IS NOT NULL) as has_isni,
    COUNT(*) FILTER (WHERE mbid IS NOT NULL) as has_mbid,
    COUNT(*) FILTER (WHERE image_url IS NOT NULL) as has_image
FROM grc20_artists
UNION ALL
SELECT
    'Works' as entity_type,
    COUNT(*) as total_entities,
    COUNT(*) FILTER (WHERE ready_to_mint) as ready_to_mint,
    ROUND(AVG(completeness_score), 2) as avg_completeness,
    ROUND(AVG(consensus_score), 2) as avg_consensus,
    COUNT(*) FILTER (WHERE isrc IS NOT NULL) as has_isrc,
    COUNT(*) FILTER (WHERE iswc IS NOT NULL) as has_iswc,
    NULL as has_image
FROM grc20_works;

COMMENT ON TABLE grc20_artists IS 'Corroborated artist golden records merged from Genius, MusicBrainz, Spotify, and industry sources. Tracks per-field consensus and provenance.';
COMMENT ON TABLE grc20_works IS 'Corroborated work golden records with ISRC/ISWC consensus tracking across CISAC, BMI, MLC, Quansic.';
COMMENT ON TABLE grc20_corroboration_log IS 'Audit trail of field resolutions during corroboration ETL process.';
