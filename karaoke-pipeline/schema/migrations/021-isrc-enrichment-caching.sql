/**
 * Migration: ISRC Enrichment Caching Architecture
 *
 * Renames quansic_cache → recording_enrichment_cache (stores lookup attempt results)
 * Creates bmi_works table for BMI success cache
 * Enables processor to avoid redundant API calls for both Quansic and BMI
 */

-- Step 1: Rename quansic_cache to recording_enrichment_cache
-- Stores ISRC lookup results from both Quansic and BMI attempts
ALTER TABLE IF EXISTS quansic_cache RENAME TO recording_enrichment_cache;

-- Step 2: Add columns if they don't exist
ALTER TABLE recording_enrichment_cache
ADD COLUMN IF NOT EXISTS lookup_status TEXT CHECK (lookup_status IN ('success', 'not_found')),
ADD COLUMN IF NOT EXISTS attempted_sources TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS cached_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Step 3: Create bmi_works table for BMI lookup successes
-- Mirrors the bmi-service schema for caching BMI work data
CREATE TABLE IF NOT EXISTS bmi_works (
  iswc TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  bmi_work_id TEXT,
  ascap_work_id TEXT,

  -- Metadata
  artists JSONB,
  writers JSONB,
  publishers JSONB,
  performers JSONB,
  shares JSONB,

  -- Status
  status TEXT CHECK (status IN ('RECONCILED', 'UNDER_REVIEW')),

  -- Raw response for debugging
  raw_data JSONB,

  -- Timestamps
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bmi_works_iswc
  ON bmi_works(iswc) WHERE iswc IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bmi_works_bmi_work_id
  ON bmi_works(bmi_work_id) WHERE bmi_work_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bmi_works_status
  ON bmi_works(status) WHERE status IS NOT NULL;

-- Step 4: Create index on recording_enrichment_cache for fast lookups
CREATE INDEX IF NOT EXISTS idx_recording_enrichment_cache_isrc
  ON recording_enrichment_cache(isrc);

CREATE INDEX IF NOT EXISTS idx_recording_enrichment_cache_status
  ON recording_enrichment_cache(lookup_status);

-- Step 5: Update trigger for bmi_works updated_at
CREATE OR REPLACE FUNCTION update_bmi_works_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS bmi_works_updated_at
  BEFORE UPDATE ON bmi_works
  FOR EACH ROW
  EXECUTE FUNCTION update_bmi_works_updated_at();
