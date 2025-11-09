/**
 * Migration 003: Artist Tasks State Management
 *
 * Purpose: Add explicit state tracking for artist-level operations
 *
 * Architecture:
 * - audio_tasks: Track-level operations (download → encrypt)
 * - artist_tasks: Artist-level operations (enrichment → identity → monetization)
 *
 * Two-tier state model:
 * - Per-track: audio_tasks (processing + encryption)
 * - Per-artist: artist_tasks (enrichment + PKP + Lens + Unlock)
 *
 * Dependencies:
 * - Segment encryption requires artist unlock lock deployment
 * - Lens account requires PKP minting
 * - Unlock lock requires Lens account
 *
 * Created: 2025-01-08
 */

BEGIN;

-- ============================================================================
-- 1. Create artist_tasks Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS artist_tasks (
  id SERIAL PRIMARY KEY,
  spotify_artist_id TEXT NOT NULL REFERENCES spotify_artists(spotify_artist_id) ON DELETE CASCADE,

  -- Task type: enrichment, identity, monetization
  task_type TEXT NOT NULL CHECK (task_type IN (
    -- Enrichment (optional, best-effort)
    'spotify_enrichment',
    'quansic_enrichment',
    'wikidata_enrichment',
    'genius_enrichment',
    -- Identity (required for monetization)
    'mint_pkp',
    'create_lens',
    -- Monetization (required for segment encryption)
    'deploy_unlock'
  )),

  -- Task status
  status TEXT NOT NULL CHECK (status IN (
    'pending',      -- Not started yet
    'in_progress',  -- Currently running
    'completed',    -- Successfully finished
    'failed',       -- Failed (may retry)
    'skipped'       -- Not applicable (e.g., no MusicBrainz match)
  )) DEFAULT 'pending',

  -- Result data (PKP address, lens handle, lock address, MBIDs, etc.)
  -- This is a summary for quick lookups; canonical data lives in dedicated tables
  result_data JSONB,

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- One task per artist per type
  UNIQUE(spotify_artist_id, task_type)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_artist_tasks_status ON artist_tasks(status, task_type);
CREATE INDEX IF NOT EXISTS idx_artist_tasks_artist ON artist_tasks(spotify_artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_tasks_type_status ON artist_tasks(task_type, status);

COMMENT ON TABLE artist_tasks IS 'State tracking for per-artist operations (enrichment, identity, monetization)';
COMMENT ON COLUMN artist_tasks.result_data IS 'Summary data for dashboards (PKP address, lens handle, etc.) - canonical data in dedicated tables';
COMMENT ON COLUMN artist_tasks.status IS 'pending=not started, in_progress=running, completed=success, failed=error, skipped=not applicable';

-- ============================================================================
-- 2. Backfill Completed Tasks from Existing Data
-- ============================================================================

-- PKP minting (from pkp_accounts)
INSERT INTO artist_tasks (spotify_artist_id, task_type, status, completed_at, result_data)
SELECT
  spotify_artist_id,
  'mint_pkp',
  'completed',
  created_at,
  jsonb_build_object(
    'pkp_address', pkp_address,
    'pkp_token_id', pkp_token_id,
    'transaction_hash', transaction_hash
  )
FROM pkp_accounts
WHERE account_type = 'artist' AND spotify_artist_id IS NOT NULL
ON CONFLICT (spotify_artist_id, task_type) DO NOTHING;

-- Lens account creation (from lens_accounts)
INSERT INTO artist_tasks (spotify_artist_id, task_type, status, completed_at, result_data)
SELECT
  spotify_artist_id,
  'create_lens',
  'completed',
  created_at,
  jsonb_build_object(
    'lens_handle', lens_handle,
    'lens_account_address', lens_account_address,
    'lens_account_id', lens_account_id,
    'transaction_hash', transaction_hash
  )
FROM lens_accounts
WHERE account_type = 'artist' AND spotify_artist_id IS NOT NULL
ON CONFLICT (spotify_artist_id, task_type) DO NOTHING;

-- Unlock lock deployment (from lens_accounts with lock address)
INSERT INTO artist_tasks (spotify_artist_id, task_type, status, completed_at, result_data)
SELECT
  spotify_artist_id,
  'deploy_unlock',
  'completed',
  updated_at,
  jsonb_build_object(
    'subscription_lock_address', subscription_lock_address,
    'subscription_lock_chain', subscription_lock_chain
  )
FROM lens_accounts
WHERE account_type = 'artist'
  AND spotify_artist_id IS NOT NULL
  AND subscription_lock_address IS NOT NULL
ON CONFLICT (spotify_artist_id, task_type) DO NOTHING;

-- Quansic enrichment (musicbrainz ↔ quansic name match with Spotify mapping)
INSERT INTO artist_tasks (spotify_artist_id, task_type, status, completed_at, result_data)
SELECT DISTINCT ON (mba.spotify_id)
  mba.spotify_id,
  'quansic_enrichment',
  'completed',
  COALESCE(qa.updated_at, qa.created_at, mba.updated_at, mba.created_at, NOW()),
  jsonb_build_object(
    'musicbrainz_id', mba.artist_mbid,
    'name', mba.name,
    'isni', qa.isni,
    'ipi', qa.ipi
  )
FROM musicbrainz_artists mba
JOIN quansic_artists qa ON LOWER(qa.artist_name) = LOWER(mba.name)
WHERE mba.spotify_id IS NOT NULL
ORDER BY mba.spotify_id, COALESCE(qa.updated_at, qa.created_at, mba.updated_at, mba.created_at) DESC
ON CONFLICT (spotify_artist_id, task_type) DO NOTHING;

-- Wikidata enrichment (from wikidata_artists with spotify_id column)
INSERT INTO artist_tasks (spotify_artist_id, task_type, status, completed_at, result_data)
SELECT
  spotify_id,
  'wikidata_enrichment',
  'completed',
  created_at,
  jsonb_build_object(
    'wikidata_id', wikidata_id,
    'name', name,
    'isni', isni
  )
FROM wikidata_artists
WHERE spotify_id IS NOT NULL
ON CONFLICT (spotify_artist_id, task_type) DO NOTHING;

-- Genius enrichment (track-linked mappings from genius_songs)
INSERT INTO artist_tasks (spotify_artist_id, task_type, status, completed_at, result_data)
SELECT DISTINCT ON (t.primary_artist_id)
  t.primary_artist_id,
  'genius_enrichment',
  'completed',
  COALESCE(ga.updated_at, ga.created_at, gs.updated_at, gs.created_at, NOW()),
  jsonb_build_object(
    'genius_artist_id', ga.genius_artist_id,
    'name', ga.name,
    'url', ga.url
  )
FROM genius_songs gs
JOIN tracks t ON t.spotify_track_id = gs.spotify_track_id
JOIN genius_artists ga ON ga.genius_artist_id = gs.genius_artist_id
WHERE gs.spotify_track_id IS NOT NULL
  AND t.primary_artist_id IS NOT NULL
  AND ga.genius_artist_id IS NOT NULL
ORDER BY t.primary_artist_id, COALESCE(ga.updated_at, ga.created_at, gs.updated_at, gs.created_at) DESC
ON CONFLICT (spotify_artist_id, task_type) DO NOTHING;

-- ============================================================================
-- 3. Extend audio_tasks to Include Encryption
-- ============================================================================

-- Add 'encrypt' to audio_tasks task_type enum
ALTER TABLE audio_tasks
  DROP CONSTRAINT IF EXISTS audio_tasks_task_type_check;

ALTER TABLE audio_tasks
  ADD CONSTRAINT audio_tasks_task_type_check
    CHECK (task_type IN (
      'download',
      'align',
      'translate',
      'separate',
      'segment',
      'enhance',
      'clip',
      'encrypt'  -- NEW: Lit Protocol encryption of full-length segments
    ));

COMMENT ON CONSTRAINT audio_tasks_task_type_check ON audio_tasks IS 'Track-level tasks: audio processing (download→clip) + encryption (encrypt)';

COMMIT;
