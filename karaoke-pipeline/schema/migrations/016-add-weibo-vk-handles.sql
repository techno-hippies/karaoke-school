-- Migration 016: Add Weibo and VK social media handles
-- MusicBrainz API provides these additional platforms

ALTER TABLE grc20_artists ADD COLUMN IF NOT EXISTS weibo_handle TEXT;
ALTER TABLE grc20_artists ADD COLUMN IF NOT EXISTS vk_handle TEXT;

COMMENT ON COLUMN grc20_artists.weibo_handle IS 'Weibo (Chinese social media) handle or user ID';
COMMENT ON COLUMN grc20_artists.vk_handle IS 'VKontakte (VK, Russian social media) handle or user ID';
