-- Pipeline-New Schema
-- Database: Neon (silent-rain-11383465)
--
-- Run this migration with:
--   bun src/db/migrate.ts
-- Or execute directly via Neon MCP

-- ============================================================================
-- 1. ACCOUNTS (Posting accounts like Scarlett - real Lens + PKP)
-- ============================================================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_grove_url TEXT,
  bio TEXT,
  account_type TEXT NOT NULL CHECK (account_type IN ('ai', 'human')),

  -- Lit Protocol PKP
  pkp_address TEXT UNIQUE,
  pkp_token_id TEXT,
  pkp_public_key TEXT,
  pkp_network TEXT,                      -- 'naga-dev', 'naga-test', etc.

  -- Lens Protocol
  lens_handle TEXT UNIQUE,
  lens_account_address TEXT UNIQUE,
  lens_account_id TEXT,
  lens_metadata_uri TEXT,
  lens_transaction_hash TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. ARTISTS (Metadata only - NO Lens accounts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_artist_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,                        -- URL-friendly name (e.g., 'eminem', 'beyonce')
  image_url TEXT,                          -- Original Spotify URL (for reference)
  image_grove_url TEXT,                    -- Permanent Grove URL

  -- Unlock Protocol subscription locks
  unlock_lock_address_testnet TEXT,        -- Lock contract on Base Sepolia
  unlock_lock_address_mainnet TEXT,        -- Lock contract on Base mainnet

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. SONGS (Core entity, keyed by ISWC)
-- ============================================================================
CREATE TABLE IF NOT EXISTS songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iswc TEXT UNIQUE NOT NULL,             -- e.g., 'T0704563291' (no dots)
  spotify_track_id TEXT UNIQUE,
  title TEXT NOT NULL,
  artist_id UUID REFERENCES artists(id),
  duration_ms INT,
  spotify_images JSONB,                  -- [{url, width, height}, ...]

  -- Cover images (Grove - permanent URLs)
  cover_grove_url TEXT,                  -- Full-size album art (640x640)
  thumbnail_grove_url TEXT,              -- Thumbnail (300x300) for lists

  -- Audio URLs (Grove)
  original_audio_url TEXT,               -- Uploaded original
  instrumental_url TEXT,                 -- After demucs
  vocals_url TEXT,                       -- After demucs
  enhanced_instrumental_url TEXT,        -- After FAL (karaoke audio)

  -- Clip assets (for free tier)
  clip_end_ms INT,                       -- End of free clip (start is always 0)
  clip_instrumental_url TEXT,            -- Cropped FAL instrumental for clip
  clip_lyrics_url TEXT,                  -- Grove JSON with clip lyrics

  -- Encryption (for premium subscribers) - testnet
  encrypted_full_url_testnet TEXT,       -- Lit-encrypted full audio blob
  encryption_manifest_url_testnet TEXT,  -- Encryption metadata JSON
  lit_network_testnet TEXT,              -- 'naga-dev', 'naga-test'

  -- Encryption (for premium subscribers) - mainnet
  encrypted_full_url_mainnet TEXT,
  encryption_manifest_url_mainnet TEXT,
  lit_network_mainnet TEXT,

  -- AI-generated tags
  lyric_tags TEXT[],                     -- Psychographic tags from lyrics (e.g., 'ambition', 'heartbreak')

  -- Alignment (cached, reusable)
  alignment_data JSONB,                  -- ElevenLabs word-level timing
  alignment_version TEXT,                -- 'elevenlabs-v1'
  alignment_loss FLOAT,                  -- Quality metric

  -- Genius (for trivia)
  genius_song_id BIGINT,
  genius_url TEXT,

  -- Processing status
  stage TEXT DEFAULT 'pending',          -- pending, aligned, enhanced, ready
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. LYRICS (Line-by-line with timing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lyrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  line_index INT NOT NULL,
  language TEXT NOT NULL,                -- 'en', 'zh'
  text TEXT NOT NULL,
  section_marker TEXT,                   -- '[Chorus]', '[Verse 1]', etc.
  start_ms INT,                          -- From alignment
  end_ms INT,
  word_timings JSONB,                    -- [{text, start, end}, ...]

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(song_id, line_index, language)
);

-- ============================================================================
-- 5. GENIUS REFERENTS (For trivia generation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS genius_referents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  referent_id BIGINT NOT NULL,
  genius_song_id BIGINT NOT NULL,
  fragment TEXT,                         -- Lyric snippet
  classification TEXT,                   -- 'verified', 'community', etc.
  annotations JSONB,                     -- Full annotation text
  votes_total INT DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(song_id, referent_id)
);

-- ============================================================================
-- 6. CLIPS (For karaoke events)
-- ============================================================================
CREATE TABLE IF NOT EXISTS clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  clip_hash BYTEA,                       -- keccak256(spotifyTrackId, startMs)
  start_ms INT NOT NULL,
  end_ms INT NOT NULL,
  metadata_uri TEXT,                     -- Grove URI
  emitted_at TIMESTAMPTZ,                -- When ClipRegistered emitted
  transaction_hash TEXT,

  -- Tags for AI chat context and user profiling
  visual_tags TEXT[],                    -- Manual: what's in the video (e.g., 'anime', 'streetwear')
  lyric_tags TEXT[],                     -- AI-generated: psychographic themes (can override song-level)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(song_id, start_ms)
);

