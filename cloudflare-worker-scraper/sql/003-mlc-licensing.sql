-- ========================================
-- MLC (MECHANICAL LICENSING COLLECTIVE) TABLES
-- ========================================
--
-- This migration adds tables for MLC licensing data
-- Used for Story Protocol compliance (requires ≥98% publisher share)
--
-- Design principle: JSONB-first schema with indexed columns
-- ========================================

-- ========================================
-- 1. MLC_WORKS
-- Composition/work data from The MLC
-- ========================================
CREATE TABLE IF NOT EXISTS mlc_works (
  mlc_song_code TEXT PRIMARY KEY, -- MLC's unique song code (e.g., "AD3CCC")

  -- Work metadata
  title TEXT NOT NULL,
  iswc TEXT, -- International Standard Musical Work Code

  -- Total publisher share (direct + administrator)
  total_publisher_share NUMERIC(5, 2) DEFAULT 0,

  -- Writers array (JSONB)
  writers JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{name, ipi, role, share}]

  -- Publishers array (JSONB)
  publishers JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{name, ipi, share, administrators: [{name, ipi, share}]}]

  -- Full API response (JSONB for flexibility)
  raw_data JSONB NOT NULL,

  -- Timestamps
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mlc_works_iswc ON mlc_works(iswc) WHERE iswc IS NOT NULL;
CREATE INDEX idx_mlc_works_title ON mlc_works(title);

-- GIN index for searching writers/publishers
CREATE INDEX idx_mlc_works_writers ON mlc_works USING GIN (writers);
CREATE INDEX idx_mlc_works_publishers ON mlc_works USING GIN (publishers);

-- ========================================
-- 2. MLC_RECORDINGS
-- ISRC → MLC work mapping (discovered alternate ISRCs)
-- ========================================
CREATE TABLE IF NOT EXISTS mlc_recordings (
  isrc TEXT PRIMARY KEY,

  -- Foreign key to mlc_works
  mlc_song_code TEXT NOT NULL REFERENCES mlc_works(mlc_song_code) ON DELETE CASCADE,

  -- Full API response (kept for reference, though minimal data)
  raw_data JSONB,

  -- Timestamps
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mlc_recordings_song_code ON mlc_recordings(mlc_song_code);

-- ========================================
-- TRIGGERS for updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_mlc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mlc_works_updated_at
  BEFORE UPDATE ON mlc_works
  FOR EACH ROW EXECUTE FUNCTION update_mlc_updated_at();

CREATE TRIGGER update_mlc_recordings_updated_at
  BEFORE UPDATE ON mlc_recordings
  FOR EACH ROW EXECUTE FUNCTION update_mlc_updated_at();

-- ========================================
-- SUCCESS MESSAGE
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '✅ MLC licensing tables created successfully!';
  RAISE NOTICE '   - mlc_works (compositions with writers, publishers for ISWC corroboration)';
  RAISE NOTICE '   - mlc_recordings (ISRC → work mapping, discovers alternate ISRCs)';
END $$;
