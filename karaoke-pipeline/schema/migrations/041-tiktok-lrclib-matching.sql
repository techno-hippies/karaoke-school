-- Migration 041: TikTok Video LRCLib Matching
--
-- Adds STT transcription and LRCLib similarity matching to TikTok videos.
-- This enables automatic song identification from TikTok clips via lyrics matching.

-- Add STT and embedding columns to tiktok_scraped_videos
ALTER TABLE tiktok_scraped_videos
  -- Voxtral STT output
  ADD COLUMN voxtral_stt_text TEXT,
  ADD COLUMN voxtral_stt_confidence NUMERIC(3,2),  -- 0.00-1.00

  -- EmbeddingGemma embedding (768-dim)
  ADD COLUMN stt_embedding vector(768),

  -- LRCLib matches (top-5 stored as JSONB)
  ADD COLUMN lrclib_matches JSONB,

  -- Best match (for quick filtering)
  ADD COLUMN best_lrclib_match_id INTEGER REFERENCES lrclib_lyrics(id),
  ADD COLUMN best_match_score NUMERIC(3,2),  -- 0.00-1.00

  -- Processing timestamps
  ADD COLUMN stt_computed_at TIMESTAMPTZ,
  ADD COLUMN lrclib_matched_at TIMESTAMPTZ;

-- HNSW index for similarity search on TikTok embeddings
CREATE INDEX idx_tiktok_stt_embedding ON tiktok_scraped_videos
  USING hnsw (stt_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Standard indexes for filtering
CREATE INDEX idx_tiktok_best_match ON tiktok_scraped_videos(best_lrclib_match_id)
  WHERE best_lrclib_match_id IS NOT NULL;

CREATE INDEX idx_tiktok_match_score ON tiktok_scraped_videos(best_match_score)
  WHERE best_match_score IS NOT NULL;

CREATE INDEX idx_tiktok_stt_computed ON tiktok_scraped_videos(stt_computed_at)
  WHERE stt_computed_at IS NOT NULL;

-- GIN index for JSONB queries on lrclib_matches
CREATE INDEX idx_tiktok_lrclib_matches ON tiktok_scraped_videos
  USING gin(lrclib_matches);

-- View: TikTok videos with high-confidence LRCLib matches
CREATE OR REPLACE VIEW tiktok_videos_matched AS
SELECT
  tsv.video_id,
  tsv.tiktok_handle,
  tsv.voxtral_stt_text,
  tsv.best_match_score,

  ll.track_name,
  ll.artist_name,
  ll.album_name,
  ll.grc20_work_id,
  ll.spotify_track_id,

  tsv.play_count,
  tsv.like_count,
  tsv.copyright_status
FROM tiktok_scraped_videos tsv
JOIN lrclib_lyrics ll ON ll.id = tsv.best_lrclib_match_id
WHERE tsv.best_match_score >= 0.75  -- High confidence threshold
ORDER BY tsv.best_match_score DESC;

-- Function: Find similar TikTok videos for a given clip
CREATE OR REPLACE FUNCTION find_similar_tiktok_videos(
  input_embedding vector(768),
  limit_count INTEGER DEFAULT 10,
  min_score NUMERIC DEFAULT 0.70
)
RETURNS TABLE (
  video_id TEXT,
  similarity_score NUMERIC,
  track_name TEXT,
  artist_name TEXT,
  stt_text TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tsv.video_id,
    (1 - (tsv.stt_embedding <=> input_embedding))::NUMERIC(3,2) AS similarity_score,
    ll.track_name,
    ll.artist_name,
    tsv.voxtral_stt_text
  FROM tiktok_scraped_videos tsv
  LEFT JOIN lrclib_lyrics ll ON ll.id = tsv.best_lrclib_match_id
  WHERE tsv.stt_embedding IS NOT NULL
    AND (1 - (tsv.stt_embedding <=> input_embedding)) >= min_score
  ORDER BY tsv.stt_embedding <=> input_embedding
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON COLUMN tiktok_scraped_videos.voxtral_stt_text IS 'Transcribed lyrics from Voxtral STT';
COMMENT ON COLUMN tiktok_scraped_videos.stt_embedding IS '768-dimensional embedding from EmbeddingGemma';
COMMENT ON COLUMN tiktok_scraped_videos.lrclib_matches IS 'Top-5 LRCLib matches with scores: [{lrclib_id, track_name, artist_name, similarity_score}]';
COMMENT ON COLUMN tiktok_scraped_videos.best_lrclib_match_id IS 'Highest scoring LRCLib match (for quick filtering)';
COMMENT ON VIEW tiktok_videos_matched IS 'TikTok videos with high-confidence song matches from LRCLib';
COMMENT ON FUNCTION find_similar_tiktok_videos IS 'Find similar TikTok videos using cosine similarity on STT embeddings';
