/**
 * MusicBrainz Database Operations
 * Handles musicbrainz_* tables and pipeline updates
 */

import { buildUpsert } from './neon';
import type { MBRecording, MBWork, MBArtist } from '../services/musicbrainz';

/**
 * Normalize date to PostgreSQL DATE format
 * MusicBrainz returns: "1976", "1976-01", or "1976-01-15"
 * PostgreSQL DATE expects: "YYYY-MM-DD"
 */
function normalizeDate(date: string | null): string | null {
  if (!date) return null;

  // Already full date
  if (date.length === 10) return date;

  // Year only: pad to YYYY-01-01
  if (date.length === 4) return `${date}-01-01`;

  // Year-month: pad to YYYY-MM-01
  if (date.length === 7) return `${date}-01`;

  return date;
}

/**
 * Generate SQL to upsert MusicBrainz recording
 */
export function upsertMBRecordingSQL(
  recording: MBRecording,
  isrc?: string
): string {
  const workMbid = recording.relations?.find(
    rel => rel.type === 'performance' && rel.work
  )?.work?.id || null;

  const data = {
    recording_mbid: recording.id,
    title: recording.title,
    length_ms: recording.length || null,
    isrc: isrc || recording.isrcs?.[0] || null,
    artist_credits: recording.artist_credit?.map(ac => ({
      name: ac.name,
      mbid: ac.artist.id,
      type: ac.artist.type,
    })) || [],
    work_mbid: workMbid,
    tags: recording.tags || [],
    first_release_date: normalizeDate(recording['first-release-date'] || null),
    video: recording.video || false,
  };

  return buildUpsert('musicbrainz_recordings', data, 'recording_mbid', [
    'title',
    'length_ms',
    'isrc',
    'artist_credits',
    'work_mbid',
    'tags',
    'first_release_date',
    'video',
  ]) + ' RETURNING recording_mbid, work_mbid';
}

/**
 * Generate SQL to upsert MusicBrainz work
 */
export function upsertMBWorkSQL(work: MBWork): string {
  const data = {
    work_mbid: work.id,
    title: work.title,
    work_type: work.type || null,
    iswc: work.iswcs?.[0] || null,
    contributors: work.relations?.filter(rel => rel.artist).map(rel => ({
      type: rel.type,
      mbid: rel.artist!.id,
      name: rel.artist!.name,
      attributes: rel.attributes || [],
    })) || [],
  };

  return buildUpsert('musicbrainz_works', data, 'work_mbid', [
    'title',
    'work_type',
    'iswc',
    'contributors',
  ]) + ' RETURNING work_mbid, iswc';
}

/**
 * Generate SQL to upsert MusicBrainz artist
 */
export function upsertMBArtistSQL(
  artist: MBArtist,
  spotifyArtistId?: string
): string {
  const socialMedia: Record<string, string> = {};
  const streaming: Record<string, string> = {};
  const allUrls: Record<string, string> = {};

  // Helper to extract a unique identifier from URL
  const getUrlKey = (type: string, url: string): string => {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace(/^www\./, '');

      // Extract ID from path if available
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      const id = pathParts[pathParts.length - 1];

      // Create unique key: type.domain or type.domain.id
      if (id && id.length < 50) {
        return `${type}.${domain}.${id}`;
      }
      return `${type}.${domain}`;
    } catch {
      // Fallback if URL parsing fails
      return `${type}.${Date.now()}`;
    }
  };

  let urlIndex = 0;
  artist.relations?.forEach(rel => {
    if (rel.type && rel.url?.resource) {
      const url = rel.url.resource;

      // Categorize URLs
      if (rel.type === 'social network') {
        if (url.includes('facebook.com')) socialMedia.facebook = url;
        else if (url.includes('twitter.com')) socialMedia.twitter = url;
        else if (url.includes('instagram.com')) socialMedia.instagram = url;
        else if (url.includes('tiktok.com')) socialMedia.tiktok = url;
        else if (url.includes('youtube.com')) socialMedia.youtube = url;
      } else if (rel.type === 'free streaming' || rel.type === 'streaming') {
        if (url.includes('spotify.com')) streaming.spotify = url;
        else if (url.includes('apple.com')) streaming.apple_music = url;
        else if (url.includes('deezer.com')) streaming.deezer = url;
      }

      // Store ALL URLs with unique keys
      const key = getUrlKey(rel.type, url);
      // If key already exists (rare edge case), append index
      const finalKey = allUrls[key] ? `${key}.${urlIndex++}` : key;
      allUrls[finalKey] = url;
    }
  });

  const data = {
    artist_mbid: artist.id,
    name: artist.name,
    artist_type: artist.type || null,
    country: artist.country || null,
    gender: artist.gender || null,
    birth_date: normalizeDate(artist['life-span']?.begin || null),
    begin_area: artist.begin_area?.name || null,
    isnis: artist.isnis || null,
    ipis: artist.ipis || null,
    spotify_artist_id: spotifyArtistId || null,
    urls: Object.keys(allUrls).length > 0 ? allUrls : null,
    social_media: Object.keys(socialMedia).length > 0 ? socialMedia : null,
    streaming: Object.keys(streaming).length > 0 ? streaming : null,
    all_urls: Object.keys(allUrls).length > 0 ? allUrls : null,
    genres: artist.genres?.map(g => ({ name: g.name, count: g.count })) || [],
    tags: artist.tags || [],
  };

  return buildUpsert('musicbrainz_artists', data, 'artist_mbid', [
    'name',
    'artist_type',
    'country',
    'gender',
    'birth_date',
    'begin_area',
    'isnis',
    'ipis',
    'spotify_artist_id',
    'urls',
    'social_media',
    'streaming',
    'all_urls',
    'genres',
    'tags',
  ]) + ' RETURNING artist_mbid, isnis';
}

/**
 * Generate SQL to update pipeline status after MusicBrainz enrichment
 */
export function updatePipelineMBSQL(
  spotifyTrackId: string,
  recordingMbid: string,
  workMbid: string | null
): string {
  return `
    UPDATE song_pipeline
    SET
      status = 'metadata_enriched',
      recording_mbid = '${recordingMbid}',
      work_mbid = ${workMbid ? `'${workMbid}'` : 'NULL'},
      updated_at = NOW()
    WHERE spotify_track_id = '${spotifyTrackId}'
    RETURNING id, status
  `.trim();
}

/**
 * Generate SQL to log processing event
 */
export function logMBProcessingSQL(
  spotifyTrackId: string,
  action: 'success' | 'failed' | 'skipped',
  message?: string,
  metadata?: Record<string, any>
): string {
  const data = {
    spotify_track_id: spotifyTrackId,
    stage: 'musicbrainz',
    action,
    source: 'api' as const,
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
