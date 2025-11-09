-- Migration 008: GRC-20 Source Facts & Resolution Helpers
-- Purpose:
--  * Create canonical views for artists/works derived from tracks
--  * Introduce staging tables capturing per-field source facts
--  * Store resolution priority metadata and discrepancy logs
--  * Provide SQL functions to resolve definitive values with provenance

-- ============================================================================
-- Canonical Views (derived from existing track metadata)
-- ============================================================================

CREATE OR REPLACE VIEW canonical_artists AS
SELECT DISTINCT
  t.primary_artist_id   AS spotify_artist_id,
  t.primary_artist_name AS primary_name,
  max_sa.images->0->>'url' AS image_url
FROM tracks t
LEFT JOIN spotify_artists max_sa
  ON max_sa.spotify_artist_id = t.primary_artist_id
WHERE t.primary_artist_id IS NOT NULL;

COMMENT ON VIEW canonical_artists IS 'Distinct primary artists observed in tracks table with cached Spotify metadata where available.';

CREATE OR REPLACE VIEW canonical_works AS
SELECT DISTINCT
  t.spotify_track_id,
  t.title              AS primary_title,
  t.primary_artist_id  AS primary_artist_id,
  t.primary_artist_name AS primary_artist_name
FROM tracks t
WHERE t.spotify_track_id IS NOT NULL;

COMMENT ON VIEW canonical_works IS 'Distinct works (tracks) observed in pipeline with reference to their primary artist.';

-- ============================================================================
-- Source Fact Staging Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS artist_source_facts (
  spotify_artist_id TEXT NOT NULL,
  field_name        TEXT NOT NULL,
  source            TEXT NOT NULL,
  field_value       TEXT,
  confidence        NUMERIC(3,2) DEFAULT 1.00,
  fetched_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  raw_payload       JSONB,
  PRIMARY KEY (spotify_artist_id, field_name, source)
);

CREATE INDEX IF NOT EXISTS idx_artist_source_facts_artist
  ON artist_source_facts (spotify_artist_id);

CREATE INDEX IF NOT EXISTS idx_artist_source_facts_field
  ON artist_source_facts (field_name);

COMMENT ON TABLE artist_source_facts IS 'Per-field sourced values for artists with provenance and confidence weighting.';

CREATE TABLE IF NOT EXISTS work_source_facts (
  spotify_track_id  TEXT NOT NULL,
  field_name        TEXT NOT NULL,
  source            TEXT NOT NULL,
  field_value       TEXT,
  confidence        NUMERIC(3,2) DEFAULT 1.00,
  fetched_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  raw_payload       JSONB,
  PRIMARY KEY (spotify_track_id, field_name, source)
);

CREATE INDEX IF NOT EXISTS idx_work_source_facts_track
  ON work_source_facts (spotify_track_id);

CREATE INDEX IF NOT EXISTS idx_work_source_facts_field
  ON work_source_facts (field_name);

COMMENT ON TABLE work_source_facts IS 'Per-field sourced values for works/tracks with provenance and confidence weighting.';

-- ============================================================================
-- Resolution Metadata & Discrepancy Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS field_resolution_rules (
  entity_type TEXT NOT NULL,
  field_name  TEXT NOT NULL,
  priority    JSONB NOT NULL,
  consensus   JSONB,
  PRIMARY KEY (entity_type, field_name)
);

COMMENT ON TABLE field_resolution_rules IS 'Resolution strategy per entity/field including ordered source preference and optional consensus configuration.';

CREATE TABLE IF NOT EXISTS grc20_discrepancies (
  id            SERIAL PRIMARY KEY,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  field_name    TEXT NOT NULL,
  severity      TEXT NOT NULL,
  conflicting   JSONB NOT NULL,
  detected_at   TIMESTAMPTZ DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ,
  notes         TEXT
);

CREATE INDEX IF NOT EXISTS idx_grc20_discrepancies_entity
  ON grc20_discrepancies (entity_type, entity_id);

