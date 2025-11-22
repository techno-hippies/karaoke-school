-- Extend genius_artists with columns needed by enrichment task

ALTER TABLE genius_artists
  ADD COLUMN IF NOT EXISTS alternate_names TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_meme_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS followers_count INTEGER,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS api_path TEXT,
  ADD COLUMN IF NOT EXISTS raw_data JSONB;
