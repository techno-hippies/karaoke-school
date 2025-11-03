-- Add missing pipeline statuses back after migration 023
-- Migration 023 removed 'translations_ready' which was added in migration 005
-- This migration adds back all required statuses for steps 7.5-11

-- Drop the existing constraint
ALTER TABLE song_pipeline DROP CONSTRAINT song_pipeline_status_check;

-- Add new constraint with all required statuses
ALTER TABLE song_pipeline ADD CONSTRAINT song_pipeline_status_check CHECK (status IN (
  'tiktok_scraped',      -- From TikTok, has spotify_track_id
  'spotify_resolved',    -- Spotify track + artist in cache
  'iswc_found',          -- Quansic ISWC lookup SUCCESS ⚠️ GATE
  'metadata_enriched',   -- MusicBrainz data added
  'lyrics_ready',        -- Lyrics normalized & validated
  'audio_downloaded',    -- Freyr + AcoustID verified + Grove stored
  'alignment_complete',  -- ElevenLabs word timing done
  'translations_ready',  -- Multi-language translations complete (zh, vi, id)
  'stems_separated',     -- Demucs vocals/instrumental
  'segments_selected',   -- AI-selected karaoke segment + viral clip
  'enhanced',            -- fal.ai Stable Audio 2.5 enhancement
  'clips_cropped',       -- Viral clip extracted from enhanced audio
  'failed'               -- Dead end (no ISWC, bad audio, etc.)
));

-- Update pipeline_summary view to include new statuses
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
    WHEN 'tiktok_scraped' THEN 1
    WHEN 'spotify_resolved' THEN 2
    WHEN 'iswc_found' THEN 3
    WHEN 'metadata_enriched' THEN 4
    WHEN 'lyrics_ready' THEN 5
    WHEN 'audio_downloaded' THEN 6
    WHEN 'alignment_complete' THEN 7
    WHEN 'translations_ready' THEN 8
    WHEN 'stems_separated' THEN 9
    WHEN 'segments_selected' THEN 10
    WHEN 'enhanced' THEN 11
    WHEN 'clips_cropped' THEN 12
    WHEN 'failed' THEN 99
  END;

-- Add comment explaining status flow
COMMENT ON CONSTRAINT song_pipeline_status_check ON song_pipeline IS
  'Pipeline status flow: tiktok_scraped → spotify_resolved → iswc_found → metadata_enriched → lyrics_ready → audio_downloaded → alignment_complete → translations_ready → stems_separated → segments_selected → enhanced → clips_cropped';
