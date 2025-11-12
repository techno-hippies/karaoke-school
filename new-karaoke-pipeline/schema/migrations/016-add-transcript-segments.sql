-- Migration 016: Add transcript segments for STT word-level timing
-- Purpose: Store Cartesia STT segments with word-level timestamps for karaoke overlay in app

ALTER TABLE tiktok_transcripts
ADD COLUMN transcript_segments JSONB;

COMMENT ON COLUMN tiktok_transcripts.transcript_segments IS 
'Cartesia STT segments with word-level timing. Format: [{ text: string, start: number, end: number, words: [{ word: string, start: number, end: number }] }]';

-- Index for querying videos with segments
CREATE INDEX idx_tiktok_transcripts_has_segments
ON tiktok_transcripts(video_id)
WHERE transcript_segments IS NOT NULL;
