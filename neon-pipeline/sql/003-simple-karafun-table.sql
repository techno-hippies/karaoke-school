-- Simple Karafun import table
-- Just get the data in, forget the complex normalization for now

DROP TABLE IF EXISTS karafun_songs CASCADE;

CREATE TABLE karafun_songs (
  karafun_id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  year INTEGER,
  is_duo BOOLEAN DEFAULT false,
  is_explicit BOOLEAN DEFAULT false,
  date_added DATE NOT NULL,
  styles TEXT,  -- CSV will be parsed later
  languages TEXT,  -- CSV will be parsed later
  popularity_score INTEGER GENERATED ALWAYS AS (100000 - karafun_id) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_karafun_artist ON karafun_songs(artist);
CREATE INDEX idx_karafun_title ON karafun_songs(title);
CREATE INDEX idx_karafun_popularity ON karafun_songs(popularity_score DESC);
CREATE INDEX idx_karafun_year ON karafun_songs(year) WHERE year IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER karafun_songs_updated_at
  BEFORE UPDATE ON karafun_songs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
