-- ========================================
-- KARAOKE SCHOOL - NEON DB SCHEMA
-- Catalog-first approach with MusicBrainz-inspired design
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- 1. ARTISTS TABLE
-- MusicBrainz-inspired with blockchain integration
-- ========================================
CREATE TABLE artists (
  -- PRIMARY IDENTIFIERS
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Canonical identifiers (Tier 1)
  mbid UUID UNIQUE,                              -- MusicBrainz Artist ID
  isnis TEXT[],                                  -- ["0000 0003 5635 8936"]
  ipi TEXT,                                      -- 11-digit IPI number

  -- External database IDs (Tier 2)
  genius_id INTEGER UNIQUE,
  spotify_id TEXT UNIQUE,
  discogs_ids TEXT[],
  wikidata_id TEXT,
  allmusic_id TEXT,

  -- Streaming platform IDs
  apple_music_id TEXT,
  tidal_id TEXT,
  deezer_id TEXT,

  -- Social/Video IDs
  youtube_channels TEXT[],
  tiktok_id TEXT,
  instagram_id TEXT,
  bandcamp TEXT,

  -- NAMES & METADATA
  name TEXT NOT NULL,
  sort_name TEXT NOT NULL,
  legal_name TEXT,
  disambiguation TEXT,
  name_variants JSONB,                           -- [{name, locale, type, primary}]

  -- Artist type
  type TEXT CHECK (type IN ('Person', 'Group', 'Orchestra', 'Choir', 'Character', 'Other')),
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other', 'Not applicable')),
  country CHAR(2),

  -- Dates (YYYY, YYYY-MM, or YYYY-MM-DD)
  birth_date TEXT,
  death_date TEXT,
  active BOOLEAN,

  -- GENRES & TAGS
  genres JSONB,                                  -- [{name, normalized, sources}]
  tags JSONB,

  -- BLOCKCHAIN/LENS INTEGRATION
  lens_account_address TEXT UNIQUE,
  pkp_address TEXT UNIQUE,
  lens_username TEXT UNIQUE,
  grove_metadata_uri TEXT,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,

  -- PROFILE
  bio TEXT,
  avatar_uri TEXT,
  cover_uri TEXT,
  external_urls JSONB,

  -- VALIDATION
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  sources JSONB,                                 -- {musicbrainz, genius, spotify}
  validation_flags JSONB,
  validation_warnings TEXT[],

  -- TIMESTAMPS
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  minted_at TIMESTAMPTZ
);

-- Indexes for artists
CREATE INDEX idx_artists_mbid ON artists(mbid);
CREATE INDEX idx_artists_genius ON artists(genius_id);
CREATE INDEX idx_artists_spotify ON artists(spotify_id);
CREATE INDEX idx_artists_lens ON artists(lens_username);
CREATE INDEX idx_artists_isnis ON artists USING GIN(isnis);
CREATE INDEX idx_artists_name ON artists(name);
CREATE INDEX idx_artists_sort_name ON artists(sort_name);
CREATE INDEX idx_artists_type ON artists(type);

-- ========================================
-- 2. WORKS TABLE
-- Musical compositions (ISWC canonical)
-- ========================================
CREATE TABLE works (
  -- PRIMARY IDENTIFIERS
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  iswc TEXT UNIQUE,                              -- T1234567890 (normalized)
  mbid UUID UNIQUE,

  -- BASIC INFO
  title TEXT NOT NULL,
  disambiguation TEXT,
  type TEXT CHECK (type IN ('Song', 'Instrumental', 'Musical', 'Opera', 'Ballet', 'Soundtrack', 'Other')),
  title_variants JSONB,

  -- COMPOSERS/WRITERS
  composers JSONB,                               -- [{name, mbid, ipi, role, society}]

  -- PRO REGISTRATIONS
  pro_registrations JSONB,                       -- [{society, workCode, territory}]

  -- METADATA
  language TEXT,
  duration_ms INTEGER,
  recording_count INTEGER DEFAULT 0,

  -- VALIDATION
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  sources JSONB,
  quality_score INTEGER CHECK (quality_score BETWEEN 0 AND 100),
  external_references JSONB,
  notes JSONB,
  warnings TEXT[],

  -- TIMESTAMPS
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  minted_at TIMESTAMPTZ
);

-- Indexes for works
CREATE INDEX idx_works_iswc ON works(iswc);
CREATE INDEX idx_works_mbid ON works(mbid);
CREATE INDEX idx_works_title ON works(title);
CREATE INDEX idx_works_language ON works(language);
CREATE INDEX idx_works_composers ON works USING GIN(composers);

