-- Migration Script: Populate track_pipeline from existing TikTok scraped data
-- Run this AFTER importing the Spotify dump tables

BEGIN;

-- Step 1: Insert all TikTok videos with Spotify track IDs
INSERT INTO track_pipeline (
  tiktok_video_id,
  spotify_track_id,
  status,
  created_at,
  updated_at
)
SELECT DISTINCT
  v.video_id,
  v.spotify_track_id,
  'scraped' as status,
  v.created_at,
  NOW()
FROM tiktok_scraped_videos v
WHERE v.spotify_track_id IS NOT NULL
  AND v.copyright_status = 'copyrighted'
ON CONFLICT (spotify_track_id) DO NOTHING;

-- Step 2: Upgrade tracks that already have ISRC (from dump or existing spotify_tracks)
WITH tracks_with_isrc AS (
  SELECT DISTINCT
    COALESCE(
      st.spotify_track_id,
      te.trackid
    ) as spotify_track_id,
    COALESCE(
      st.isrc,
      te.value
    ) as isrc
  FROM track_pipeline tp
  LEFT JOIN spotify_tracks st ON tp.spotify_track_id = st.spotify_track_id
  LEFT JOIN spotify_track_externalid te ON tp.spotify_track_id = te.trackid AND te.name = 'isrc'
  WHERE tp.status = 'scraped'
    AND (st.isrc IS NOT NULL OR te.value IS NOT NULL)
)
UPDATE track_pipeline tp
SET
  status = 'spotify_resolved',
  isrc = t.isrc,
  updated_at = NOW()
FROM tracks_with_isrc t
WHERE tp.spotify_track_id = t.spotify_track_id
  AND tp.status = 'scraped';

-- Step 3: Upgrade tracks that already have ISWC (from existing Quansic/MusicBrainz data)
WITH tracks_with_iswc AS (
  SELECT DISTINCT
    tp.spotify_track_id,
    COALESCE(
      qc.iswc,
      mbc.iswc,
      qr.iswc,
      mbw.iswc
    ) as iswc
  FROM track_pipeline tp
  LEFT JOIN quansic_cache qc ON tp.isrc = qc.isrc
  LEFT JOIN musicbrainz_cache mbc ON tp.isrc = mbc.isrc
  LEFT JOIN quansic_recordings qr ON tp.isrc = qr.isrc
  LEFT JOIN musicbrainz_recordings mbr ON tp.isrc = mbr.isrc
  LEFT JOIN musicbrainz_works mbw ON mbr.work_mbid = mbw.work_mbid
  WHERE tp.status = 'spotify_resolved'
    AND (
      qc.iswc IS NOT NULL
      OR mbc.iswc IS NOT NULL
      OR qr.iswc IS NOT NULL
      OR mbw.iswc IS NOT NULL
    )
)
UPDATE track_pipeline tp
SET
  status = 'iswc_found',
  has_iswc = TRUE,
  iswc = t.iswc,
  updated_at = NOW()
FROM tracks_with_iswc t
WHERE tp.spotify_track_id = t.spotify_track_id
  AND tp.status = 'spotify_resolved';

-- Step 4: Upgrade tracks that have lyrics
WITH tracks_with_lyrics AS (
  SELECT DISTINCT
    spotify_track_id
  FROM spotify_track_lyrics
  WHERE plain_lyrics IS NOT NULL
)
UPDATE track_pipeline tp
SET
  has_lyrics = TRUE,
  updated_at = NOW()
FROM tracks_with_lyrics t
WHERE tp.spotify_track_id = t.spotify_track_id;

-- Step 5: Upgrade tracks that have audio files
WITH tracks_with_audio AS (
  SELECT DISTINCT
    spotify_track_id
  FROM track_audio_files
  WHERE grove_cid IS NOT NULL
)
UPDATE track_pipeline tp
SET
  has_audio = TRUE,
  updated_at = NOW()
FROM tracks_with_audio t
WHERE tp.spotify_track_id = t.spotify_track_id;

-- Step 6: Migrate existing lyrics to new track_lyrics table
INSERT INTO track_lyrics (
  spotify_track_id,
  plain_text,
  synced_lrc,
  source,
  confidence_score,
  grove_cid,
  created_at,
  updated_at
)
SELECT
  spotify_track_id,
  plain_lyrics,
  synced_lyrics,
  CASE
    WHEN confidence_score > 0.8 THEN 'lrclib'
    ELSE 'lyrics_ovh'
  END as source,
  confidence_score,
  NULL as grove_cid, -- Will be populated later
  created_at,
  NOW()
FROM spotify_track_lyrics
WHERE plain_lyrics IS NOT NULL
ON CONFLICT (spotify_track_id) DO NOTHING;

-- Step 7: Migrate existing audio files to track_media table
INSERT INTO track_media (
  spotify_track_id,
  audio_grove_cid,
  audio_duration_ms,
  audio_verified,
  created_at,
  updated_at
)
SELECT
  spotify_track_id,
  grove_cid,
  duration_ms,
  acoustid_verified,
  created_at,
  NOW()
FROM track_audio_files
WHERE grove_cid IS NOT NULL
ON CONFLICT (spotify_track_id) DO NOTHING;

-- Step 8: Mark tracks as ready_to_mint if they have all required data
UPDATE track_pipeline tp
SET status = 'ready_to_mint'
WHERE tp.has_iswc = TRUE
  AND tp.has_lyrics = TRUE
  AND tp.has_audio = TRUE
  AND EXISTS (
    SELECT 1 FROM track_media tm
    WHERE tm.spotify_track_id = tp.spotify_track_id
      AND tm.audio_grove_cid IS NOT NULL
  )
  AND EXISTS (
    SELECT 1 FROM track_lyrics tl
    WHERE tl.spotify_track_id = tp.spotify_track_id
      AND tl.grove_cid IS NOT NULL
  );

COMMIT;

-- Print migration stats
SELECT
  'Migration Summary' as report_name,
  (SELECT COUNT(*) FROM track_pipeline) as total_tracks,
  (SELECT COUNT(*) FROM track_pipeline WHERE status = 'scraped') as scraped,
  (SELECT COUNT(*) FROM track_pipeline WHERE status = 'spotify_resolved') as spotify_resolved,
  (SELECT COUNT(*) FROM track_pipeline WHERE status = 'iswc_found') as iswc_found,
  (SELECT COUNT(*) FROM track_pipeline WHERE status = 'ready_to_mint') as ready_to_mint,
  (SELECT COUNT(*) FROM track_pipeline WHERE status = 'failed') as failed;

-- Show pipeline distribution
SELECT * FROM pipeline_summary;

-- Show how many tracks can benefit from Spotify dump
SELECT
  'Spotify Dump Coverage' as metric,
  COUNT(*) as total_tracks,
  COUNT(CASE WHEN st.trackid IS NOT NULL THEN 1 END) as in_dump,
  ROUND(
    100.0 * COUNT(CASE WHEN st.trackid IS NOT NULL THEN 1 END) / COUNT(*),
    1
  ) as dump_coverage_percent
FROM track_pipeline tp
LEFT JOIN spotify_track st ON tp.spotify_track_id = st.trackid
WHERE tp.status = 'scraped';
