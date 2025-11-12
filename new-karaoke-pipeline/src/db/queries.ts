/**
 * Reusable Database Queries
 * Common queries used across the pipeline
 */

import { query } from './connection';

// ============================================================================
// Track Queries
// ============================================================================

export interface Track {
  spotify_track_id: string;
  tiktok_video_id: string | null;  // NULL for manual Spotify tracks, non-NULL for TikTok-sourced
  title: string;
  artists: Array<{ id: string; name: string }>;
  primary_artist_id: string | null;
  primary_artist_name: string | null;
  isrc: string | null;
  stage: string;
  has_iswc: boolean;
  has_lyrics: boolean;
  has_audio: boolean;
  source_type?: 'tiktok' | 'manual_spotify';  // Track origin (TikTok discovery vs. manual submission)
}

/**
 * Get tracks by stage
 */
export async function getTracksByStage(
  stage: string,
  limit: number = 50
): Promise<Track[]> {
  return query<Track>(`
    SELECT * FROM tracks
    WHERE stage = $1
    ORDER BY created_at ASC
    LIMIT $2
  `, [stage, limit]);
}

/**
 * Update track stage
 */
export async function updateTrackStage(
  spotifyTrackId: string,
  newStage: string
): Promise<void> {
  await query(`
    UPDATE tracks
    SET stage = $1, updated_at = NOW()
    WHERE spotify_track_id = $2
  `, [newStage, spotifyTrackId]);
}

/**
 * Update track flags
 */
export async function updateTrackFlags(
  spotifyTrackId: string,
  flags: { has_iswc?: boolean; has_lyrics?: boolean; has_audio?: boolean }
): Promise<void> {
  const setClauses: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (flags.has_iswc !== undefined) {
    setClauses.push(`has_iswc = $${paramIndex++}`);
    params.push(flags.has_iswc);
  }
  if (flags.has_lyrics !== undefined) {
    setClauses.push(`has_lyrics = $${paramIndex++}`);
    params.push(flags.has_lyrics);
  }
  if (flags.has_audio !== undefined) {
    setClauses.push(`has_audio = $${paramIndex++}`);
    params.push(flags.has_audio);
  }

  if (setClauses.length > 0) {
    params.push(spotifyTrackId);
    await query(`
      UPDATE tracks
      SET ${setClauses.join(', ')}, updated_at = NOW()
      WHERE spotify_track_id = $${paramIndex}
    `, params);
  }
}

// ============================================================================
// Enrichment Task Queries
// ============================================================================

export interface EnrichmentTask {
  id: number;
  spotify_track_id: string;
  task_type: string;
  status: string;
  source: string | null;
  result_data: any;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
}

/**
 * Get pending enrichment tasks
 */
export async function getPendingEnrichmentTasks(
  taskType: string,
  limit: number = 50
): Promise<EnrichmentTask[]> {
  return query<EnrichmentTask>(`
    SELECT * FROM enrichment_tasks
    WHERE task_type = $1 AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT $2
  `, [taskType, limit]);
}

/**
 * Create enrichment task
 */
export async function createEnrichmentTask(
  spotifyTrackId: string,
  taskType: string
): Promise<void> {
  await query(`
    INSERT INTO enrichment_tasks (spotify_track_id, task_type, status)
    VALUES ($1, $2, 'pending')
    ON CONFLICT (spotify_track_id, task_type) DO NOTHING
  `, [spotifyTrackId, taskType]);
}

/**
 * Update enrichment task status
 */
export async function updateEnrichmentTask(
  taskId: number,
  updates: {
    status?: string;
    source?: string;
    result_data?: any;
    error_message?: string;
  }
): Promise<void> {
  const setClauses: string[] = ['attempts = attempts + 1', 'last_attempt_at = NOW()'];
  const params: any[] = [];
  let paramIndex = 1;

  if (updates.status) {
    setClauses.push(`status = $${paramIndex++}`);
    params.push(updates.status);
  }
  if (updates.source) {
    setClauses.push(`source = $${paramIndex++}`);
    params.push(updates.source);
  }
  if (updates.result_data) {
    setClauses.push(`result_data = $${paramIndex++}`);
    params.push(JSON.stringify(updates.result_data));
  }
  if (updates.error_message) {
    setClauses.push(`error_message = $${paramIndex++}`);
    params.push(updates.error_message);
  }

  if (updates.status === 'completed') {
    setClauses.push('completed_at = NOW()');
  }

  params.push(taskId);
  await query(`
    UPDATE enrichment_tasks
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
  `, params);
}

// ============================================================================
// Audio Task Queries
// ============================================================================

export interface AudioTask {
  id: number;
  spotify_track_id: string;
  task_type: string;
  status: string;
  grove_cid: string | null;
  grove_url: string | null;
  metadata: any;
  attempts: number;
  error_message: string | null;
}

