-- Migration 009: Create lens_posts table
-- Purpose: Track TikTok videos published to Lens Protocol
-- Date: 2025-11-11

CREATE TABLE IF NOT EXISTS lens_posts (
  -- Primary key
  tiktok_video_id TEXT PRIMARY KEY,

  -- Lens post identifiers
  lens_post_id TEXT NOT NULL,
  lens_account_address TEXT NOT NULL,

  -- Content
  transcript_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  target_language TEXT NOT NULL,

  -- Metadata
  post_metadata_uri TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,

  -- Timestamps
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_lens_posts_account
  ON lens_posts(lens_account_address);

CREATE INDEX IF NOT EXISTS idx_lens_posts_published_at
  ON lens_posts(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_lens_posts_transaction
  ON lens_posts(transaction_hash);

-- Foreign key to lens_accounts (soft reference - artists may exist without Lens accounts)
-- No FK constraint to allow flexibility

-- Comments
COMMENT ON TABLE lens_posts IS 'TikTok videos published to Lens Protocol with transcriptions and translations';
COMMENT ON COLUMN lens_posts.tiktok_video_id IS 'TikTok video ID (primary key, references tiktok_videos)';
COMMENT ON COLUMN lens_posts.lens_post_id IS 'Lens Protocol post ID (initially txHash, then assigned by indexer)';
COMMENT ON COLUMN lens_posts.lens_account_address IS 'Lens account that created the post';
COMMENT ON COLUMN lens_posts.transcript_text IS 'Original transcript from Cartesia STT';
COMMENT ON COLUMN lens_posts.translated_text IS 'Translated caption from Gemini Flash 2.5';
COMMENT ON COLUMN lens_posts.target_language IS 'Target language code (zh, vi, id, etc.)';
COMMENT ON COLUMN lens_posts.post_metadata_uri IS 'Grove URI to Lens post metadata JSON';
COMMENT ON COLUMN lens_posts.transaction_hash IS 'Blockchain transaction hash for post creation';
COMMENT ON COLUMN lens_posts.published_at IS 'When post was created on Lens Protocol';
