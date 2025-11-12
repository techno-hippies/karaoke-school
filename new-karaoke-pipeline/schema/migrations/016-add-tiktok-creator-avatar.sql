-- Add avatar_url column to tiktok_creators table
-- This stores the creator's TikTok profile picture URL

ALTER TABLE tiktok_creators
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN tiktok_creators.avatar_url IS 'TikTok profile picture URL (used for Lens account creation)';
