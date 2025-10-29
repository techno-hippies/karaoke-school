-- TikTok Creators and Videos
-- Normalized schema for v2 pipeline

-- Track creators (one-to-many with videos)
CREATE TABLE IF NOT EXISTS tiktok_creators (
  username TEXT PRIMARY KEY,
  sec_uid TEXT UNIQUE NOT NULL,  -- Required for API calls
  user_id TEXT,
  nickname TEXT,
  bio TEXT,
  avatar_url TEXT,

  -- Stats (snapshot at scrape time)
  follower_count BIGINT,
  video_count INT,

  -- Tracking
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_creators_last_scraped ON tiktok_creators(last_scraped_at);

-- Lightweight videos table (NO 100KB+ raw_data bloat)
CREATE TABLE IF NOT EXISTS tiktok_videos (
  video_id TEXT PRIMARY KEY,
  creator_username TEXT NOT NULL REFERENCES tiktok_creators(username) ON DELETE CASCADE,

  -- Content
  description TEXT,
  video_created_at TIMESTAMPTZ NOT NULL,

  -- Music info (extracted from TikTok API)
  music_title TEXT,
  music_author TEXT,
  is_copyrighted BOOLEAN,  -- NULL = unknown, TRUE/FALSE = explicit
  spotify_track_id TEXT,   -- From tt2dsp field (platform: 3)

  -- Stats (snapshot at scrape time)
  play_count BIGINT,
  like_count BIGINT,
  comment_count BIGINT,
  share_count BIGINT,

  -- URLs and metadata
  video_url TEXT,
  cover_url TEXT,
  duration_seconds INT,

  -- Tracking
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_videos_creator ON tiktok_videos(creator_username);
CREATE INDEX idx_videos_spotify ON tiktok_videos(spotify_track_id)
  WHERE spotify_track_id IS NOT NULL;
CREATE INDEX idx_videos_copyrighted ON tiktok_videos(is_copyrighted, spotify_track_id)
  WHERE is_copyrighted = TRUE AND spotify_track_id IS NOT NULL;
CREATE INDEX idx_videos_created ON tiktok_videos(video_created_at DESC);



-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tiktok_creators_update
  BEFORE UPDATE ON tiktok_creators
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER tiktok_videos_update
  BEFORE UPDATE ON tiktok_videos
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- View for copyrighted videos ready to process
CREATE OR REPLACE VIEW videos_ready_to_process AS
SELECT
  v.*,
  c.nickname as creator_nickname,
  c.follower_count as creator_followers
FROM tiktok_videos v
JOIN tiktok_creators c ON v.creator_username = c.username
WHERE v.is_copyrighted = TRUE
  AND v.spotify_track_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM track_pipeline tp
    WHERE tp.tiktok_video_id = v.video_id
  )
ORDER BY v.play_count DESC;
