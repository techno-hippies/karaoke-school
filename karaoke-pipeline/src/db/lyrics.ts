/**
 * Lyrics Database Operations
 * Handles song_lyrics table operations with new simplified schema
 */

import { buildUpsert } from './neon';

export interface LyricsRecord {
  spotify_track_id: string;

  // Original sources (immutable audit trail)
  lrclib_lyrics?: string | null;
  ovh_lyrics?: string | null;

  // Processed output (NULL if needs manual review)
  normalized_lyrics?: string | null;

  // Metadata
  source: 'lrclib' | 'ovh' | 'lrclib+ovh' | 'normalized' | 'needs_review';
  normalized_by?: string | null;
  confidence_score?: number | null;  // <0.80 = flagged for review
  language_data?: any | null;
}

/**
 * Generate SQL to upsert lyrics
 */
export function upsertLyricsSQL(record: LyricsRecord): string {
  const data: any = {
    spotify_track_id: record.spotify_track_id,
    lrclib_lyrics: record.lrclib_lyrics || null,
    ovh_lyrics: record.ovh_lyrics || null,
    normalized_lyrics: record.normalized_lyrics || null,
    source: record.source,
    normalized_by: record.normalized_by || null,
    confidence_score: record.confidence_score || null,
    language_data: record.language_data || null,
  };

  return buildUpsert('song_lyrics', data, 'spotify_track_id', [
    'lrclib_lyrics',
    'ovh_lyrics',
    'normalized_lyrics',
    'source',
    'normalized_by',
    'confidence_score',
    'language_data',
  ]) + ' RETURNING spotify_track_id, source, confidence_score';
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
