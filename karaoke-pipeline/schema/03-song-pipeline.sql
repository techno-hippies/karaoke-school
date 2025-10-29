-- Song Pipeline State Machine
-- Single source of truth for song processing status

CREATE TABLE IF NOT EXISTS song_pipeline (
  id SERIAL PRIMARY KEY,

  -- Identity (video → track linkage)
  tiktok_video_id TEXT NOT NULL UNIQUE REFERENCES tiktok_videos(video_id) ON DELETE CASCADE,
  spotify_track_id TEXT UNIQUE NOT NULL,

  -- Pipeline State
  status TEXT NOT NULL DEFAULT 'scraped' CHECK (status IN (
    'scraped',            -- From TikTok, has spotify_track_id
    'spotify_resolved',   -- Spotify track + artist in cache
    'iswc_found',         -- Quansic ISWC lookup SUCCESS ⚠️ GATE
    'metadata_enriched',  -- MusicBrainz data added
    'lyrics_ready',       -- Lyrics normalized & validated
    'audio_downloaded',   -- Freyr + AcoustID verified + Grove stored
    'alignment_complete', -- ElevenLabs word timing done
    'stems_separated',    -- Demucs vocals/instrumental
    'media_enhanced',     -- Fal.ai audio2audio + images
    'ready_to_mint',      -- All GRC20 fields populated
    'minted',             -- Complete! GRC20 entity created
    'failed'              -- Dead end (no ISWC, bad audio, etc.)
  )),

  -- Gating Fields (must be true to progress)
  has_iswc BOOLEAN DEFAULT FALSE,
  has_lyrics BOOLEAN DEFAULT FALSE,
  has_audio BOOLEAN DEFAULT FALSE,

  -- Quick Reference (denormalized for fast queries)
  isrc TEXT,
  iswc TEXT,
  spotify_artist_id TEXT,
  isni TEXT,

  -- Error Tracking
  last_attempted_at TIMESTAMPTZ,
  retry_count INT DEFAULT 0,
  error_message TEXT,
  error_stage TEXT, -- Which processor failed

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_pipeline_status ON song_pipeline(status)
  WHERE status NOT IN ('minted', 'failed');

CREATE INDEX idx_pipeline_retry ON song_pipeline(status, last_attempted_at, retry_count)
  WHERE status NOT IN ('minted', 'failed');

CREATE INDEX idx_pipeline_spotify ON song_pipeline(spotify_track_id);
CREATE INDEX idx_pipeline_video ON song_pipeline(tiktok_video_id);
CREATE INDEX idx_pipeline_isrc ON song_pipeline(isrc) WHERE isrc IS NOT NULL;
CREATE INDEX idx_pipeline_iswc ON song_pipeline(iswc) WHERE iswc IS NOT NULL;

-- Views for monitoring
CREATE OR REPLACE VIEW pipeline_summary AS
SELECT
  status,
  COUNT(*) as count,
  ROUND(AVG(retry_count), 2) as avg_retries,
  MIN(updated_at) as oldest_updated,
  MAX(updated_at) as newest_updated,
  COUNT(*) FILTER (WHERE retry_count >= 3) as max_retries_reached
FROM song_pipeline
GROUP BY status
ORDER BY
  CASE status
    WHEN 'scraped' THEN 1
    WHEN 'spotify_resolved' THEN 2
    WHEN 'iswc_found' THEN 3
    WHEN 'metadata_enriched' THEN 4
    WHEN 'lyrics_ready' THEN 5
    WHEN 'audio_downloaded' THEN 6
    WHEN 'alignment_complete' THEN 7
    WHEN 'stems_separated' THEN 8
    WHEN 'media_enhanced' THEN 9
    WHEN 'ready_to_mint' THEN 10
    WHEN 'minted' THEN 11
    WHEN 'failed' THEN 12
  END;

-- View for GRC20 minting (with all joined data)
CREATE OR REPLACE VIEW songs_ready_to_mint AS
SELECT
  sp.*,
  st.title,
  st.artists,
  sa.grove_cid as audio_grove_cid,
  sa.duration_ms as audio_duration_ms,
  -- Future: Add stems, alignment, enhanced audio, images when those tables exist
  sl.plain_text as lyrics_plain,
  sl.synced_lrc as lyrics_synced,
  sl.grove_cid as lyrics_grove_cid,
  v.video_url as tiktok_url,
  v.creator_username as tiktok_creator
FROM song_pipeline sp
JOIN spotify_tracks st ON sp.spotify_track_id = st.spotify_track_id
LEFT JOIN song_audio sa ON sp.spotify_track_id = sa.spotify_track_id
LEFT JOIN song_lyrics sl ON sp.spotify_track_id = sl.spotify_track_id
LEFT JOIN tiktok_videos v ON sp.tiktok_video_id = v.video_id
WHERE sp.status = 'ready_to_mint'
  AND sp.has_iswc = TRUE
  AND sp.has_lyrics = TRUE
  AND sp.has_audio = TRUE;

-- Trigger to update updated_at
CREATE TRIGGER song_pipeline_update
  BEFORE UPDATE ON song_pipeline
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
