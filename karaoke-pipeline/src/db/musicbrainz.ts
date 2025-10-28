/**
 * MusicBrainz Database Operations
 * Handles musicbrainz_* tables and pipeline updates
 */

import { buildUpsert } from './neon';
import type { MBRecording, MBWork, MBArtist } from '../services/musicbrainz';

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
    first_release_date: recording['first-release-date'] || null,
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
  isni?: string,
  spotifyArtistId?: string
): string {
  const urls: Record<string, string> = {};

  artist.relations?.forEach(rel => {
    if (rel.type && rel.url?.resource) {
      // Extract URL type from the resource URL
      if (rel.url.resource.includes('wikidata.org')) {
        urls.wikidata = rel.url.resource;
      } else if (rel.url.resource.includes('wikipedia.org')) {
        urls.wikipedia = rel.url.resource;
      } else if (rel.url.resource.includes('discogs.com')) {
        urls.discogs = rel.url.resource;
      }
    }
  });

  const data = {
    artist_mbid: artist.id,
    name: artist.name,
    artist_type: artist.type || null,
    country: artist.country || null,
    begin_area: artist.begin_area?.name || null,
    isni: isni || null,
    spotify_artist_id: spotifyArtistId || null,
    urls: Object.keys(urls).length > 0 ? urls : null,
    genres: artist.genres?.map(g => ({ name: g.name, count: g.count })) || [],
    tags: artist.tags || [],
  };

  return buildUpsert('musicbrainz_artists', data, 'artist_mbid', [
    'name',
    'artist_type',
    'country',
    'begin_area',
    'isni',
    'spotify_artist_id',
    'urls',
    'genres',
    'tags',
  ]) + ' RETURNING artist_mbid, isni';
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
    UPDATE track_pipeline
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
