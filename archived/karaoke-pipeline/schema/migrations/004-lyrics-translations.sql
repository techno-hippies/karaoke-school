-- Lyrics Translations Table
-- Multi-language translations with word-level timing preserved from ElevenLabs alignment

CREATE TABLE IF NOT EXISTS lyrics_translations (
  id SERIAL PRIMARY KEY,
  spotify_track_id TEXT NOT NULL REFERENCES spotify_tracks(spotify_track_id) ON DELETE CASCADE,
  language_code TEXT NOT NULL CHECK (length(language_code) = 2),  -- ISO 639-1 (es, zh, ja, ko, etc.)

  -- Line-level translation WITH word timing preserved
  -- Structure: [{
  --   lineIndex: 0,
  --   originalText: "Someone said they left together",
  --   translatedText: "有人说他们已双双离去",
  --   start: 25.42,
  --   end: 29.119,
  --   words: [{text: "Someone", start: 25.42, end: 26.299}, ...],
  --   translatedWords: [{text: "有人", start: 25.42, end: 26.299}, ...]  -- Approximated timing
  -- }]
  lines JSONB NOT NULL,

  -- Grove storage (uploaded AFTER translation)
  grove_cid TEXT,
  grove_url TEXT,

  -- Translation metadata
  translation_source TEXT NOT NULL DEFAULT 'gemini-flash-2.5-lite',  -- AI model used
  confidence_score NUMERIC(3,2),                                 -- 0.00 to 1.00

  -- Source language (from song_lyrics.language_data)
  source_language_code TEXT,  -- 'en', 'ko', etc.
  source_language_data JSONB, -- Mixed language breakdown if applicable

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(spotify_track_id, language_code)
);

-- Indexes
CREATE INDEX idx_lyrics_translations_track
  ON lyrics_translations(spotify_track_id);

CREATE INDEX idx_lyrics_translations_language
  ON lyrics_translations(language_code);

CREATE INDEX idx_lyrics_translations_grove
  ON lyrics_translations(grove_cid) WHERE grove_cid IS NOT NULL;

CREATE INDEX idx_lyrics_translations_confidence
  ON lyrics_translations(confidence_score DESC) WHERE confidence_score IS NOT NULL;

-- Trigger to update updated_at
CREATE TRIGGER lyrics_translations_update
  BEFORE UPDATE ON lyrics_translations
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- View for translation coverage monitoring
CREATE OR REPLACE VIEW translation_coverage_summary AS
SELECT
  language_code,
  COUNT(*) as total_translations,
  ROUND(AVG(confidence_score), 2) as avg_confidence,
  COUNT(*) FILTER (WHERE grove_cid IS NOT NULL) as stored_on_grove,
  COUNT(DISTINCT spotify_track_id) as unique_tracks
FROM lyrics_translations
GROUP BY language_code
ORDER BY total_translations DESC;

-- View for tracks ready for TranslationEvents.sol
CREATE OR REPLACE VIEW translations_ready_to_mint AS
SELECT
  lt.spotify_track_id,
  st.title,
  st.artists,
  JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'language_code', lt.language_code,
      'grove_cid', lt.grove_cid,
      'grove_url', lt.grove_url,
      'confidence_score', lt.confidence_score,
    )
  ) as translations
FROM lyrics_translations lt
JOIN spotify_tracks st ON lt.spotify_track_id = st.spotify_track_id
WHERE lt.grove_cid IS NOT NULL  -- Must be uploaded to Grove
GROUP BY lt.spotify_track_id, st.title, st.artists
HAVING COUNT(*) >= 3;  -- At least 3 languages translated
