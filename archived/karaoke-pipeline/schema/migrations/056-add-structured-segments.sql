-- Migration: Add structured_segments column for Gemini-processed STT segmentation
-- This stores pre-segmented and translated STT data to avoid runtime chunking issues

ALTER TABLE tiktok_video_transcriptions
ADD COLUMN IF NOT EXISTS structured_segments JSONB;

COMMENT ON COLUMN tiktok_video_transcriptions.structured_segments IS
'Gemini Flash 2.5-lite structured output: segments with timing and translations (zh, vi, id)';

-- Create index for queries
CREATE INDEX IF NOT EXISTS idx_tiktok_video_transcriptions_structured_segments
ON tiktok_video_transcriptions USING GIN (structured_segments)
WHERE structured_segments IS NOT NULL;