-- ============================================================================
-- 7. VIDEOS (Generated for social media)
-- ============================================================================
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  background_video_url TEXT,             -- Input {uuid}.mp4
  output_video_url TEXT,                 -- Generated with subtitles (Grove)
  thumbnail_url TEXT,                    -- Video frame thumbnail (Grove) - NOT album art
  subtitles_ass TEXT,                    -- ASS content
  snippet_start_ms INT NOT NULL,
  snippet_end_ms INT NOT NULL,
  width INT DEFAULT 1440,
  height INT DEFAULT 1440,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 8. POSTS (Lens feed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  song_id UUID NOT NULL REFERENCES songs(id),
  video_id UUID REFERENCES videos(id),
  ai_cover_audio_url TEXT,               -- AI cover audio provided when posting

  -- Lens
  lens_post_id TEXT UNIQUE,
  content TEXT,
  tags TEXT[],
  metadata_uri TEXT,
  transaction_hash TEXT,

  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 9. EXERCISES (Polymorphic)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  clip_id UUID REFERENCES clips(id),
  lyric_id UUID REFERENCES lyrics(id),

  exercise_type TEXT NOT NULL CHECK (exercise_type IN ('trivia', 'translation', 'sayitback', 'fill_blank')),
  language_code TEXT NOT NULL,           -- 'en', 'zh', 'vi', 'id'

  -- Question content
  question_data JSONB NOT NULL,          -- {prompt, correct_answer, distractors, explanation}
  referent_id BIGINT,                    -- For trivia (links to genius_referents.referent_id)

  -- On-chain
  metadata_uri TEXT,                     -- Grove URI
  emitted_at TIMESTAMPTZ,
  transaction_hash TEXT,
  enabled BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_lyrics_song ON lyrics(song_id);
CREATE INDEX IF NOT EXISTS idx_lyrics_language ON lyrics(language);
CREATE INDEX IF NOT EXISTS idx_lyrics_song_lang ON lyrics(song_id, language);

CREATE INDEX IF NOT EXISTS idx_referents_song ON genius_referents(song_id);
CREATE INDEX IF NOT EXISTS idx_referents_genius_song ON genius_referents(genius_song_id);

CREATE INDEX IF NOT EXISTS idx_clips_song ON clips(song_id);
CREATE INDEX IF NOT EXISTS idx_clips_hash ON clips(clip_hash) WHERE clip_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_videos_song ON videos(song_id);

CREATE INDEX IF NOT EXISTS idx_exercises_song ON exercises(song_id);
CREATE INDEX IF NOT EXISTS idx_exercises_type ON exercises(exercise_type);
CREATE INDEX IF NOT EXISTS idx_exercises_enabled ON exercises(enabled) WHERE enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_posts_account ON posts(account_id);
CREATE INDEX IF NOT EXISTS idx_posts_song ON posts(song_id);
CREATE INDEX IF NOT EXISTS idx_posts_lens ON posts(lens_post_id) WHERE lens_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_songs_stage ON songs(stage);
CREATE INDEX IF NOT EXISTS idx_songs_iswc ON songs(iswc);
CREATE INDEX IF NOT EXISTS idx_songs_spotify ON songs(spotify_track_id) WHERE spotify_track_id IS NOT NULL;
