-- Migration 024: GRC-20 Mint Readiness Views
-- Purpose: Create views to identify artists and works ready to mint to GRC-20
-- These views enforce requirements: ISWCs for works, Grove images for both

-- ==================== ARTISTS ====================

-- Artists ready to mint (all requirements met)
CREATE OR REPLACE VIEW grc20_artists_ready_to_mint AS
SELECT
  ga.id,
  ga.name,
  ga.spotify_artist_id,
  ga.isni,
  ga.image_url,
  ga.image_source,
  ga.instagram_handle,
  ga.twitter_handle,
  ga.tiktok_handle,
  ga.spotify_url,
  ga.wikidata_url,
  ga.created_at,
  ga.updated_at
FROM grc20_artists ga
WHERE ga.grc20_entity_id IS NULL  -- Not yet minted
  AND ga.image_url IS NOT NULL     -- Has Grove image (REQUIRED)
  AND ga.spotify_artist_id IS NOT NULL
ORDER BY ga.name ASC;

COMMENT ON VIEW grc20_artists_ready_to_mint IS 'Artists ready to mint to GRC-20. Requirements: Grove image, Spotify ID, not yet minted.';

-- Artists blocked from minting (with reason)
CREATE OR REPLACE VIEW grc20_artists_blocked AS
SELECT
  ga.id,
  ga.name,
  ga.spotify_artist_id,
  CASE
    WHEN ga.image_url IS NULL THEN 'Missing Grove image (run step 12)'
    WHEN ga.spotify_artist_id IS NULL THEN 'Missing Spotify ID'
    ELSE 'Unknown blocker'
  END as blocker_reason,
  ga.image_url IS NULL as missing_image,
  ga.created_at
FROM grc20_artists ga
WHERE ga.grc20_entity_id IS NULL
  AND (
    ga.image_url IS NULL
    OR ga.spotify_artist_id IS NULL
  )
ORDER BY
  CASE WHEN ga.image_url IS NULL THEN 1 ELSE 2 END,
  ga.name;

COMMENT ON VIEW grc20_artists_blocked IS 'Artists blocked from minting with specific reasons. Use for backfill prioritization.';

-- ==================== WORKS ====================

-- Works ready to mint (all requirements met)
CREATE OR REPLACE VIEW grc20_works_ready_to_mint AS
SELECT
  gw.id,
  gw.title,
  gw.iswc,
  gw.iswc_source,
  gw.primary_artist_id,
  gw.primary_artist_name,
  ga.name as artist_name_verified,
  ga.grc20_entity_id as artist_grc20_id,
  gw.composers,
  gw.lyricists,
  gw.language,
  gw.work_type,
  gw.musicbrainz_url,
  gw.wikidata_url,
  -- Recording info (first recording with image)
  (
    SELECT gwr.spotify_track_id
    FROM grc20_work_recordings gwr
    WHERE gwr.work_id = gw.id
      AND gwr.grove_image_url IS NOT NULL
    LIMIT 1
  ) as primary_spotify_track_id,
  (
    SELECT gwr.grove_image_url
    FROM grc20_work_recordings gwr
    WHERE gwr.work_id = gw.id
      AND gwr.grove_image_url IS NOT NULL
    LIMIT 1
  ) as grove_image_url,
  (
    SELECT COUNT(*)
    FROM grc20_work_recordings gwr
    WHERE gwr.work_id = gw.id
  ) as total_recordings,
  gw.created_at,
  gw.updated_at
FROM grc20_works gw
JOIN grc20_artists ga ON ga.id = gw.primary_artist_id
WHERE gw.grc20_entity_id IS NULL  -- Not yet minted
  AND gw.iswc IS NOT NULL          -- Has ISWC (REQUIRED!)
  AND gw.primary_artist_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM grc20_work_recordings gwr
    WHERE gwr.work_id = gw.id
      AND gwr.grove_image_url IS NOT NULL
  )
ORDER BY gw.title ASC;