/**
 * Get pending audio tasks
 */
export async function getPendingAudioTasks(
  taskType: string,
  limit: number = 50
): Promise<AudioTask[]> {
  return query<AudioTask>(`
    SELECT at.* FROM audio_tasks at
    INNER JOIN song_lyrics sl ON at.spotify_track_id = sl.spotify_track_id
    WHERE at.task_type = $1
      AND at.status = 'pending'
      AND (sl.synced_lyrics IS NOT NULL OR sl.plain_lyrics IS NOT NULL)
    ORDER BY at.created_at ASC
    LIMIT $2
  `, [taskType, limit]);
}

/**
 * Create audio task
 */
export async function createAudioTask(
  spotifyTrackId: string,
  taskType: string
): Promise<void> {
  await query(`
    INSERT INTO audio_tasks (spotify_track_id, task_type, status)
    VALUES ($1, $2, 'pending')
    ON CONFLICT (spotify_track_id, task_type) DO NOTHING
  `, [spotifyTrackId, taskType]);
}

/**
 * Update audio task
 */
export async function updateAudioTask(
  taskId: number,
  updates: {
    status?: string;
    grove_cid?: string;
    grove_url?: string;
    metadata?: any;
    error_message?: string;
  }
): Promise<void> {
  const setClauses: string[] = ['attempts = attempts + 1', 'last_attempt_at = NOW()'];
  const params: any[] = [];
  let paramIndex = 1;

  if (updates.status) {
    setClauses.push(`status = $${paramIndex++}`);
    params.push(updates.status);
  }
  if (updates.grove_cid) {
    setClauses.push(`grove_cid = $${paramIndex++}`);
    params.push(updates.grove_cid);
  }
  if (updates.grove_url) {
    setClauses.push(`grove_url = $${paramIndex++}`);
    params.push(updates.grove_url);
  }
  if (updates.metadata) {
    setClauses.push(`metadata = $${paramIndex++}`);
    params.push(JSON.stringify(updates.metadata));
  }
  if (updates.error_message) {
    setClauses.push(`error_message = $${paramIndex++}`);
    params.push(updates.error_message);
  }

  if (updates.status === 'completed') {
    setClauses.push('completed_at = NOW()');
  }

  params.push(taskId);
  await query(`
    UPDATE audio_tasks
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
  `, params);
}

// ============================================================================
// Cache Queries
// ============================================================================

/**
 * Get ISWC from all cache sources
 */
export async function getISWCFromCache(isrc: string): Promise<string | null> {
  // Try Quansic cache first
  const quansic = await query<{ iswc: string }>(`
    SELECT iswc FROM quansic_recordings
    WHERE isrc = $1 AND iswc IS NOT NULL
    LIMIT 1
  `, [isrc]);
  if (quansic[0]?.iswc) return quansic[0].iswc;

  // Try MLC cache
  const mlc = await query<{ iswc: string }>(`
    SELECT iswc FROM mlc_works
    WHERE isrc = $1 AND iswc IS NOT NULL
    LIMIT 1
  `, [isrc]);
  if (mlc[0]?.iswc) return mlc[0].iswc;

  // Try BMI cache (no match_confidence in old schema)
  const bmi = await query<{ iswc: string }>(`
    SELECT iswc FROM bmi_works
    WHERE isrc = $1 AND iswc IS NOT NULL
    LIMIT 1
  `, [isrc]);
  if (bmi[0]?.iswc) return bmi[0].iswc;

  // Try MusicBrainz
  const mb = await query<{ iswc: string }>(`
    SELECT w.iswc
    FROM musicbrainz_recordings r
    JOIN musicbrainz_works w ON r.work_mbid = w.work_mbid
    WHERE r.isrc = $1 AND w.iswc IS NOT NULL
    LIMIT 1
  `, [isrc]);
  if (mb[0]?.iswc) return mb[0].iswc;

  return null;
}

/**
 * Check if ISWC lookup has failed before
 */
export async function isKnownISWCFailure(isrc: string): Promise<boolean> {
  const result = await query<{ isrc: string }>(`
    SELECT isrc FROM iswc_lookup_failures
    WHERE isrc = $1
      AND last_attempted_at > NOW() - INTERVAL '7 days'
    LIMIT 1
  `, [isrc]);

  return result.length > 0;
}

/**
 * Record ISWC lookup failure
 */
export async function recordISWCFailure(
  isrc: string,
  sourcesTried: string[],
  reason: string
): Promise<void> {
  await query(`
    INSERT INTO iswc_lookup_failures (isrc, sources_tried, failure_reason, last_attempted_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (isrc)
    DO UPDATE SET
      sources_tried = $2,
      failure_reason = $3,
      last_attempted_at = NOW(),
      attempt_count = iswc_lookup_failures.attempt_count + 1
  `, [isrc, JSON.stringify(sourcesTried), reason]);
}
