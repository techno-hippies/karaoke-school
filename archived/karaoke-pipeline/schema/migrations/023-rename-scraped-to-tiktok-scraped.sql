-- Rename status 'scraped' to 'tiktok_scraped' for semantic clarity
-- Aligns database constraint with code and documentation

-- Update constraint
ALTER TABLE song_pipeline DROP CONSTRAINT song_pipeline_status_check;

ALTER TABLE song_pipeline ADD CONSTRAINT song_pipeline_status_check CHECK (status IN (
  'tiktok_scraped',
  'spotify_resolved',
  'iswc_found',
  'metadata_enriched',
  'lyrics_ready',
  'audio_downloaded',
  'alignment_complete',
  'stems_separated',
  'media_enhanced',
  'ready_to_mint',
  'minted',
  'failed'
));

-- Update default value
ALTER TABLE song_pipeline ALTER COLUMN status SET DEFAULT 'tiktok_scraped';

-- Update pipeline_summary view
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
    WHEN 'stems_separated' THEN 8
    WHEN 'media_enhanced' THEN 9
    WHEN 'ready_to_mint' THEN 10
    WHEN 'minted' THEN 11
    WHEN 'failed' THEN 12
  END;
