/**
 * Audio Files Database Operations
 * Handles song_audio table operations
 */

import { buildUpsert } from './neon';

export interface AudioRecord {
  spotify_track_id: string;
  file_size_bytes: number;
  format?: string;
  duration_ms?: number | null;
  grove_cid?: string | null;
  grove_uploaded_at?: Date | null;
  cached_by_freyr?: boolean;
  download_time_seconds?: number | null;
  bitrate_kbps?: number | null;
  sample_rate_hz?: number | null;
  channels?: number | null;
}

/**
 * Generate SQL to upsert audio file record
 */
export function upsertAudioSQL(record: AudioRecord): string {
  const data: any = {
    spotify_track_id: record.spotify_track_id,
    file_size_bytes: record.file_size_bytes,
    format: record.format || 'm4a',
    duration_ms: record.duration_ms || null,
    grove_cid: record.grove_cid || null,
    grove_uploaded_at: record.grove_uploaded_at || null,
    cached_by_freyr: record.cached_by_freyr ?? false,
    download_time_seconds: record.download_time_seconds || null,
    bitrate_kbps: record.bitrate_kbps || null,
    sample_rate_hz: record.sample_rate_hz || null,
    channels: record.channels || null,
  };

  return buildUpsert('song_audio', data, 'spotify_track_id', [
    'file_size_bytes',
    'format',
    'duration_ms',
    'grove_cid',
    'grove_uploaded_at',
    'cached_by_freyr',
    'download_time_seconds',
    'bitrate_kbps',
    'sample_rate_hz',
    'channels',
  ]) + ' RETURNING spotify_track_id, file_size_bytes, grove_cid';
}

/**
 * Generate SQL to update Grove IPFS CID after upload
 */
export function updateGroveCidSQL(
  spotifyTrackId: string,
  groveCid: string
): string {
  return `
    UPDATE song_audio
    SET
      grove_cid = '${groveCid}',
      grove_uploaded_at = NOW(),
      updated_at = NOW()
    WHERE spotify_track_id = '${spotifyTrackId}'
    RETURNING spotify_track_id, grove_cid, grove_uploaded_at
  `.trim();
}

/**
 * Generate SQL to update pipeline status after audio download
 */
export function updatePipelineAudioSQL(
  spotifyTrackId: string,
  hasAudio: boolean
): string {
  return `
    UPDATE song_pipeline
    SET
      status = ${hasAudio ? "'audio_ready'" : "'failed'"},
      has_audio = ${hasAudio ? 'TRUE' : 'FALSE'},
      ${!hasAudio ? "error_message = 'Audio download failed'," : ''}
      ${!hasAudio ? "error_stage = 'audio'," : ''}
      updated_at = NOW()
    WHERE spotify_track_id = '${spotifyTrackId}'
    RETURNING id, status, has_audio
  `.trim();
}

/**
 * Generate SQL to log audio processing event
 */
export function logAudioProcessingSQL(
  spotifyTrackId: string,
  action: 'success' | 'failed' | 'skipped',
  message?: string,
  metadata?: Record<string, any>
): string {
  const data = {
    spotify_track_id: spotifyTrackId,
    stage: 'audio',
    action,
    source: 'freyr_download',
    message: message || null,
    metadata: metadata || null,
  };

  return `INSERT INTO processing_log (${Object.keys(data).join(', ')}) VALUES (${Object.values(data).map(v => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
    if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
    return String(v);
  }).join(', ')})`;
}
