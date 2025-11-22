-- Add tt2dsp column to store TikTok's "TikTok to DSP" metadata
-- This contains Spotify/Apple Music/etc IDs for copyrighted tracks

ALTER TABLE tiktok_videos
ADD COLUMN IF NOT EXISTS tt2dsp JSONB;

-- Index for querying videos with Spotify links
CREATE INDEX IF NOT EXISTS idx_tiktok_videos_tt2dsp_spotify
ON tiktok_videos USING gin (tt2dsp)
WHERE tt2dsp IS NOT NULL;

COMMENT ON COLUMN tiktok_videos.tt2dsp IS
'TikTok to DSP mapping with Spotify/Apple Music IDs. Extract Spotify ID from tt2dsp.tt_to_dsp_song_infos[] where platform=3';
