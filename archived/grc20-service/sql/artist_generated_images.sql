/**
 * Artist Generated Images Table
 *
 * Stores AI-generated derivative images for artists
 * Generated via fal.ai Seedream from Genius/Wikipedia source images
 * Creates copyright-free derivative works suitable for GRC-20 minting
 */

CREATE TABLE IF NOT EXISTS artist_generated_images (
  -- Primary key
  id SERIAL PRIMARY KEY,

  -- Link to Genius artist (required)
  genius_artist_id INTEGER NOT NULL REFERENCES genius_artists(genius_artist_id) ON DELETE CASCADE,

  -- Source image info
  source_image_url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('genius', 'wikipedia', 'spotify', 'manual')),

  -- Generated image (fal.ai Seedream output)
  generated_image_url TEXT NOT NULL UNIQUE,
  grove_uri TEXT, -- If uploaded to Grove

  -- Generation parameters
  prompt TEXT NOT NULL,
  seed INTEGER,
  image_width INTEGER DEFAULT 1024,
  image_height INTEGER DEFAULT 1024,

  -- Metadata
  fal_request_id TEXT, -- For debugging/tracking
  generation_time_ms INTEGER, -- How long generation took
  cost_credits NUMERIC(10, 6), -- If tracking costs

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'generating', 'completed', 'failed', 'uploaded_to_grove')
  ),
  error_message TEXT, -- If generation failed

  -- Quality/usage flags
  is_approved BOOLEAN DEFAULT false, -- Manual approval before GRC-20 mint
  is_used_in_grc20 BOOLEAN DEFAULT false, -- Minted to GRC-20
  quality_score INTEGER CHECK (quality_score BETWEEN 0 AND 100), -- Manual or AI quality rating

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_at TIMESTAMPTZ, -- When fal.ai completed generation
  approved_at TIMESTAMPTZ,
  minted_at TIMESTAMPTZ -- When used in GRC-20 mint
);

-- Indexes
CREATE INDEX idx_artist_generated_images_genius_artist ON artist_generated_images(genius_artist_id);
CREATE INDEX idx_artist_generated_images_status ON artist_generated_images(status);
CREATE INDEX idx_artist_generated_images_approved ON artist_generated_images(is_approved) WHERE is_approved = true;
CREATE INDEX idx_artist_generated_images_used_grc20 ON artist_generated_images(is_used_in_grc20) WHERE is_used_in_grc20 = true;
CREATE INDEX idx_artist_generated_images_created_at ON artist_generated_images(created_at DESC);

-- Unique constraint: one approved image per artist
CREATE UNIQUE INDEX idx_one_approved_per_artist
  ON artist_generated_images(genius_artist_id)
  WHERE is_approved = true AND status = 'completed';

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_artist_generated_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER artist_generated_images_updated_at
  BEFORE UPDATE ON artist_generated_images
  FOR EACH ROW
  EXECUTE FUNCTION update_artist_generated_images_updated_at();

-- Comments
COMMENT ON TABLE artist_generated_images IS 'AI-generated derivative artist images for copyright-free usage in GRC-20';
COMMENT ON COLUMN artist_generated_images.source_type IS 'Where the original image came from: genius, wikipedia, spotify, manual';
COMMENT ON COLUMN artist_generated_images.is_approved IS 'Manual approval gate before using in GRC-20 mint';
COMMENT ON COLUMN artist_generated_images.is_used_in_grc20 IS 'Tracks if this image was minted to GRC-20';
COMMENT ON COLUMN artist_generated_images.grove_uri IS 'Grove URI if uploaded to Grove for permanent storage';