COMMENT ON TABLE grc20_discrepancies IS 'Logged conflicts uncovered during GRC-20 resolution. Auto-cleared when conflicts disappear on re-run.';

-- Seed minimal resolution priorities (can be extended in code or future migrations)

INSERT INTO field_resolution_rules (entity_type, field_name, priority, consensus)
VALUES
  ('artist', 'name', jsonb_build_object('order', ARRAY['spotify','musicbrainz','wikidata','quansic']), NULL)
ON CONFLICT DO NOTHING;

INSERT INTO field_resolution_rules (entity_type, field_name, priority, consensus)
VALUES
  ('artist', 'isni', jsonb_build_object('order', ARRAY['quansic','wikidata','musicbrainz']), jsonb_build_object('threshold', 0.9))
ON CONFLICT DO NOTHING;

INSERT INTO field_resolution_rules (entity_type, field_name, priority, consensus)
VALUES
  ('artist', 'spotify_url', jsonb_build_object('order', ARRAY['spotify','musicbrainz','wikidata']), NULL)
ON CONFLICT DO NOTHING;

INSERT INTO field_resolution_rules (entity_type, field_name, priority, consensus)
VALUES
  ('artist', 'image_url', jsonb_build_object('order', ARRAY['pipeline','spotify','musicbrainz','wikidata','genius']), NULL)
ON CONFLICT DO NOTHING;

INSERT INTO field_resolution_rules (entity_type, field_name, priority, consensus)
VALUES
  ('artist', 'image_grove_url', jsonb_build_object('order', ARRAY['pipeline']), NULL)
ON CONFLICT DO NOTHING;

INSERT INTO field_resolution_rules (entity_type, field_name, priority, consensus)
VALUES
  ('artist', 'image_grove_cid', jsonb_build_object('order', ARRAY['pipeline']), NULL)
ON CONFLICT DO NOTHING;

INSERT INTO field_resolution_rules (entity_type, field_name, priority, consensus)
VALUES
  ('artist', 'image_thumbnail_url', jsonb_build_object('order', ARRAY['pipeline']), NULL)
ON CONFLICT DO NOTHING;

INSERT INTO field_resolution_rules (entity_type, field_name, priority, consensus)
VALUES
  ('artist', 'image_thumbnail_cid', jsonb_build_object('order', ARRAY['pipeline']), NULL)
ON CONFLICT DO NOTHING;

INSERT INTO field_resolution_rules (entity_type, field_name, priority, consensus)
VALUES
  ('work', 'title', jsonb_build_object('order', ARRAY['quansic','musicbrainz_work','spotify','genius']), NULL)
ON CONFLICT DO NOTHING;

INSERT INTO field_resolution_rules (entity_type, field_name, priority, consensus)
VALUES
  ('work', 'iswc', jsonb_build_object('order', ARRAY['quansic','wikidata_work','musicbrainz_work','mlc']), jsonb_build_object('threshold', 0.9))
ON CONFLICT DO NOTHING;

INSERT INTO field_resolution_rules (entity_type, field_name, priority, consensus)
VALUES
  ('work', 'image_url', jsonb_build_object('order', ARRAY['pipeline','spotify_album','musicbrainz_work','wikidata_work']), NULL)
ON CONFLICT DO NOTHING;

INSERT INTO field_resolution_rules (entity_type, field_name, priority, consensus)
VALUES
  ('work', 'image_grove_url', jsonb_build_object('order', ARRAY['pipeline']), NULL)
ON CONFLICT DO NOTHING;

INSERT INTO field_resolution_rules (entity_type, field_name, priority, consensus)
VALUES
  ('work', 'image_grove_cid', jsonb_build_object('order', ARRAY['pipeline']), NULL)
ON CONFLICT DO NOTHING;

INSERT INTO field_resolution_rules (entity_type, field_name, priority, consensus)
VALUES
  ('work', 'image_thumbnail_url', jsonb_build_object('order', ARRAY['pipeline']), NULL)
ON CONFLICT DO NOTHING;

