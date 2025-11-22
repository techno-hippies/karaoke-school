/**
 * Artist Tasks State Management
 *
 * Purpose: Track per-artist pipeline operations with explicit state
 *
 * Architecture:
 * - artist_tasks: Per-artist operations (enrichment + identity + monetization)
 * - audio_tasks: Per-track operations (processing + encryption)
 *
 * Task Types:
 * - Enrichment: spotify_enrichment, quansic_enrichment, wikidata_enrichment, genius_enrichment
 * - Identity: mint_pkp, create_lens
 * - Monetization: deploy_unlock
 *
 * Status Values:
 * - pending: Not started yet
 * - in_progress: Currently running
 * - completed: Successfully finished
 * - failed: Failed (may retry if retry_count < max_retries)
 * - skipped: Not applicable (e.g., no MusicBrainz match found)
 */

import { query } from './connection';

// ============================================================================
// Types
// ============================================================================

export type ArtistTaskType =
  | 'spotify_enrichment'
  | 'quansic_enrichment'
  | 'wikidata_enrichment'
  | 'genius_enrichment'
  | 'mint_pkp'
  | 'create_lens'
  | 'deploy_unlock';

export type ArtistTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface ArtistTask {
  id: number;
  spotify_artist_id: string;
  task_type: ArtistTaskType;
  status: ArtistTaskStatus;
  result_data: any | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export interface ArtistTaskSummary {
  spotify_artist_id: string;
  artist_name: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  pending_tasks: number;
}

// ============================================================================
// Task Creation & Updates
// ============================================================================

/**
 * Create or reset an artist task to pending status
 *
 * Use this to queue a new task or requeue a failed task.
 * If the task already exists, it resets to pending with cleared errors.
 *
 * @param artistId - Spotify artist ID
 * @param taskType - Type of task to create
 * @param maxRetries - Maximum retry attempts (default: 3)
 */
export async function createArtistTask(
  artistId: string,
  taskType: ArtistTaskType,
  maxRetries: number = 3
): Promise<void> {
  await query(
    `INSERT INTO artist_tasks (spotify_artist_id, task_type, status, max_retries)
     VALUES ($1, $2, 'pending', $3)
     ON CONFLICT (spotify_artist_id, task_type)
     DO UPDATE SET
       status = 'pending',
       error_message = NULL,
       retry_count = 0,
       result_data = NULL,
       completed_at = NULL,
       updated_at = NOW()`,
    [artistId, taskType, maxRetries]
  );
}

/**
 * Mark task as in progress
 *
 * Call this when starting work on a task.
 *
 * @param artistId - Spotify artist ID
 * @param taskType - Type of task
 */
export async function startArtistTask(
  artistId: string,
  taskType: ArtistTaskType
): Promise<void> {
  await query(
    `UPDATE artist_tasks
     SET status = 'in_progress',
         updated_at = NOW()
     WHERE spotify_artist_id = $1 AND task_type = $2`,
    [artistId, taskType]
  );
}

/**
 * Mark task as completed
 *
 * Call this when a task finishes successfully.
 * Optionally store summary data (PKP address, lens handle, etc.)
 *
 * @param artistId - Spotify artist ID
 * @param taskType - Type of task
 * @param resultData - Optional summary data for dashboards (PKP address, MBID, etc.)
 */
export async function completeArtistTask(
  artistId: string,
  taskType: ArtistTaskType,
  resultData?: any
): Promise<void> {
  await query(
    `UPDATE artist_tasks
     SET status = 'completed',
         result_data = $3,
         completed_at = NOW(),
         updated_at = NOW()
     WHERE spotify_artist_id = $1 AND task_type = $2`,
    [artistId, taskType, resultData ? JSON.stringify(resultData) : null]
  );
}

/**
 * Mark task as failed
 *
 * Call this when a task encounters an error.
 * Automatically increments retry_count.
 *
 * @param artistId - Spotify artist ID
 * @param taskType - Type of task
 * @param errorMessage - Error description
 */
export async function failArtistTask(
  artistId: string,
  taskType: ArtistTaskType,
  errorMessage: string
): Promise<void> {
  await query(
    `UPDATE artist_tasks
     SET status = 'failed',
         error_message = $3,
         retry_count = retry_count + 1,
         updated_at = NOW()
     WHERE spotify_artist_id = $1 AND task_type = $2`,
    [artistId, taskType, errorMessage]
  );
}

/**
 * Mark task as skipped (not applicable)
 *
 * Use this for cases like "no MusicBrainz match found" where the task
 * is not applicable but this is not an error condition.
 *
 * @param artistId - Spotify artist ID
 * @param taskType - Type of task
 * @param reason - Why the task was skipped
 */
export async function skipArtistTask(
  artistId: string,
  taskType: ArtistTaskType,
  reason: string
): Promise<void> {
  await query(
    `UPDATE artist_tasks
     SET status = 'skipped',
         result_data = $3,
         completed_at = NOW(),
         updated_at = NOW()
     WHERE spotify_artist_id = $1 AND task_type = $2`,
    [artistId, taskType, JSON.stringify({ reason })]
  );
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Find artists needing a specific task
 *
 * Returns artists that either:
 * 1. Have never attempted this task (no row in artist_tasks)
 * 2. Failed and have retries remaining
 *
 * Only includes artists that have karaoke content.
 *
 * @param taskType - Type of task to find
 * @param limit - Maximum number of artists to return
 * @returns Array of Spotify artist IDs
 */
export async function findArtistsForTask(
  taskType: ArtistTaskType,
  limit: number = 20
): Promise<string[]> {
  const results = await query<{ spotify_artist_id: string }>(
    `SELECT sa.spotify_artist_id
     FROM spotify_artists sa
     WHERE EXISTS (
       -- Only include artists with karaoke content
       SELECT 1 FROM karaoke_segments ks
       JOIN tracks t ON t.spotify_track_id = ks.spotify_track_id
       WHERE t.primary_artist_id = sa.spotify_artist_id
     )
     AND (
       -- Never attempted
       NOT EXISTS (
         SELECT 1 FROM artist_tasks at
         WHERE at.spotify_artist_id = sa.spotify_artist_id
           AND at.task_type = $1
       )
       OR
       -- Failed with retries remaining
       EXISTS (
         SELECT 1 FROM artist_tasks at
         WHERE at.spotify_artist_id = sa.spotify_artist_id
           AND at.task_type = $1
           AND at.status = 'failed'
           AND at.retry_count < at.max_retries
       )
     )
     ORDER BY sa.spotify_artist_id
     LIMIT $2`,
    [taskType, limit]
  );

  return results.map(r => r.spotify_artist_id);
}

/**
 * Check if an artist has completed a specific task
 *
 * @param artistId - Spotify artist ID
 * @param taskType - Type of task to check
 * @returns True if task is completed
 */
export async function hasCompletedTask(
  artistId: string,
  taskType: ArtistTaskType
): Promise<boolean> {
  const results = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM artist_tasks
       WHERE spotify_artist_id = $1
         AND task_type = $2
         AND status = 'completed'
     ) as exists`,
    [artistId, taskType]
  );

  return results[0].exists;
}

/**
 * Get task status for an artist
 *
 * @param artistId - Spotify artist ID
 * @param taskType - Type of task
 * @returns Task details or null if not found
 */
export async function getArtistTask(
  artistId: string,
  taskType: ArtistTaskType
): Promise<ArtistTask | null> {
  const results = await query<ArtistTask>(
    `SELECT * FROM artist_tasks
     WHERE spotify_artist_id = $1 AND task_type = $2`,
    [artistId, taskType]
  );

  return results.length > 0 ? results[0] : null;
}

/**
 * Get all tasks for an artist
 *
 * @param artistId - Spotify artist ID
 * @returns Array of tasks
 */
export async function getArtistTasks(artistId: string): Promise<ArtistTask[]> {
  return await query<ArtistTask>(
    `SELECT * FROM artist_tasks
     WHERE spotify_artist_id = $1
     ORDER BY
       CASE task_type
         WHEN 'spotify_enrichment' THEN 1
         WHEN 'quansic_enrichment' THEN 2
         WHEN 'wikidata_enrichment' THEN 3
         WHEN 'genius_enrichment' THEN 4
         WHEN 'mint_pkp' THEN 5
         WHEN 'create_lens' THEN 6
         WHEN 'deploy_unlock' THEN 7
       END`,
    [artistId]
  );
}

/**
 * Get pipeline progress summary for artists
 *
 * Shows how many tasks each artist has completed vs. pending/failed.
 *
 * @param limit - Maximum number of artists to return
 * @returns Array of artist summaries
 */
export async function getArtistPipelineProgress(
  limit: number = 50
): Promise<ArtistTaskSummary[]> {
  return await query<ArtistTaskSummary>(
    `SELECT
       sa.spotify_artist_id,
       sa.name as artist_name,
       COUNT(at.id) as total_tasks,
       COUNT(CASE WHEN at.status = 'completed' THEN 1 END) as completed_tasks,
       COUNT(CASE WHEN at.status = 'failed' THEN 1 END) as failed_tasks,
       COUNT(CASE WHEN at.status = 'pending' THEN 1 END) as pending_tasks
     FROM spotify_artists sa
     LEFT JOIN artist_tasks at ON at.spotify_artist_id = sa.spotify_artist_id
     WHERE EXISTS (
       SELECT 1 FROM karaoke_segments ks
       JOIN tracks t ON t.spotify_track_id = ks.spotify_track_id
       WHERE t.primary_artist_id = sa.spotify_artist_id
     )
     GROUP BY sa.spotify_artist_id, sa.name
     HAVING COUNT(at.id) > 0
     ORDER BY
       (COUNT(CASE WHEN at.status = 'completed' THEN 1 END)::FLOAT / NULLIF(COUNT(at.id), 0)) ASC,
       sa.name
     LIMIT $1`,
    [limit]
  );
}

/**
 * Count artists by task status
 *
 * Useful for dashboard metrics.
 *
 * @param taskType - Type of task
 * @returns Count of artists at each status
 */
export async function countArtistsByTaskStatus(
  taskType: ArtistTaskType
): Promise<{ status: ArtistTaskStatus; count: number }[]> {
  return await query<{ status: ArtistTaskStatus; count: number }>(
    `SELECT status, COUNT(*)::INTEGER as count
     FROM artist_tasks
     WHERE task_type = $1
     GROUP BY status
     ORDER BY
       CASE status
         WHEN 'completed' THEN 1
         WHEN 'in_progress' THEN 2
         WHEN 'pending' THEN 3
         WHEN 'failed' THEN 4
         WHEN 'skipped' THEN 5
       END`,
    [taskType]
  );
}

// ============================================================================
// Dependency Queries
// ============================================================================

/**
 * Find artists ready for Lens account creation
 *
 * Requirements:
 * - PKP minting completed
 * - Lens account not yet created
 *
 * @param limit - Maximum number of artists to return
 * @returns Array of Spotify artist IDs
 */
export async function findArtistsReadyForLens(
  limit: number = 20
): Promise<string[]> {
  const results = await query<{ spotify_artist_id: string }>(
    `SELECT DISTINCT at_pkp.spotify_artist_id
     FROM artist_tasks at_pkp
     WHERE at_pkp.task_type = 'mint_pkp'
       AND at_pkp.status = 'completed'
       AND NOT EXISTS (
         SELECT 1 FROM artist_tasks at_lens
         WHERE at_lens.spotify_artist_id = at_pkp.spotify_artist_id
           AND at_lens.task_type = 'create_lens'
           AND at_lens.status = 'completed'
       )
     LIMIT $1`,
    [limit]
  );

  return results.map(r => r.spotify_artist_id);
}

/**
 * Find artists ready for Unlock lock deployment
 *
 * Requirements:
 * - Lens account created
 * - Unlock lock not yet deployed
 *
 * @param limit - Maximum number of artists to return
 * @returns Array of Spotify artist IDs
 */
export async function findArtistsReadyForUnlock(
  limit: number = 20
): Promise<string[]> {
  const results = await query<{ spotify_artist_id: string }>(
    `SELECT DISTINCT at_lens.spotify_artist_id
     FROM artist_tasks at_lens
     WHERE at_lens.task_type = 'create_lens'
       AND at_lens.status = 'completed'
       AND NOT EXISTS (
         SELECT 1 FROM artist_tasks at_unlock
         WHERE at_unlock.spotify_artist_id = at_lens.spotify_artist_id
           AND at_unlock.task_type = 'deploy_unlock'
           AND at_unlock.status = 'completed'
       )
     LIMIT $1`,
    [limit]
  );

  return results.map(r => r.spotify_artist_id);
}
