-- BMI Works Table Schema
-- Stores work metadata from BMI Songview scraper

CREATE TABLE IF NOT EXISTS bmi_works (
  -- Primary Key: BMI's work identifier
  bmi_work_id TEXT PRIMARY KEY,

  -- Core identifiers
  iswc TEXT,                           -- International Standard Musical Work Code
  ascap_work_id TEXT,                  -- ASCAP work ID (cross-PRO reference)
  title TEXT NOT NULL,

  -- Writer data (JSONB array)
  -- Structure: [{ name: string, affiliation: string, ipi: string }]
  writers JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Publisher data (JSONB array)
  -- Structure: [{
  --   name: string,
  --   affiliation: string,
  --   ipi: string,
  --   parent_publisher?: string,
  --   address?: string,
  --   phone?: string,
  --   email?: string,
  --   website?: string
  -- }]
  publishers JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Performer data (simple string array)
  -- Structure: ["SABRINA CARPENTER", "KIDZ BOP KIDS", ...]
  performers JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Ownership shares (JSONB object)
  -- Structure: { "BMI": "50.01%", "ASCAP": "50%", "Other": "23.75%" }
  shares JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Work status
  status TEXT CHECK (status IN ('RECONCILED', 'UNDER_REVIEW')),
  status_description TEXT,

  -- Raw BMI Songview response (complete data for debugging)
  raw_data JSONB NOT NULL,

  -- Timestamps
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bmi_works_iswc
  ON bmi_works(iswc) WHERE iswc IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bmi_works_ascap_id
  ON bmi_works(ascap_work_id) WHERE ascap_work_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bmi_works_title
  ON bmi_works(title);

CREATE INDEX IF NOT EXISTS idx_bmi_works_status
  ON bmi_works(status) WHERE status IS NOT NULL;

-- GIN indexes for JSONB search (efficient for querying nested data)
CREATE INDEX IF NOT EXISTS idx_bmi_works_writers
  ON bmi_works USING gin(writers);

CREATE INDEX IF NOT EXISTS idx_bmi_works_publishers
  ON bmi_works USING gin(publishers);

CREATE INDEX IF NOT EXISTS idx_bmi_works_performers
  ON bmi_works USING gin(performers);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_bmi_works_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bmi_works_updated_at
  BEFORE UPDATE ON bmi_works
  FOR EACH ROW
  EXECUTE FUNCTION update_bmi_works_updated_at();

-- Example queries for validation

-- Find works with both BMI and MLC data
-- SELECT
--   bw.bmi_work_id,
--   bw.iswc,
--   bw.title,
--   bw.status as bmi_status,
--   bw.shares as bmi_shares,
--   mw.mlc_song_code,
--   mw.total_publisher_share as mlc_share
-- FROM bmi_works bw
-- JOIN mlc_works mw ON bw.iswc = mw.iswc
-- WHERE bw.status = 'RECONCILED'
--   AND mw.total_publisher_share >= 98;

-- Find works missing in BMI but present in Quansic
-- SELECT qw.iswc, qw.title
-- FROM quansic_works qw
-- LEFT JOIN bmi_works bw ON qw.iswc = bw.iswc
-- WHERE bw.bmi_work_id IS NULL
-- LIMIT 10;

-- Search for works by writer IPI
-- SELECT bmi_work_id, title, iswc, writers
-- FROM bmi_works
-- WHERE writers @> '[{"ipi": "00662307358"}]'::jsonb;
