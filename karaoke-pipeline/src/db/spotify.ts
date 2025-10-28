/**
 * Spotify Database Operations
 * Handles spotify_tracks and spotify_artists tables
 */

import { buildUpsert } from './neon';
import type { SpotifyTrackInfo, SpotifyArtistInfo } from '../services/spotify';

/**
 * Generate SQL to upsert a Spotify track
 */
export function upsertSpotifyTrackSQL(track: SpotifyTrackInfo): string {
  const data = {
    spotify_track_id: track.spotify_track_id,
    title: track.title,
    artists: track.artists,
    album: track.album,
    isrc: track.isrc,
    duration_ms: track.duration_ms,
    release_date: track.release_date,
    popularity: track.popularity,
    spotify_url: track.spotify_url,
    preview_url: track.preview_url,
  };

  return buildUpsert('spotify_tracks', data, 'spotify_track_id', [
    'title',
    'artists',
    'album',
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
    image_url: artist.image_url,
    popularity: artist.popularity,
    followers: artist.followers,
  };

  return buildUpsert('spotify_artists', data, 'spotify_artist_id', [
    'name',
    'genres',
    'image_url',
    'popularity',
    'followers',
    'updated_at'
  ]) + ' RETURNING spotify_artist_id';
}

/**
 * Generate SQL to create track_pipeline entry
 */
export function createPipelineEntrySQL(
  videoId: string,
  spotifyTrackId: string,
  isrc: string | null,
  primaryArtistId: string | null
): string {
  const data = {
    tiktok_video_id: videoId,
    spotify_track_id: spotifyTrackId,
    status: 'spotify_resolved',
    isrc: isrc,
    spotify_artist_id: primaryArtistId,
  };

  return buildUpsert('track_pipeline', data, 'tiktok_video_id', [
    'spotify_track_id',
    'status',
    'isrc',
    'spotify_artist_id',
    'updated_at'
  ]) + ' RETURNING id, status';
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
