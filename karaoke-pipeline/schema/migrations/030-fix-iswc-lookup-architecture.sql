-- Migration 030: Fix ISWC Lookup Architecture
-- Purpose: Optimize cache tables for ISRC-based lookups and add failure tracking

-- 1. Add ISRC column to bmi_works (currently keyed by ISWC which doesn't help for lookups)
ALTER TABLE bmi_works ADD COLUMN IF NOT EXISTS isrc TEXT;

-- Create index on ISRC for fast lookups
CREATE INDEX IF NOT EXISTS idx_bmi_works_isrc ON bmi_works(isrc) WHERE isrc IS NOT NULL;

-- 2. Create ISRC index on mlc_works for faster single-ISRC lookups
CREATE INDEX IF NOT EXISTS idx_mlc_works_isrc ON mlc_works(isrc);

-- 3. Create failure tracking table
CREATE TABLE IF NOT EXISTS iswc_lookup_failures (
  isrc TEXT PRIMARY KEY,
  attempted_sources TEXT[] NOT NULL DEFAULT '{}',
  last_attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iswc_failures_attempted
  ON iswc_lookup_failures(last_attempted_at DESC);

-- 4. Add helpful comments
COMMENT ON TABLE iswc_lookup_failures IS 'Tracks ISRCs where ISWC lookup failed across all sources (Quansic, BMI, MLC). Prevents redundant API calls.';
COMMENT ON COLUMN iswc_lookup_failures.attempted_sources IS 'Array of sources tried: [''quansic'', ''bmi'', ''mlc'']';
COMMENT ON COLUMN iswc_lookup_failures.last_attempted_at IS 'Last attempt timestamp. Re-try after 7 days.';
