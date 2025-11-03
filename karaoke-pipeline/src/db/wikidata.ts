/**
 * Wikidata Database Operations
 * Handles wikidata_artists and wikidata_works tables
 */

import { buildUpsert } from './neon';
import type { WikidataArtist } from '../services/wikidata';
import type { WikidataWork } from '../services/wikidata-works';

/**
 * Generate SQL to upsert Wikidata artist
 */
export function upsertWikidataArtistSQL(
  artist: WikidataArtist,
  spotifyArtistId?: string
): string {
  const data = {
    wikidata_id: artist.wikidataId,
    spotify_artist_id: spotifyArtistId || null,

    // International Library IDs
    viaf_id: artist.viafId || null,
    gnd_id: artist.gndId || null,
    bnf_id: artist.bnfId || null,
    loc_id: artist.locId || null,
    sbn_id: artist.sbnId || null,
    bnmm_id: artist.bnmmId || null,
    selibr_id: artist.selibrId || null,

    // Labels and aliases as JSONB
    labels: artist.labels || null,
    aliases: artist.aliases || null,

    // Other identifiers as JSONB
    identifiers: artist.identifiers || null,
  };

  return buildUpsert('wikidata_artists', data, 'wikidata_id', [
    'spotify_artist_id',
    'viaf_id',
    'gnd_id',
    'bnf_id',
    'loc_id',
    'sbn_id',
    'bnmm_id',
    'selibr_id',
    'labels',
    'aliases',
    'identifiers',
  ]) + ' RETURNING wikidata_id, viaf_id, gnd_id, bnf_id, loc_id';
}

/**
 * Generate SQL to log processing event
 * Note: processing_log is track-based, so we use the artist ID as the track ID
 * and also store it in metadata for clarity
 */
export function logWikidataProcessingSQL(
  spotifyArtistId: string,
  action: 'success' | 'failed' | 'skipped',
  message?: string,
  metadata?: Record<string, any>
): string {
  const enrichedMetadata = {
    ...metadata,
    spotify_artist_id: spotifyArtistId,
    entity_type: 'artist',
  };

  const data = {
    spotify_track_id: spotifyArtistId,  // Use artist ID (track_id is required)
    stage: 'wikidata',
    action,
    source: 'api' as const,
    message: message || null,
    metadata: enrichedMetadata,
  };

  return `INSERT INTO processing_log (${Object.keys(data).join(', ')}) VALUES (${Object.values(data).map(v => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
    if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
    return String(v);
  }).join(', ')})`;
}

/**
 * Generate SQL to upsert Wikidata work
 */
export function upsertWikidataWorkSQL(
  work: WikidataWork,
  musicbrainzWorkId?: string,
  spotifyTrackId?: string
): string {
  const data = {
    wikidata_id: work.wikidataId,
    musicbrainz_work_id: musicbrainzWorkId || null,
    spotify_track_id: spotifyTrackId || null,

    // Core metadata
    title: work.title || null,
    iswc: work.iswc || null,
    language: work.language || null,

    // Labels and aliases as JSONB
    labels: work.labels || null,
    aliases: work.aliases || null,

    // Relations as JSONB
    composers: work.composers || null,
    lyricists: work.lyricists || null,
    performers: work.performers || null,

    // Other identifiers as JSONB
    identifiers: work.identifiers || null,
  };

  return buildUpsert('wikidata_works', data, 'wikidata_id', [
    'musicbrainz_work_id',
    'spotify_track_id',
    'title',
    'iswc',
    'language',
    'labels',
    'aliases',
    'composers',
    'lyricists',
    'performers',
    'identifiers',
  ]) + ' RETURNING wikidata_id, title, iswc';
}

/**
 * Generate SQL to log work processing event
 */
export function logWikidataWorkProcessingSQL(
  spotifyTrackId: string,
  action: 'success' | 'failed' | 'skipped',
  message?: string,
  metadata?: Record<string, any>
): string {
  const enrichedMetadata = {
    ...metadata,
    spotify_track_id: spotifyTrackId,
    entity_type: 'work',
  };

  const data = {
    spotify_track_id: spotifyTrackId,
    stage: 'wikidata_work',
    action,
    source: 'api' as const,
    message: message || null,
    metadata: enrichedMetadata,
  };

  return `INSERT INTO processing_log (${Object.keys(data).join(', ')}) VALUES (${Object.values(data).map(v => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
    if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
    return String(v);
  }).join(', ')})`;
}
