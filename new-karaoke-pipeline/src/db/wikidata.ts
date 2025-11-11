/**
 * Wikidata Database Operations
 * Handles wikidata_artists and wikidata_works tables
 */

import { buildUpsert } from './sql-helpers';
import type { WikidataArtist } from '../services/wikidata';
import type { WikidataWork } from '../services/wikidata-works';

/**
 * Generate SQL to upsert Wikidata artist
 * Schema: wikidata_id (PK), name, aliases, isni, viaf, musicbrainz_id, spotify_id, identifiers
 */
export function upsertWikidataArtistSQL(
  artist: WikidataArtist,
  spotifyArtistId?: string
): string {
  const data = {
    wikidata_id: artist.wikidataId,
    name: artist.name,
    spotify_id: spotifyArtistId || null,

    // Core library IDs (direct columns)
    isni: artist.isni || null,
    viaf: artist.viafId || null,
    musicbrainz_id: artist.musicBrainzId || null,

    // Aliases and identifiers as JSONB (labels stored in identifiers if needed)
    aliases: artist.aliases || null,
    identifiers: artist.identifiers || null,
    wikipedia_sitelinks: artist.wikipediaSitelinks || null,
  };

  return buildUpsert('wikidata_artists', data, 'wikidata_id', [
    'name',
    'spotify_id',
    'isni',
    'viaf',
    'musicbrainz_id',
    'aliases',
    'identifiers',
    'wikipedia_sitelinks',
  ]) + ' RETURNING wikidata_id, name, isni, viaf, musicbrainz_id';
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
 * Schema: wikidata_id (PK), iswc, title, composers (jsonb), lyricists (jsonb), identifiers (jsonb)
 */
export function upsertWikidataWorkSQL(
  work: WikidataWork
): string {
  const data = {
    wikidata_id: work.wikidataId,
    iswc: work.iswc || null,
    title: work.title || null,
    composers: work.composers || null,
    lyricists: work.lyricists || null,
    identifiers: work.identifiers || null,
  };

  return buildUpsert('wikidata_works', data, 'wikidata_id', [
    'iswc',
    'title',
    'composers',
    'lyricists',
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
