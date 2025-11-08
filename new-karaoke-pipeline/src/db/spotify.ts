/**
 * Spotify Database Operations
 * Handles spotify_tracks and spotify_artists tables
 */

import { buildUpsert } from './connection';
import type { SpotifyTrackInfo, SpotifyArtistInfo } from '../services/spotify';

/**
 * Normalize Spotify release date to PostgreSQL DATE format
 * Spotify returns: "1976", "1976-01", or "1976-01-15"
 * PostgreSQL DATE expects: "YYYY-MM-DD"
 */
function normalizeReleaseDate(releaseDate: string | null): string | null {
  if (!releaseDate) return null;

  // Already full date
  if (releaseDate.length === 10) return releaseDate;

  // Year only: pad to YYYY-01-01
  if (releaseDate.length === 4) return `${releaseDate}-01-01`;

  // Year-month: pad to YYYY-MM-01
  if (releaseDate.length === 7) return `${releaseDate}-01`;

  return releaseDate;
}

/**
 * Normalize ISRC to uppercase
 * ISRCs should always be uppercase per the standard, but Spotify occasionally returns lowercase
 */
function normalizeISRC(isrc: string | null): string | null {
  if (!isrc) return null;
  return isrc.toUpperCase();
}

/**
 * Generate SQL to upsert a Spotify track
 */
export function upsertSpotifyTrackSQL(track: SpotifyTrackInfo): string {
  const data = {
    spotify_track_id: track.spotify_track_id,
    title: track.title,
    artists: track.artists,
    album: track.album,
    image_url: track.image_url,
    isrc: normalizeISRC(track.isrc),
    duration_ms: track.duration_ms,
    release_date: normalizeReleaseDate(track.release_date),
    popularity: track.popularity,
    spotify_url: track.spotify_url,
    preview_url: track.preview_url,
  };

  return buildUpsert('spotify_tracks', data, 'spotify_track_id', [
    'title',
    'artists',
    'album',
    'image_url',
    'isrc',
    'duration_ms',
    'release_date',
    'popularity',
    'spotify_url',
    'preview_url',
    'updated_at'
  ]) + ' RETURNING spotify_track_id, isrc';
}

/**
 * Generate SQL to upsert a Spotify artist
 */
export function upsertSpotifyArtistSQL(artist: SpotifyArtistInfo): string {
  const data = {
    spotify_artist_id: artist.spotify_artist_id,
    name: artist.name,
    genres: artist.genres,
    images: artist.image_url ? [{ url: artist.image_url }] : [],
    popularity: artist.popularity,
    followers: artist.followers,
    external_urls: {},
  };

  return buildUpsert('spotify_artists', data, 'spotify_artist_id', [
    'name',
    'genres',
    'images',
    'popularity',
    'followers',
    'external_urls',
    'updated_at'
  ]) + ' RETURNING spotify_artist_id';
}

/**
 * Generate SQL to create song_pipeline entry
 * UPSERT on spotify_track_id to prevent duplicates when multiple TikTok videos use the same song
 * The pipeline processes songs, not videos - each song should only be processed once
 *
 * On conflict: Only updates tiktok_video_id (most recent video reference)
 *              Preserves all pipeline progress (status, metadata, etc.)
 */
export function createPipelineEntrySQL(
  videoId: string,
  spotifyTrackId: string,
  isrc: string | null,
  primaryArtistId: string | null
): string {
  // Normalize ISRC to uppercase
  const normalizedIsrc = normalizeISRC(isrc);

  // Custom SQL to handle conflict intelligently
  // If song already exists in pipeline, just update the TikTok video reference
  // This prevents resetting pipeline progress when the same song appears in multiple videos
  return `
    INSERT INTO song_pipeline (
      tiktok_video_id,
      spotify_track_id,
      status,
      isrc,
      spotify_artist_id,
      created_at,
      updated_at
    ) VALUES (
      '${videoId}',
      '${spotifyTrackId}',
      'spotify_resolved',
      ${normalizedIsrc ? `'${normalizedIsrc}'` : 'NULL'},
      ${primaryArtistId ? `'${primaryArtistId}'` : 'NULL'},
      NOW(),
      NOW()
    )
    ON CONFLICT (spotify_track_id) DO UPDATE SET
      tiktok_video_id = EXCLUDED.tiktok_video_id,
      updated_at = NOW()
    RETURNING id, status
  `.trim();
}

/**
 * Generate SQL to log processing event
 */
export function logProcessingSQL(
  spotifyTrackId: string,
  stage: string,
  action: 'success' | 'failed' | 'skipped',
  source: 'cache' | 'api',
  message?: string,
  metadata?: Record<string, any>
): string {
  const data = {
    spotify_track_id: spotifyTrackId,
    stage,
    action,
    source,
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
