-- Direct Karafun CSV Import
-- Simplified approach: import CSV directly into staging, then insert into proper tables

-- Create staging table for raw Karafun data
CREATE TEMP TABLE karafun_staging (
  id INTEGER,
  title TEXT,
  artist TEXT,
  year INTEGER,
  duo BOOLEAN,
  explicit BOOLEAN,
  date_added DATE,
  styles TEXT,
  languages TEXT
);

-- Import CSV using COPY
-- Run from command line:
-- psql <connection-string> -c "\COPY karafun_staging FROM '/media/t42/th42/Code/karaoke-school-v1/karafuncatalog.csv' WITH (FORMAT csv, DELIMITER ';', HEADER true);"

-- Insert into recordings table (English only, simplified)
INSERT INTO recordings (
  title,
  artist_name,
  release_year,
  is_karaoke_popular,
  karaoke_popularity_score
)
SELECT
  title,
  artist,
  CASE WHEN year >= 1900 THEN year ELSE NULL END,
  true,
  100000 - id  -- Lower ID = more popular in Karafun
FROM karafun_staging
WHERE languages = 'English'
ON CONFLICT (title, artist_name) DO UPDATE SET
  is_karaoke_popular = true,
  karaoke_popularity_score = GREATEST(EXCLUDED.karaoke_popularity_score, recordings.karaoke_popularity_score);