INSERT INTO field_resolution_rules (entity_type, field_name, priority, consensus)
VALUES
  ('work', 'image_thumbnail_cid', jsonb_build_object('order', ARRAY['pipeline']), NULL)
ON CONFLICT DO NOTHING;

INSERT INTO field_resolution_rules (entity_type, field_name, priority, consensus)
VALUES
  ('work', 'language', jsonb_build_object('order', ARRAY['lyrics','wikidata_work','musicbrainz_work','spotify']), NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Resolution Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION resolve_artist_field(p_artist_id TEXT, p_field TEXT)
RETURNS TABLE (
  value                TEXT,
  primary_source       TEXT,
  corroboration_score  NUMERIC,
  alternatives         JSONB,
  flags                TEXT[]
) AS $$
DECLARE
  priority_record JSONB;
  consensus_record JSONB;
  ordered_sources TEXT[];
BEGIN
  SELECT priority, consensus
    INTO priority_record, consensus_record
  FROM field_resolution_rules
  WHERE entity_type = 'artist'
    AND field_name = p_field;

  IF priority_record IS NULL THEN
    ordered_sources := ARRAY['quansic','wikidata','musicbrainz','genius','spotify'];
  ELSE
    ordered_sources := ARRAY(
      SELECT jsonb_array_elements_text(priority_record->'order')
    );
  END IF;

  RETURN QUERY
  WITH candidate AS (
    SELECT field_value, source, confidence
    FROM artist_source_facts
    WHERE spotify_artist_id = p_artist_id
      AND field_name = p_field
      AND field_value IS NOT NULL
  ),
  ranked AS (
    SELECT *,
           ROW_NUMBER() OVER (
             ORDER BY COALESCE(array_position(ordered_sources, source), 999), confidence DESC, source
           ) AS rank
    FROM candidate
  )
  SELECT
    (SELECT field_value FROM ranked WHERE rank = 1),
    (SELECT source FROM ranked WHERE rank = 1),
    COALESCE(
      (
        SELECT AVG(confidence)
        FROM candidate c
        WHERE c.field_value = (SELECT field_value FROM ranked WHERE rank = 1)
      ),
      0
    ),
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('source', source, 'value', field_value, 'confidence', confidence))
        FROM candidate
      ),
      '[]'::jsonb
    ),
    COALESCE(
      ARRAY_REMOVE(ARRAY[
        CASE
          WHEN (SELECT COUNT(*) FROM candidate) = 0 THEN 'no_data'
        END,
        CASE
          WHEN array_position(ordered_sources, 'quansic') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM candidate WHERE source = 'quansic')
               AND EXISTS (SELECT 1 FROM candidate WHERE source <> 'quansic')
            THEN 'quansic_missing'
        END,
        CASE
          WHEN EXISTS (
                 SELECT 1 FROM candidate c1
                 WHERE c1.field_value <> (SELECT field_value FROM ranked WHERE rank = 1)
                   AND c1.confidence >= 0.75
               )
            THEN 'conflict_detected'
        END
      ], NULL),
      ARRAY[]::TEXT[]
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION resolve_all_artist_fields(p_artist_id TEXT)
RETURNS TABLE (
  field_name          TEXT,
  value               TEXT,
  primary_source      TEXT,
  alternatives        JSONB,
  corroboration_score NUMERIC,
  flags               TEXT[]
) AS $$
  SELECT f.field_name,
         r.value,
         r.primary_source,
         r.alternatives,
         r.corroboration_score,
         r.flags
  FROM (
    SELECT DISTINCT field_name
    FROM artist_source_facts
    WHERE spotify_artist_id = p_artist_id
  ) f
  CROSS JOIN LATERAL resolve_artist_field(p_artist_id, f.field_name) AS r;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION resolve_work_field(p_track_id TEXT, p_field TEXT)
RETURNS TABLE (
  value                TEXT,
  primary_source       TEXT,
  corroboration_score  NUMERIC,
  alternatives         JSONB,
  flags                TEXT[]
) AS $$
DECLARE
  priority_record JSONB;
  consensus_record JSONB;
  ordered_sources TEXT[];
