-- Migration 017: Create wikidata_artists table
-- Purpose: Store Wikidata enrichment for international library IDs and identifiers

CREATE TABLE IF NOT EXISTS wikidata_artists (
  wikidata_id TEXT PRIMARY KEY,  -- e.g., 'Q29564107'
  spotify_artist_id TEXT REFERENCES spotify_artists(spotify_artist_id),

  -- International Library IDs (PRIMARY FOCUS)
  viaf_id TEXT,                  -- Virtual International Authority File
  gnd_id TEXT,                   -- German National Library (Deutsche Nationalbibliothek)
  bnf_id TEXT,                   -- French National Library (Bibliothèque nationale de France)
  loc_id TEXT,                   -- Library of Congress
  sbn_id TEXT,                   -- Italian National Library (Servizio Bibliotecario Nazionale)
  bnmm_id TEXT,                  -- Spanish National Library (Biblioteca Nacional de España)
  selibr_id TEXT,                -- Swedish National Library (Kungliga biblioteket)

  -- Labels (names in different languages)
  labels JSONB,                  -- {"en": "Billie Eilish", "zh": "比莉·艾利什", "ja": "ビリー・アイリッシュ", ...}

  -- Aliases (alternate names by language)
  aliases JSONB,                 -- {"en": ["Billie Eilish O'Connell", "Billie Eilish Pirate Baird O'Connell"], ...}

  -- Other identifiers (stored as JSONB for flexibility)
  identifiers JSONB,             -- {
    -- "musicbrainz": "f4abc0b5-3f7a-4eff-8f78-ac078dbce533",
    -- "discogs": ["5590213", "6502756"],
    -- "allmusic": "mn0003475903",
    -- "imdb": "nm8483808",
    -- "twitter": "billieeilish",
    -- "instagram": "billieeilish",
    -- "youtube": "UCiGm_E4ZwYSHV3bcW1pnSeQ",
    -- "tiktok": "billieeilish",
    -- "soundcloud": "billieeilish",
    -- "weibo": "1065981054",
    -- "vk": "...",
    -- ... and more
  -- }

  -- Sitelinks (Wikipedia pages)
  sitelinks JSONB,               -- {"enwiki": "Billie_Eilish", "zhwiki": "比莉·艾利什", ...}

  enriched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wikidata_artists_spotify ON wikidata_artists(spotify_artist_id);
CREATE INDEX IF NOT EXISTS idx_wikidata_artists_viaf ON wikidata_artists(viaf_id) WHERE viaf_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wikidata_artists_gnd ON wikidata_artists(gnd_id) WHERE gnd_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wikidata_artists_loc ON wikidata_artists(loc_id) WHERE loc_id IS NOT NULL;

COMMENT ON TABLE wikidata_artists IS 'Wikidata enrichment for artists. Focus: international library IDs (VIAF, GND, BNF, LOC, etc.) and cross-platform identifiers.';
COMMENT ON COLUMN wikidata_artists.viaf_id IS 'Virtual International Authority File - global library identifier';
COMMENT ON COLUMN wikidata_artists.gnd_id IS 'German National Library (Deutsche Nationalbibliothek) identifier';
COMMENT ON COLUMN wikidata_artists.bnf_id IS 'French National Library (Bibliothèque nationale de France) identifier';
COMMENT ON COLUMN wikidata_artists.loc_id IS 'Library of Congress authority identifier';
COMMENT ON COLUMN wikidata_artists.sbn_id IS 'Italian National Library identifier';
COMMENT ON COLUMN wikidata_artists.bnmm_id IS 'Spanish National Library identifier';
COMMENT ON COLUMN wikidata_artists.selibr_id IS 'Swedish National Library identifier';
COMMENT ON COLUMN wikidata_artists.identifiers IS 'Other identifiers: musicbrainz, discogs, allmusic, social media handles, etc. Stored as JSONB for flexibility.';
