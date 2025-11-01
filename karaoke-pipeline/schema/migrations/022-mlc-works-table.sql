/**
 * Migration: Add MLC Works Table
 *
 * Creates mlc_works table for MLC (Mechanical Licensing Collective) lookup successes
 * Used as fallback when Quansic and BMI don't have ISWC data
 */

-- Create mlc_works table for MLC lookup successes
CREATE TABLE IF NOT EXISTS mlc_works (
  isrc TEXT NOT NULL,
  mlc_song_code TEXT NOT NULL,
  iswc TEXT,
  title TEXT NOT NULL,

  -- Metadata
  writers JSONB,
  publishers JSONB,
  total_publisher_share NUMERIC,

  -- Raw response for debugging
  raw_data JSONB,

  -- Timestamps
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Composite primary key (ISRC can map to multiple works)
  PRIMARY KEY (isrc, mlc_song_code)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_mlc_works_isrc
  ON mlc_works(isrc);

CREATE INDEX IF NOT EXISTS idx_mlc_works_iswc
  ON mlc_works(iswc) WHERE iswc IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mlc_works_song_code
  ON mlc_works(mlc_song_code);

-- Update trigger for mlc_works updated_at
CREATE OR REPLACE FUNCTION update_mlc_works_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mlc_works_updated_at
  BEFORE UPDATE ON mlc_works
  FOR EACH ROW
  EXECUTE FUNCTION update_mlc_works_updated_at();
