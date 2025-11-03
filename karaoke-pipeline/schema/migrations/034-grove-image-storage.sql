-- Migration 034: Add Grove image storage and drop derivative_images
-- Purpose: Store original images on Grove instead of generating expensive derivatives
-- Cost: $0.01/MB vs $$$$ for AI generation

-- Design Decision: Store both profile image AND header image (banner)
-- - Profile image (image_url): Square photo from Spotify/Genius/MusicBrainz
-- - Header image (header_image_url): Wide banner from Genius only (when available)
-- - Header images are great for UI banners/covers, upload if available

-- Step 1: Add Grove columns to grc20_artists
ALTER TABLE grc20_artists
  ADD COLUMN IF NOT EXISTS grove_image_cid TEXT,
  ADD COLUMN IF NOT EXISTS grove_image_url TEXT,
  ADD COLUMN IF NOT EXISTS grove_header_image_cid TEXT,
  ADD COLUMN IF NOT EXISTS grove_header_image_url TEXT;

-- Step 2: SKIP grc20_works (works are compositions, not recordings)
-- Images belong in grc20_work_recordings (already has grove_image_url, grove_thumbnail_url)
-- Note: grc20_works represents abstract musical compositions, not specific releases

-- Step 3: Drop derivative_images table (no longer needed)
DROP TABLE IF EXISTS derivative_images CASCADE;

-- Step 4: Add indexes for Grove CIDs (for quick lookups)
CREATE INDEX IF NOT EXISTS idx_grc20_artists_grove_cid
  ON grc20_artists(grove_image_cid)
  WHERE grove_image_cid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_grc20_artists_grove_header_cid
  ON grc20_artists(grove_header_image_cid)
  WHERE grove_header_image_cid IS NOT NULL;

-- Comments
COMMENT ON COLUMN grc20_artists.grove_image_cid IS 'IPFS CID of artist profile image (square, from Spotify/Genius/MusicBrainz)';
COMMENT ON COLUMN grc20_artists.grove_image_url IS 'Grove URL for artist profile image (grove://...)';
COMMENT ON COLUMN grc20_artists.grove_header_image_cid IS 'IPFS CID of artist header/banner image (wide, from Genius only)';
COMMENT ON COLUMN grc20_artists.grove_header_image_url IS 'Grove URL for artist header/banner image (grove://...)';