COMMENT ON VIEW grc20_works_ready_to_mint IS 'Works ready to mint to GRC-20. Requirements: ISWC, primary artist, Grove image on at least one recording, not yet minted.';

-- Works blocked from minting (with specific reasons)
CREATE OR REPLACE VIEW grc20_works_blocked AS
SELECT
  gw.id,
  gw.title,
  gw.primary_artist_name,
  CASE
    WHEN gw.iswc IS NULL THEN 'Missing ISWC (run ISWC discovery)'
    WHEN gw.primary_artist_id IS NULL THEN 'Missing primary artist reference'
    WHEN NOT EXISTS (
      SELECT 1 FROM grc20_work_recordings gwr
      WHERE gwr.work_id = gw.id
        AND gwr.grove_image_url IS NOT NULL
    ) THEN 'Missing Grove image (run step 12)'
    ELSE 'Unknown blocker'
  END as blocker_reason,
  gw.iswc,
  gw.iswc_source,
  gw.primary_artist_id,
  (
    SELECT COUNT(*)
    FROM grc20_work_recordings gwr
    WHERE gwr.work_id = gw.id
  ) as total_recordings,
  (
    SELECT COUNT(*)
    FROM grc20_work_recordings gwr
    WHERE gwr.work_id = gw.id
      AND gwr.grove_image_url IS NOT NULL
  ) as recordings_with_image,
  gw.created_at
FROM grc20_works gw
WHERE gw.grc20_entity_id IS NULL
  AND (
    gw.iswc IS NULL
    OR gw.primary_artist_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM grc20_work_recordings gwr
      WHERE gwr.work_id = gw.id
        AND gwr.grove_image_url IS NOT NULL
    )
  )
ORDER BY
  CASE
    WHEN gw.iswc IS NULL THEN 1
    WHEN NOT EXISTS (
      SELECT 1 FROM grc20_work_recordings gwr
      WHERE gwr.work_id = gw.id
        AND gwr.grove_image_url IS NOT NULL
    ) THEN 2
    ELSE 3
  END,
  gw.title;

COMMENT ON VIEW grc20_works_blocked IS 'Works blocked from minting with specific reasons. Priority: 1) ISWC, 2) Images, 3) Other.';

-- ==================== MINT STATISTICS ====================

-- Overall mint readiness dashboard
CREATE OR REPLACE VIEW grc20_mint_readiness_summary AS
SELECT
  -- Artists
  (SELECT COUNT(*) FROM grc20_artists) as total_artists,
  (SELECT COUNT(*) FROM grc20_artists WHERE grc20_entity_id IS NOT NULL) as artists_minted,
  (SELECT COUNT(*) FROM grc20_artists_ready_to_mint) as artists_ready,
  (SELECT COUNT(*) FROM grc20_artists_blocked) as artists_blocked,

  -- Works
  (SELECT COUNT(*) FROM grc20_works) as total_works,
  (SELECT COUNT(*) FROM grc20_works WHERE grc20_entity_id IS NOT NULL) as works_minted,
  (SELECT COUNT(*) FROM grc20_works_ready_to_mint) as works_ready,
  (SELECT COUNT(*) FROM grc20_works_blocked) as works_blocked,

  -- Blockers breakdown
  (SELECT COUNT(*) FROM grc20_works_blocked WHERE blocker_reason LIKE '%ISWC%') as works_blocked_missing_iswc,
  (SELECT COUNT(*) FROM grc20_works_blocked WHERE blocker_reason LIKE '%image%') as works_blocked_missing_image,
  (SELECT COUNT(*) FROM grc20_artists_blocked WHERE blocker_reason LIKE '%image%') as artists_blocked_missing_image;

COMMENT ON VIEW grc20_mint_readiness_summary IS 'High-level dashboard of GRC-20 mint readiness. Use for monitoring progress.';

-- ==================== INDEXES FOR PERFORMANCE ====================

-- These views use existing indexes on grc20_entity_id, image_url, iswc, primary_artist_id
-- No additional indexes needed (already defined in migrations 013 and 014)
