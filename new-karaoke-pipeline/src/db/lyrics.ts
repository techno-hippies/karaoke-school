/**
 * Lyrics Database Operations
 * Handles song_lyrics table operations with new simplified schema
 */

import { buildUpsert } from './connection';

export interface LyricsRecord {
  spotify_track_id: string;

  // Lyrics content
  synced_lyrics?: string | null;      // LRC format with timestamps
  plain_lyrics?: string | null;       // Plain text (no timing)

  // Processed output
  normalized_lyrics?: string | null;

  // Metadata
  source: 'lrclib' | 'manual';
  language?: string | null;
  line_count?: number | null;
}

/**
 * Generate SQL to upsert lyrics
 */
export function upsertLyricsSQL(record: LyricsRecord): string {
  const data: any = {
    spotify_track_id: record.spotify_track_id,
    synced_lyrics: record.synced_lyrics || null,
    plain_lyrics: record.plain_lyrics || null,
    normalized_lyrics: record.normalized_lyrics || null,
    source: record.source,
    language: record.language || null,
    line_count: record.line_count || null,
  };

  return buildUpsert('song_lyrics', data, 'spotify_track_id', [
    'synced_lyrics',
    'plain_lyrics',
    'normalized_lyrics',
    'source',
    'language',
    'line_count',
  ]) + ' RETURNING spotify_track_id, source';
}

/**
 * Generate SQL to update pipeline status after lyrics discovery
 */
export function updatePipelineLyricsSQL(
  spotifyTrackId: string,
  hasLyrics: boolean
): string {
  return `
    UPDATE song_pipeline
    SET
      status = ${hasLyrics ? "'lyrics_ready'" : "'failed'"},
      has_lyrics = ${hasLyrics ? 'TRUE' : 'FALSE'},
      ${!hasLyrics ? "error_message = 'No lyrics found'," : ''}
      ${!hasLyrics ? "error_stage = 'lyrics'," : ''}
      updated_at = NOW()
    WHERE spotify_track_id = '${spotifyTrackId}'
    RETURNING id, status, has_lyrics
  `.trim();
}

/**
 * Generate SQL to log lyrics processing event
 */
export function logLyricsProcessingSQL(
  spotifyTrackId: string,
  action: 'success' | 'failed' | 'skipped',
  message?: string,
  metadata?: Record<string, any>
): string {
  const data = {
    spotify_track_id: spotifyTrackId,
    stage: 'lyrics',
    action,
    source: 'lyrics_discovery',
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
