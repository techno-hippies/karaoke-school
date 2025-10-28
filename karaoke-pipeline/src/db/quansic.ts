/**
 * Quansic Database Operations
 * Handles quansic_recordings table and pipeline updates
 */

import { buildUpsert } from './neon';
import type { QuansicRecordingResult } from '../services/quansic';

/**
 * Generate SQL to upsert Quansic recording data
 */
export function upsertQuansicRecordingSQL(
  data: QuansicRecordingResult['data']
): string {
  if (!data) {
    throw new Error('No data to upsert');
  }

  const record = {
    isrc: data.isrc,
    title: data.title,
    iswc: data.iswc,
    work_title: data.work_title,
    artists: data.artists,
    composers: data.composers,
    platform_ids: data.platform_ids || null,
    duration_ms: data.duration_ms || null,
    q2_score: data.q2_score || null,
    spotify_track_id: data.platform_ids?.spotify || null,
  };

  return buildUpsert('quansic_recordings', record, 'isrc', [
    'title',
    'iswc',
    'work_title',
    'artists',
    'composers',
    'platform_ids',
    'duration_ms',
    'q2_score',
    'spotify_track_id',
  ]) + ' RETURNING isrc, iswc';
}

/**
 * Generate SQL to update pipeline status after ISWC resolution
 */
export function updatePipelineISWCSQL(
  spotifyTrackId: string,
  iswc: string | null
): string {
  const hasISWC = iswc !== null;
  const status = hasISWC ? 'iswc_found' : 'failed';

  return `
    UPDATE track_pipeline
    SET
      has_iswc = ${hasISWC},
      status = '${status}',
      iswc = ${iswc ? `'${iswc}'` : 'NULL'},
      updated_at = NOW()
    WHERE spotify_track_id = '${spotifyTrackId}'
    RETURNING id, status, has_iswc
  `.trim();
}

/**
 * Generate SQL to log processing event
 */
export function logQuansicProcessingSQL(
  spotifyTrackId: string,
  isrc: string,
  action: 'success' | 'failed' | 'skipped',
  message?: string,
  metadata?: Record<string, any>
): string {
  const data = {
    spotify_track_id: spotifyTrackId,
    stage: 'quansic_iswc',
    action,
    source: 'api' as const,
    message: message || null,
    metadata: metadata ? { ...metadata, isrc } : { isrc },
  };

  return `INSERT INTO processing_log (${Object.keys(data).join(', ')}) VALUES (${Object.values(data).map(v => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
    if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
    return String(v);
  }).join(', ')})`;
}
