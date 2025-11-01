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
 * Note: Pipeline continues even when ISWC is not found (fault-tolerant)
 */
export function updatePipelineISWCSQL(
  spotifyTrackId: string,
  iswc: string | null
): string {
  const hasISWC = iswc !== null;
  // Always continue pipeline - ISWC is optional metadata
  const status = 'iswc_found';

  return `
    UPDATE song_pipeline
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
 * Generate SQL to insert BMI work data into cache
 */
export function insertBMIWorkSQL(bmiData: {
  iswc: string;
  title: string;
  bmi_work_id?: string;
  ascap_work_id?: string;
  writers?: any;
  publishers?: any;
  performers?: string[];
  shares?: Record<string, string>;
  status?: 'RECONCILED' | 'UNDER_REVIEW';
  raw_data?: any;
}): string {
  return `
    INSERT INTO bmi_works (iswc, title, bmi_work_id, ascap_work_id, writers, publishers, performers, shares, status, raw_data, cached_at)
    VALUES (
      '${bmiData.iswc}',
      '${bmiData.title.replace(/'/g, "''")}',
      ${bmiData.bmi_work_id ? `'${bmiData.bmi_work_id}'` : 'NULL'},
      ${bmiData.ascap_work_id ? `'${bmiData.ascap_work_id}'` : 'NULL'},
      ${bmiData.writers ? `'${JSON.stringify(bmiData.writers).replace(/'/g, "''")}'::jsonb` : 'NULL'},
      ${bmiData.publishers ? `'${JSON.stringify(bmiData.publishers).replace(/'/g, "''")}'::jsonb` : 'NULL'},
      ${bmiData.performers ? `'${JSON.stringify(bmiData.performers).replace(/'/g, "''")}'::jsonb` : 'NULL'},
      ${bmiData.shares ? `'${JSON.stringify(bmiData.shares).replace(/'/g, "''")}'::jsonb` : 'NULL'},
      ${bmiData.status ? `'${bmiData.status}'` : 'NULL'},
      ${bmiData.raw_data ? `'${JSON.stringify(bmiData.raw_data).replace(/'/g, "''")}'::jsonb` : 'NULL'},
      NOW()
    )
    ON CONFLICT (iswc) DO NOTHING
  `.trim();
}

/**
 * Generate SQL to insert MLC work data into cache
 */
export function insertMLCWorkSQL(mlcData: {
  isrc: string;
  mlc_song_code: string;
  iswc: string | null;
  title: string;
  writers?: any;
  publishers?: any;
  total_publisher_share?: number;
  raw_data?: any;
}): string {
  return `
    INSERT INTO mlc_works (isrc, mlc_song_code, iswc, title, writers, publishers, total_publisher_share, raw_data, cached_at)
    VALUES (
      '${mlcData.isrc}',
      '${mlcData.mlc_song_code}',
      ${mlcData.iswc ? `'${mlcData.iswc}'` : 'NULL'},
      '${mlcData.title.replace(/'/g, "''")}',
      ${mlcData.writers ? `'${JSON.stringify(mlcData.writers).replace(/'/g, "''")}'::jsonb` : 'NULL'},
      ${mlcData.publishers ? `'${JSON.stringify(mlcData.publishers).replace(/'/g, "''")}'::jsonb` : 'NULL'},
      ${mlcData.total_publisher_share ? mlcData.total_publisher_share : 'NULL'},
      ${mlcData.raw_data ? `'${JSON.stringify(mlcData.raw_data).replace(/'/g, "''")}'::jsonb` : 'NULL'},
      NOW()
    )
    ON CONFLICT (isrc, mlc_song_code) DO NOTHING
  `.trim();
}

/**
 * Generate SQL to mark an ISRC as not found in both Quansic and BMI
 */
export function insertEnrichmentCacheFailureSQL(
  isrc: string,
  attemptedSources: string[] = ['quansic', 'bmi']
): string {
  return `
    INSERT INTO recording_enrichment_cache (isrc, lookup_status, attempted_sources, cached_at)
    VALUES (
      '${isrc}',
      'not_found',
      ARRAY[${attemptedSources.map(s => `'${s}'`).join(',')}]::TEXT[],
      NOW()
    )
    ON CONFLICT (isrc) DO UPDATE SET
      lookup_status = 'not_found',
      attempted_sources = ARRAY[${attemptedSources.map(s => `'${s}'`).join(',')}]::TEXT[],
      cached_at = NOW()
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
