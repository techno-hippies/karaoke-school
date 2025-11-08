-- Migration 013: Create grc20_artists pre-mint table
-- Purpose: Aggregate artist data from multiple sources for GRC-20 minting
-- Sources: spotify_artists, genius_artists, musicbrainz_artists, quansic_recordings

CREATE TABLE IF NOT EXISTS grc20_artists (
  id SERIAL PRIMARY KEY,

  -- Basic Info
  name TEXT NOT NULL,
  sort_name TEXT,
  alternate_names TEXT,                  -- Comma-separated: "Name1, Name2, Name3"
  disambiguation TEXT,

  -- Industry Identifiers (Primary)
  isni TEXT,                             -- Primary ISNI: "0000000372879707"
  isni_all TEXT,                         -- All ISNIs: "0000000372879707, 0000000433817666"
  ipi_all TEXT,                          -- All IPIs: "00673691508, 00673691704"
  mbid TEXT,                             -- MusicBrainz ID (UUID)

  -- Platform IDs
  spotify_artist_id TEXT UNIQUE,
  genius_artist_id INTEGER UNIQUE,
  discogs_id TEXT,

  -- Biographical
  artist_type TEXT,                      -- 'Person', 'Group', 'Orchestra', 'Choir', etc.
  gender TEXT,                           -- 'Male', 'Female', 'Other', 'Non-Binary'
  birth_date DATE,
  death_date DATE,
  country TEXT,                          -- ISO 3166-1 alpha-2 code

  -- Musical Info
  genres TEXT,                           -- Comma-separated: "pop, rock, electronic"

  -- Verification Status (NOT follower counts - immutable only)
  is_verified BOOLEAN DEFAULT FALSE,     -- Genius verification status

  -- Social Media (Primary Handles)
  instagram_handle TEXT,
  twitter_handle TEXT,
  facebook_handle TEXT,
  tiktok_handle TEXT,
  youtube_channel TEXT,
  soundcloud_handle TEXT,

  -- Social Media URLs (Full URLs)
  instagram_url TEXT,
  twitter_url TEXT,
  facebook_url TEXT,
  tiktok_url TEXT,
  pinterest_url TEXT,
  google_plus_url TEXT,
  reverbnation_url TEXT,

  -- Streaming Platform URLs
  spotify_url TEXT,
  deezer_url TEXT,
  tidal_url TEXT,
  apple_music_url TEXT,
  amazon_music_url TEXT,
  youtube_music_url TEXT,
  napster_url TEXT,
  yandex_music_url TEXT,
  boomplay_url TEXT,

  -- Music Service URLs
  soundcloud_url TEXT,
  bandcamp_url TEXT,
  myspace_url TEXT,
  purevolume_url TEXT,

  -- Database & Reference URLs
  wikidata_url TEXT,
  viaf_url TEXT,
  imdb_url TEXT,
  allmusic_url TEXT,
  discogs_url TEXT,
  songkick_url TEXT,
  bandsintown_url TEXT,
  setlistfm_url TEXT,
  secondhandsongs_url TEXT,

  -- Lyrics & Info Sites
  genius_url TEXT,
  lastfm_url TEXT,
  musixmatch_url TEXT,

  -- Video Platforms
  youtube_url TEXT,
  vimeo_url TEXT,
  imvdb_url TEXT,                        -- Internet Music Video Database

  -- Library & Catalog URLs
  loc_url TEXT,                          -- Library of Congress
  bnf_url TEXT,                          -- Bibliothèque nationale de France
  dnb_url TEXT,                          -- Deutsche Nationalbibliothek
  worldcat_url TEXT,
  openlibrary_url TEXT,

  -- Specialized Databases
  rateyourmusic_url TEXT,
  whosampled_url TEXT,
  jaxsta_url TEXT,
  snac_url TEXT,                         -- Social Networks and Archival Context
  ibdb_url TEXT,                         -- Internet Broadway Database
  goodreads_url TEXT,
  librarything_url TEXT,
  themoviedb_url TEXT,

  -- Purchase & Download Sites
  beatport_url TEXT,
  junodownload_url TEXT,
  itunes_url TEXT,
  qobuz_url TEXT,
  bandsintown_url_alt TEXT,

  -- Regional/Niche Sites
  maniadb_url TEXT,                      -- Korean music database
  melon_url TEXT,                        -- Korean streaming
  mora_url TEXT,                         -- Japanese downloads
  cdjapan_url TEXT,
  livefans_url TEXT,                     -- Japanese concert database
  vgmdb_url TEXT,                        -- Video Game Music Database

  -- Other URLs
  official_website TEXT,
  blog_url TEXT,
  bbc_music_url TEXT,
  musicmoz_url TEXT,
  musik_sammler_url TEXT,
  muziekweb_url TEXT,
  spirit_of_rock_url TEXT,

  -- Image URLs
  image_url TEXT,
  header_image_url TEXT,
  image_source TEXT,                     -- 'fal' | 'spotify' | 'genius' | 'musicbrainz'

  -- Minting State (Minimal)
  grc20_entity_id UUID UNIQUE,           -- Set after minting to GRC-20
  minted_at TIMESTAMP,
  last_edit_cid TEXT,                    -- IPFS CID of last GRC-20 edit (for debugging)
  needs_update BOOLEAN DEFAULT FALSE,    -- Flag when source data changes

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_grc20_artists_isni ON grc20_artists(isni);
CREATE INDEX IF NOT EXISTS idx_grc20_artists_spotify ON grc20_artists(spotify_artist_id);
CREATE INDEX IF NOT EXISTS idx_grc20_artists_genius ON grc20_artists(genius_artist_id);
CREATE INDEX IF NOT EXISTS idx_grc20_artists_mbid ON grc20_artists(mbid);
CREATE INDEX IF NOT EXISTS idx_grc20_artists_entity_id ON grc20_artists(grc20_entity_id);
CREATE INDEX IF NOT EXISTS idx_grc20_artists_needs_update ON grc20_artists(needs_update) WHERE needs_update = TRUE;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_grc20_artists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_grc20_artists_updated_at
  BEFORE UPDATE ON grc20_artists
  FOR EACH ROW
  EXECUTE FUNCTION update_grc20_artists_updated_at();

COMMENT ON TABLE grc20_artists IS 'Pre-mint aggregation table for GRC-20 artist entities. Combines data from Spotify, Genius, MusicBrainz, and Quansic. All arrays stored as comma-separated TEXT for GRC-20 compatibility.';
COMMENT ON COLUMN grc20_artists.isni IS 'Primary ISNI (International Standard Name Identifier)';
COMMENT ON COLUMN grc20_artists.isni_all IS 'All ISNIs as comma-separated string';
COMMENT ON COLUMN grc20_artists.ipi_all IS 'All IPIs (Interested Party Information) as comma-separated string';
COMMENT ON COLUMN grc20_artists.grc20_entity_id IS 'UUID of minted GRC-20 entity. NULL until minted.';
COMMENT ON COLUMN grc20_artists.last_edit_cid IS 'IPFS CID of last GRC-20 edit operation (for debugging only, query GRC-20 API for full history)';
COMMENT ON COLUMN grc20_artists.needs_update IS 'Flag indicating source data changed since last mint. Triggers re-minting via GRC-20 Edit operation.';