BEGIN
  SELECT priority, consensus
    INTO priority_record, consensus_record
  FROM field_resolution_rules
  WHERE entity_type = 'work'
    AND field_name = p_field;

  IF priority_record IS NULL THEN
    ordered_sources := ARRAY['quansic','wikidata_work','musicbrainz_work','spotify','genius'];
  ELSE
    ordered_sources := ARRAY(
      SELECT jsonb_array_elements_text(priority_record->'order')
    );
  END IF;

  RETURN QUERY
  WITH candidate AS (
    SELECT field_value, source, confidence
    FROM work_source_facts
    WHERE spotify_track_id = p_track_id
      AND field_name = p_field
      AND field_value IS NOT NULL
  ),
  ranked AS (
    SELECT *,
           ROW_NUMBER() OVER (
             ORDER BY COALESCE(array_position(ordered_sources, source), 999), confidence DESC, source
           ) AS rank
    FROM candidate
  )
  SELECT
    (SELECT field_value FROM ranked WHERE rank = 1),
    (SELECT source FROM ranked WHERE rank = 1),
    COALESCE(
      (
        SELECT AVG(confidence)
        FROM candidate c
        WHERE c.field_value = (SELECT field_value FROM ranked WHERE rank = 1)
      ),
      0
    ),
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('source', source, 'value', field_value, 'confidence', confidence))
        FROM candidate
      ),
      '[]'::jsonb
    ),
    COALESCE(
      ARRAY_REMOVE(ARRAY[
        CASE
          WHEN (SELECT COUNT(*) FROM candidate) = 0 THEN 'no_data'
        END,
        CASE
          WHEN array_position(ordered_sources, 'quansic') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM candidate WHERE source = 'quansic')
               AND EXISTS (SELECT 1 FROM candidate WHERE source <> 'quansic')
            THEN 'quansic_missing'
        END,
        CASE
          WHEN EXISTS (
                 SELECT 1 FROM candidate c1
                 WHERE c1.field_value <> (SELECT field_value FROM ranked WHERE rank = 1)
                   AND c1.confidence >= 0.75
               )
            THEN 'conflict_detected'
        END
      ], NULL),
      ARRAY[]::TEXT[]
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION resolve_all_work_fields(p_track_id TEXT)
RETURNS TABLE (
  field_name          TEXT,
  value               TEXT,
  primary_source      TEXT,
  alternatives        JSONB,
  corroboration_score NUMERIC,
  flags               TEXT[]
) AS $$
  SELECT f.field_name,
         r.value,
         r.primary_source,
         r.alternatives,
         r.corroboration_score,
         r.flags
  FROM (
    SELECT DISTINCT field_name
    FROM work_source_facts
    WHERE spotify_track_id = p_track_id
  ) f
  CROSS JOIN LATERAL resolve_work_field(p_track_id, f.field_name) AS r;
$$ LANGUAGE sql;

-- ============================================================================
-- Augment GRC-20 tables with evidence JSONB storage
-- ============================================================================

ALTER TABLE grc20_artists
  ADD COLUMN IF NOT EXISTS source_evidence JSONB;

ALTER TABLE grc20_works
  ADD COLUMN IF NOT EXISTS source_evidence JSONB;

ALTER TABLE grc20_artists
  ADD COLUMN IF NOT EXISTS image_grove_cid TEXT,
  ADD COLUMN IF NOT EXISTS image_grove_url TEXT;

ALTER TABLE grc20_artists
  ADD COLUMN IF NOT EXISTS image_thumbnail_cid TEXT,
  ADD COLUMN IF NOT EXISTS image_thumbnail_url TEXT;

ALTER TABLE grc20_works
  ADD COLUMN IF NOT EXISTS image_grove_cid TEXT,
  ADD COLUMN IF NOT EXISTS image_grove_url TEXT;

ALTER TABLE grc20_works
  ADD COLUMN IF NOT EXISTS image_thumbnail_cid TEXT,
  ADD COLUMN IF NOT EXISTS image_thumbnail_url TEXT;