-- ========================================
-- 3. RECORDINGS TABLE
-- Specific performances of works
-- ========================================
CREATE TABLE recordings (
  -- PRIMARY IDENTIFIERS
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relationships
  work_id UUID REFERENCES works(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,

  -- Canonical identifiers
  mbid UUID UNIQUE,
  isrc TEXT UNIQUE,

  -- External IDs
  genius_id INTEGER UNIQUE,
  spotify_id TEXT UNIQUE,
  tiktok_music_id TEXT,
  apple_music_id TEXT,
  tidal_id TEXT,
  youtube_video_id TEXT,

  -- AUDIO METADATA
  title TEXT NOT NULL,
  album TEXT,
  year INTEGER,
  duration_seconds INTEGER,
  duration_ms INTEGER,

  -- Media URIs
  cover_uri TEXT,
  grove_metadata_uri TEXT,

  -- MLC LICENSING
  mlc_data JSONB,                                -- {publishers, writers, isrc}
  copyright_free BOOLEAN DEFAULT FALSE,
  mechanically_licensed BOOLEAN DEFAULT FALSE,

  -- LOCAL FILE TRACKING
  local_file_path TEXT,
  local_file_hash TEXT,
  file_format TEXT,
  file_size_bytes BIGINT,
  file_bitrate_kbps INTEGER,
  file_sample_rate_hz INTEGER,

  -- LYRICS
  has_synced_lyrics BOOLEAN DEFAULT FALSE,
  lrclib_id INTEGER,
  lyrics_plain TEXT,
  lyrics_synced JSONB,
  lyrics_source TEXT,

  -- PROCESSING STATUS
  processed BOOLEAN DEFAULT FALSE,
  enriched BOOLEAN DEFAULT FALSE,
  has_local_file BOOLEAN DEFAULT FALSE,
  processing_steps JSONB,

  -- KARAOKE POPULARITY (DERIVED from karaoke_sources)
  is_karaoke_popular BOOLEAN DEFAULT FALSE,
  karaoke_popularity_score INTEGER,

  -- VALIDATION
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  sources JSONB,

  -- TIMESTAMPS
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_processed_at TIMESTAMPTZ
);

-- Indexes for recordings
CREATE INDEX idx_recordings_work ON recordings(work_id);
CREATE INDEX idx_recordings_artist ON recordings(artist_id);
CREATE INDEX idx_recordings_mbid ON recordings(mbid);
CREATE INDEX idx_recordings_genius ON recordings(genius_id);
CREATE INDEX idx_recordings_spotify ON recordings(spotify_id);
CREATE INDEX idx_recordings_local_path ON recordings(local_file_path);
CREATE INDEX idx_recordings_isrc ON recordings(isrc);
CREATE INDEX idx_recordings_processed ON recordings(processed);
CREATE INDEX idx_recordings_has_local ON recordings(has_local_file);
CREATE INDEX idx_recordings_karaoke_popular ON recordings(is_karaoke_popular);
CREATE INDEX idx_recordings_title ON recordings(title);

-- ========================================
-- 4. SEGMENTS TABLE
-- Karaoke clips from recordings
-- ========================================
CREATE TABLE segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE,

  -- TikTok source
  tiktok_music_id TEXT,
  tiktok_url TEXT,
  tiktok_video_count INTEGER,

  -- Timing
  start_time_seconds DECIMAL(10,3),
  end_time_seconds DECIMAL(10,3),
  duration_seconds DECIMAL(10,3),

  -- Processed media URIs (Grove)
  vocals_uri TEXT,
  instrumental_uri TEXT,
  alignment_uri TEXT,
  cover_uri TEXT,
  grove_metadata_uri TEXT,

  -- Story Protocol
  story_ip_asset_id TEXT,
  story_tx_hash TEXT,
  story_metadata_uri TEXT,
  story_license_terms_ids TEXT[],
  story_royalty_vault TEXT,

  -- Processing
  processed BOOLEAN DEFAULT FALSE,
  processing_steps JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes for segments
CREATE INDEX idx_segments_recording ON segments(recording_id);
CREATE INDEX idx_segments_tiktok ON segments(tiktok_music_id);
CREATE INDEX idx_segments_processed ON segments(processed);

-- ========================================
-- 5. KARAOKE SOURCES TABLE
-- Vendor-specific karaoke catalog data
-- ========================================
CREATE TABLE karaoke_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE,

  -- Source identification
  source TEXT NOT NULL CHECK (source IN ('karafun', 'singking', 'smule', 'lucky_voice', 'manual')),
  source_song_id TEXT NOT NULL,

  -- Source-specific metadata (flexible JSONB)
  metadata JSONB,                                -- {styles, languages, is_duo, is_explicit}

  -- Popularity signals
  popularity_rank INTEGER,
  date_added DATE,

  -- Source reliability weight
  confidence_weight DECIMAL(3,2) DEFAULT 1.0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source, source_song_id)
);

-- Indexes for karaoke_sources
CREATE INDEX idx_karaoke_sources_recording ON karaoke_sources(recording_id);
CREATE INDEX idx_karaoke_sources_source ON karaoke_sources(source);
CREATE INDEX idx_karaoke_sources_rank ON karaoke_sources(popularity_rank);
CREATE INDEX idx_karaoke_sources_metadata ON karaoke_sources USING GIN(metadata);

-- ========================================
-- 6. TIKTOK SCRAPES TABLE
-- Track TikTok scraping progress
-- ========================================
CREATE TABLE tiktok_scrapes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recording_id UUID REFERENCES recordings(id),

  -- Search metadata
  tiktok_music_id TEXT NOT NULL,
  search_query TEXT,
  video_count INTEGER,

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scraping', 'scraped', 'processed', 'failed')),
  videos_downloaded INTEGER DEFAULT 0,

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  scraped_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ
);

-- Indexes for tiktok_scrapes
CREATE INDEX idx_tiktok_scrapes_recording ON tiktok_scrapes(recording_id);
CREATE INDEX idx_tiktok_scrapes_status ON tiktok_scrapes(status);
CREATE INDEX idx_tiktok_scrapes_music_id ON tiktok_scrapes(tiktok_music_id);

-- ========================================
-- TRIGGERS for updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_artists_updated_at BEFORE UPDATE ON artists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_works_updated_at BEFORE UPDATE ON works
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recordings_updated_at BEFORE UPDATE ON recordings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_segments_updated_at BEFORE UPDATE ON segments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_karaoke_sources_updated_at BEFORE UPDATE ON karaoke_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tiktok_scrapes_updated_at BEFORE UPDATE ON tiktok_scrapes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
