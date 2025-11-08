-- Add granular enrichment tracking to song_pipeline
-- This prevents re-processing and allows independent enrichment step execution

ALTER TABLE song_pipeline
  ADD COLUMN IF NOT EXISTS has_musicbrainz BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_genius_artists BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_genius_songs BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_quansic_artists BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_wikidata_works BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_wikidata_artists BOOLEAN DEFAULT FALSE;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_song_pipeline_musicbrainz ON song_pipeline(has_musicbrainz) WHERE has_musicbrainz = FALSE;
CREATE INDEX IF NOT EXISTS idx_song_pipeline_genius_artists ON song_pipeline(has_genius_artists) WHERE has_genius_artists = FALSE;
CREATE INDEX IF NOT EXISTS idx_song_pipeline_genius_songs ON song_pipeline(has_genius_songs) WHERE has_genius_songs = FALSE;
CREATE INDEX IF NOT EXISTS idx_song_pipeline_quansic_artists ON song_pipeline(has_quansic_artists) WHERE has_quansic_artists = FALSE;
CREATE INDEX IF NOT EXISTS idx_song_pipeline_wikidata_works ON song_pipeline(has_wikidata_works) WHERE has_wikidata_works = FALSE;
CREATE INDEX IF NOT EXISTS idx_song_pipeline_wikidata_artists ON song_pipeline(has_wikidata_artists) WHERE has_wikidata_artists = FALSE;

COMMENT ON COLUMN song_pipeline.has_musicbrainz IS 'Track has been enriched with MusicBrainz works/recordings';
COMMENT ON COLUMN song_pipeline.has_genius_artists IS 'Primary artist has been fetched from Genius API';
COMMENT ON COLUMN song_pipeline.has_genius_songs IS 'Song has been matched and enriched from Genius API';
COMMENT ON COLUMN song_pipeline.has_quansic_artists IS 'Artists have been enriched with Quansic ISNI/IPI data';
COMMENT ON COLUMN song_pipeline.has_wikidata_works IS 'Work has been enriched with Wikidata identifiers';
COMMENT ON COLUMN song_pipeline.has_wikidata_artists IS 'Artists have been enriched with Wikidata library IDs';
