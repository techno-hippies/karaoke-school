-- LRCLIB Corpus with Vector Embeddings
-- Purpose: Store 19M+ lyrics from LRCLIB with semantic search via pgvector
-- Embedding Model: google/embeddinggemma-300m (768 dimensions)
-- Provider: DeepInfra

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Main corpus table
CREATE TABLE IF NOT EXISTS lrclib_corpus (
  id SERIAL PRIMARY KEY,

  -- Original LRCLIB identifiers
  lrclib_track_id INTEGER UNIQUE NOT NULL,
  lrclib_lyrics_id INTEGER NOT NULL,

  -- Track metadata (normalized lowercase for matching)
  track_name TEXT NOT NULL,
  track_name_lower TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  artist_name_lower TEXT NOT NULL,
  album_name TEXT,
  album_name_lower TEXT,

  -- Audio metadata
  duration_seconds NUMERIC(10, 2),  -- 220.5 seconds

  -- Lyrics content
  plain_lyrics TEXT,
  synced_lyrics TEXT,  -- LRC format with timestamps

  -- Lyrics flags
  has_plain_lyrics BOOLEAN DEFAULT FALSE,
  has_synced_lyrics BOOLEAN DEFAULT FALSE,
  instrumental BOOLEAN DEFAULT FALSE,

  -- Source tracking
  lyrics_source TEXT,  -- 'lrclib', 'user-submitted', etc.

  -- Vector embedding (768 dimensions)
  lyrics_embedding vector(768),

  -- Embedding metadata
  embedding_model TEXT DEFAULT 'google/embeddinggemma-300m',
  embedding_generated_at TIMESTAMPTZ,

  -- Timestamps
  lrclib_created_at TIMESTAMPTZ,
  lrclib_updated_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CHECK (has_plain_lyrics OR has_synced_lyrics OR instrumental),
  CHECK (duration_seconds IS NULL OR duration_seconds > 0)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_lrclib_corpus_track_name_lower ON lrclib_corpus (track_name_lower);
CREATE INDEX IF NOT EXISTS idx_lrclib_corpus_artist_name_lower ON lrclib_corpus (artist_name_lower);
CREATE INDEX IF NOT EXISTS idx_lrclib_corpus_album_name_lower ON lrclib_corpus (album_name_lower);
CREATE INDEX IF NOT EXISTS idx_lrclib_corpus_duration ON lrclib_corpus (duration_seconds);
CREATE INDEX IF NOT EXISTS idx_lrclib_corpus_has_synced ON lrclib_corpus (has_synced_lyrics) WHERE has_synced_lyrics = TRUE;
CREATE INDEX IF NOT EXISTS idx_lrclib_corpus_instrumental ON lrclib_corpus (instrumental) WHERE instrumental = TRUE;
CREATE INDEX IF NOT EXISTS idx_lrclib_corpus_source ON lrclib_corpus (lyrics_source);

-- Vector similarity index (HNSW for fast approximate nearest neighbor)
-- Using cosine distance (most common for text embeddings)
CREATE INDEX IF NOT EXISTS idx_lrclib_corpus_embedding_cosine ON lrclib_corpus
  USING hnsw (lyrics_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Alternative: Inner product index (if embeddings are normalized)
CREATE INDEX IF NOT EXISTS idx_lrclib_corpus_embedding_ip ON lrclib_corpus
  USING hnsw (lyrics_embedding vector_ip_ops)
  WITH (m = 16, ef_construction = 64);

-- Composite index for track matching (name + artist + duration)
CREATE INDEX IF NOT EXISTS idx_lrclib_corpus_track_match ON lrclib_corpus
  (track_name_lower, artist_name_lower, duration_seconds);

-- Index for pending embeddings
CREATE INDEX IF NOT EXISTS idx_lrclib_corpus_pending_embeddings ON lrclib_corpus (id)
  WHERE lyrics_embedding IS NULL AND has_plain_lyrics = TRUE;

-- Full-text search index (for non-vector queries)
CREATE INDEX IF NOT EXISTS idx_lrclib_corpus_lyrics_fts ON lrclib_corpus
  USING gin(to_tsvector('english', plain_lyrics))
  WHERE plain_lyrics IS NOT NULL;

-- Track matching function (fuzzy match with duration tolerance)
CREATE OR REPLACE FUNCTION match_lrclib_track(
  p_track_name TEXT,
  p_artist_name TEXT,
  p_duration_seconds NUMERIC DEFAULT NULL,
  p_duration_tolerance_seconds NUMERIC DEFAULT 2.0
)
RETURNS TABLE (
  id INTEGER,
  track_name TEXT,
  artist_name TEXT,
  album_name TEXT,
  duration_seconds NUMERIC,
  has_synced_lyrics BOOLEAN,
  match_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lc.id,
    lc.track_name,
    lc.artist_name,
    lc.album_name,
    lc.duration_seconds,
    lc.has_synced_lyrics,
    CASE
      -- Exact match
      WHEN lc.track_name_lower = LOWER(p_track_name)
        AND lc.artist_name_lower = LOWER(p_artist_name)
        AND (p_duration_seconds IS NULL
          OR ABS(lc.duration_seconds - p_duration_seconds) <= p_duration_tolerance_seconds)
      THEN 1.0
      -- Close match
      WHEN lc.track_name_lower LIKE '%' || LOWER(p_track_name) || '%'
        AND lc.artist_name_lower LIKE '%' || LOWER(p_artist_name) || '%'
      THEN 0.8
      -- Partial match
      ELSE 0.5
    END AS match_score
  FROM lrclib_corpus lc
  WHERE
    lc.track_name_lower ILIKE '%' || LOWER(p_track_name) || '%'
    AND lc.artist_name_lower ILIKE '%' || LOWER(p_artist_name) || '%'
    AND (p_duration_seconds IS NULL
      OR ABS(lc.duration_seconds - p_duration_seconds) <= p_duration_tolerance_seconds * 2)
  ORDER BY match_score DESC, lc.has_synced_lyrics DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;

-- Vector similarity search function
CREATE OR REPLACE FUNCTION search_similar_lyrics(
  p_query_embedding vector(768),
  p_limit INTEGER DEFAULT 10,
  p_min_similarity NUMERIC DEFAULT 0.7
)
RETURNS TABLE (
  id INTEGER,
  track_name TEXT,
  artist_name TEXT,
  plain_lyrics TEXT,
  similarity NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lc.id,
    lc.track_name,
    lc.artist_name,
    lc.plain_lyrics,
    1 - (lc.lyrics_embedding <=> p_query_embedding) AS similarity
  FROM lrclib_corpus lc
  WHERE
    lc.lyrics_embedding IS NOT NULL
    AND 1 - (lc.lyrics_embedding <=> p_query_embedding) >= p_min_similarity
  ORDER BY lc.lyrics_embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Statistics view
CREATE OR REPLACE VIEW lrclib_corpus_stats AS
SELECT
  COUNT(*) as total_tracks,
  COUNT(*) FILTER (WHERE has_plain_lyrics) as with_plain_lyrics,
  COUNT(*) FILTER (WHERE has_synced_lyrics) as with_synced_lyrics,
  COUNT(*) FILTER (WHERE instrumental) as instrumental_tracks,
  COUNT(*) FILTER (WHERE lyrics_embedding IS NOT NULL) as with_embeddings,
  COUNT(*) FILTER (WHERE lyrics_embedding IS NULL AND has_plain_lyrics) as pending_embeddings,
  ROUND(AVG(duration_seconds), 2) as avg_duration_seconds,
  COUNT(DISTINCT artist_name_lower) as unique_artists,
  COUNT(DISTINCT album_name_lower) as unique_albums,
  MIN(imported_at) as first_import,
  MAX(imported_at) as last_import
FROM lrclib_corpus;

-- Comment on table
COMMENT ON TABLE lrclib_corpus IS 'LRCLIB lyrics corpus with vector embeddings for semantic search. Source: https://lrclib.net/';
COMMENT ON COLUMN lrclib_corpus.lyrics_embedding IS 'DeepInfra embeddinggemma-300m (768 dims) for semantic similarity search';
COMMENT ON COLUMN lrclib_corpus.synced_lyrics IS 'LRC format: [mm:ss.xx] lyrics with word-level timestamps';
COMMENT ON INDEX idx_lrclib_corpus_embedding_cosine IS 'HNSW index for fast cosine similarity search (recommended for normalized embeddings)';
COMMENT ON INDEX idx_lrclib_corpus_embedding_ip IS 'HNSW index for inner product similarity (alternative metric)';
