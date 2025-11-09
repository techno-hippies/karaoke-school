#!/usr/bin/env bun
/**
 * Full GRC-20 population task
 *
 * 1. Refresh source facts (artist & work staging tables)
 * 2. Resolve definitive values using SQL helpers
 * 3. Upsert rows into grc20_artists / grc20_works with provenance
 * 4. Log discrepancies surfaced during resolution
 */

import { populateSourceFacts } from './populate-source-facts';
import { query } from '../../db/connection';

type ResolvedField = {
  field_name: string;
  value: string | null;
  primary_source: string | null;
  alternatives: any;
  corroboration_score: number | null;
  flags: string[] | null;
};

type CanonicalArtist = {
  spotify_artist_id: string;
  primary_name: string;
  image_url: string | null;
};

type CanonicalWork = {
  spotify_track_id: string;
  primary_title: string;
  primary_artist_id: string | null;
  primary_artist_name: string | null;
};

const CRITICAL_ARTIST_FIELDS = new Set(['isni']);
const CRITICAL_WORK_FIELDS = new Set(['iswc']);

async function resolveArtistFields(artistId: string): Promise<ResolvedField[]> {
  return query<ResolvedField>(
    'SELECT * FROM resolve_all_artist_fields($1)',
    [artistId]
  );
}

async function resolveWorkFields(trackId: string): Promise<ResolvedField[]> {
  return query<ResolvedField>(
    'SELECT * FROM resolve_all_work_fields($1)',
    [trackId]
  );
}

function evidenceFrom(rows: ResolvedField[]): Record<string, any> {
  const evidence: Record<string, any> = {};
  for (const row of rows) {
    evidence[row.field_name] = {
      value: row.value,
      source: row.primary_source,
      alternatives: row.alternatives ?? [],
      corroboration_score: row.corroboration_score ?? 0,
      flags: row.flags ?? []
    };
  }
  return evidence;
}

function getValue(rows: ResolvedField[], field: string, fallback?: string | null): string | null {
  const row = rows.find((entry) => entry.field_name === field);
  return row?.value ?? fallback ?? null;
}

function parseInteger(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

async function syncDiscrepancies(
  entityType: 'artist' | 'work',
  entityId: string,
  rows: ResolvedField[]
): Promise<void> {
  await query('DELETE FROM grc20_discrepancies WHERE entity_type = $1 AND entity_id = $2', [entityType, entityId]);

  const flagged = rows.filter((row) => row.flags && row.flags.length > 0);
  if (flagged.length === 0) return;

  const params: any[] = [];
  const placeholders = flagged
    .map((row, idx) => {
      const severity = (entityType === 'artist' && CRITICAL_ARTIST_FIELDS.has(row.field_name)) ||
        (entityType === 'work' && CRITICAL_WORK_FIELDS.has(row.field_name))
        ? 'critical'
        : 'warning';

      const base = idx * 5;
      params.push(
        entityType,
        entityId,
        row.field_name,
        severity,
        JSON.stringify(row.alternatives ?? [])
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::jsonb)`;
    })
    .join(', ');

  await query(
    `INSERT INTO grc20_discrepancies (entity_type, entity_id, field_name, severity, conflicting)
     VALUES ${placeholders}`,
    params
  );
}

async function upsertArtist(
  canonical: CanonicalArtist,
  resolved: ResolvedField[]
): Promise<void> {
  const evidence = evidenceFrom(resolved);

  const name = getValue(resolved, 'name', canonical.primary_name);
  if (!name) {
    console.warn(`⚠️  Skipping artist ${canonical.spotify_artist_id} – missing name`);
    return;
  }

  const isni = getValue(resolved, 'isni', null);
  const isniAll = getValue(resolved, 'isni_all', null);
  const mbid = getValue(resolved, 'mbid', null);
  const geniusArtistId = parseInteger(getValue(resolved, 'genius_artist_id', null));
  const spotifyUrl = getValue(resolved, 'spotify_url', `https://open.spotify.com/artist/${canonical.spotify_artist_id}`);
  const geniusUrl = getValue(resolved, 'genius_url', null);
  const wikidataUrl = normalizeWikidataUrl(getValue(resolved, 'wikidata_url', null) ?? getValue(resolved, 'wikidata_id', null));
  const instagramUrl = getValue(resolved, 'instagram_url', null) ?? handleToUrl('instagram', getValue(resolved, 'instagram_handle', null));
  const twitterUrl = getValue(resolved, 'twitter_url', null) ?? handleToUrl('twitter', getValue(resolved, 'twitter_handle', null));
  const imageUrl = getValue(resolved, 'image_url', canonical.image_url);
  const imageRow = resolved.find((entry) => entry.field_name === 'image_url');
  const imageSource = imageRow?.primary_source ?? null;
  const imageGroveUrl = getValue(resolved, 'image_grove_url', null);
  const imageGroveCid = getValue(resolved, 'image_grove_cid', null);
  const imageThumbnailUrl = getValue(resolved, 'image_thumbnail_url', null);
  const imageThumbnailCid = getValue(resolved, 'image_thumbnail_cid', null);

  const params = [
    canonical.spotify_artist_id,
    name,
    isni,
    isniAll,
    mbid,
    geniusArtistId,
    spotifyUrl,
    geniusUrl,
    wikidataUrl,
    instagramUrl,
    twitterUrl,
    imageUrl,
    imageSource,
    imageGroveUrl,
    imageGroveCid,
    imageThumbnailUrl,
    imageThumbnailCid,
    evidence
  ];

  await query(
    `INSERT INTO grc20_artists (
        spotify_artist_id,
        name,
        isni,
        isni_all,
        mbid,
        genius_artist_id,
        spotify_url,
        genius_url,
        wikidata_url,
        instagram_url,
        twitter_url,
        image_url,
        image_source,
        image_grove_url,
        image_grove_cid,
        image_thumbnail_url,
        image_thumbnail_cid,
        source_evidence,
        needs_update
     ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, FALSE
     )
     ON CONFLICT (spotify_artist_id) DO UPDATE SET
        name = EXCLUDED.name,
        isni = EXCLUDED.isni,
        isni_all = EXCLUDED.isni_all,
        mbid = EXCLUDED.mbid,
        genius_artist_id = EXCLUDED.genius_artist_id,
        spotify_url = EXCLUDED.spotify_url,
        genius_url = EXCLUDED.genius_url,
        wikidata_url = EXCLUDED.wikidata_url,
        instagram_url = EXCLUDED.instagram_url,
        twitter_url = EXCLUDED.twitter_url,
        image_url = EXCLUDED.image_url,
        image_source = EXCLUDED.image_source,
        image_grove_url = EXCLUDED.image_grove_url,
        image_grove_cid = EXCLUDED.image_grove_cid,
        image_thumbnail_url = EXCLUDED.image_thumbnail_url,
        image_thumbnail_cid = EXCLUDED.image_thumbnail_cid,
        source_evidence = EXCLUDED.source_evidence,
        needs_update = FALSE,
        updated_at = NOW()
    `,
    params
  );

  await syncDiscrepancies('artist', canonical.spotify_artist_id, resolved);
}

function normalizeWikidataUrl(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith('http')) return value;
  return `https://www.wikidata.org/wiki/${value}`;
}

function handleToUrl(platform: 'instagram' | 'twitter', handle: string | null): string | null {
  if (!handle) return null;
  const cleaned = handle.startsWith('@') ? handle.slice(1) : handle;
  if (!cleaned) return null;
  return platform === 'instagram'
    ? `https://www.instagram.com/${cleaned}`
    : `https://twitter.com/${cleaned}`;
}

async function upsertWork(
  canonical: CanonicalWork,
  resolved: ResolvedField[],
  artistIdMap: Map<string, { id: number; name: string | null }>
): Promise<void> {
  const evidence = evidenceFrom(resolved);

  const title = getValue(resolved, 'title', canonical.primary_title);
  if (!title) {
    console.warn(`⚠️  Skipping work ${canonical.spotify_track_id} – missing title`);
    return;
  }

  const iswc = getValue(resolved, 'iswc', null);
  const mbid = getValue(resolved, 'mbid', null);
  const spotifyUrl = getValue(resolved, 'spotify_url', `https://open.spotify.com/track/${canonical.spotify_track_id}`);
  const geniusUrl = getValue(resolved, 'genius_url', null);
  const wikidataUrl = normalizeWikidataUrl(getValue(resolved, 'wikidata_url', null) ?? getValue(resolved, 'wikidata_id', null));
  const geniusSongId = parseInteger(getValue(resolved, 'genius_song_id', null));
  const releaseDate = getValue(resolved, 'release_date', null);
  const durationMs = parseInteger(getValue(resolved, 'duration_ms', null));
  const language = getValue(resolved, 'language', null);
  const imageUrl = getValue(resolved, 'image_url', null);
  const imageRow = resolved.find((entry) => entry.field_name === 'image_url');
  const imageSource = imageRow?.primary_source ?? null;
  const imageGroveUrl = getValue(resolved, 'image_grove_url', null);
  const imageGroveCid = getValue(resolved, 'image_grove_cid', null);
  const imageThumbnailUrl = getValue(resolved, 'image_thumbnail_url', null);
  const imageThumbnailCid = getValue(resolved, 'image_thumbnail_cid', null);

  let primaryArtistId: number | null = null;
  let primaryArtistName: string | null = canonical.primary_artist_name;
  if (canonical.primary_artist_id) {
    const artistEntry = artistIdMap.get(canonical.primary_artist_id);
    if (artistEntry) {
      primaryArtistId = artistEntry.id;
      primaryArtistName = artistEntry.name ?? primaryArtistName;
    }
  }

  if (!primaryArtistName) {
    primaryArtistName = canonical.primary_artist_id ?? 'Unknown Artist';
  }

  const params = [
    canonical.spotify_track_id,
    title,
    iswc,
    mbid,
    spotifyUrl,
    geniusUrl,
    wikidataUrl,
    geniusSongId,
    releaseDate,
    durationMs,
    primaryArtistId,
    primaryArtistName,
    language,
    imageUrl,
    imageSource,
    imageGroveUrl,
    imageGroveCid,
    imageThumbnailUrl,
    imageThumbnailCid,
    evidence
  ];

  await query(
    `INSERT INTO grc20_works (
        spotify_track_id,
        title,
        iswc,
        mbid,
        spotify_url,
        genius_url,
        wikidata_url,
        genius_song_id,
        release_date,
        duration_ms,
        primary_artist_id,
        primary_artist_name,
        language,
        image_url,
        image_source,
        image_grove_url,
        image_grove_cid,
        image_thumbnail_url,
        image_thumbnail_cid,
        source_evidence,
        needs_update
     ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::DATE, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, FALSE
     )
     ON CONFLICT (spotify_track_id) DO UPDATE SET
        title = EXCLUDED.title,
        iswc = EXCLUDED.iswc,
        mbid = EXCLUDED.mbid,
        spotify_url = EXCLUDED.spotify_url,
        genius_url = EXCLUDED.genius_url,
        wikidata_url = EXCLUDED.wikidata_url,
        genius_song_id = EXCLUDED.genius_song_id,
        release_date = EXCLUDED.release_date,
        duration_ms = EXCLUDED.duration_ms,
        primary_artist_id = EXCLUDED.primary_artist_id,
        primary_artist_name = EXCLUDED.primary_artist_name,
        language = EXCLUDED.language,
        image_url = EXCLUDED.image_url,
        image_source = EXCLUDED.image_source,
        image_grove_url = EXCLUDED.image_grove_url,
        image_grove_cid = EXCLUDED.image_grove_cid,
        image_thumbnail_url = EXCLUDED.image_thumbnail_url,
        image_thumbnail_cid = EXCLUDED.image_thumbnail_cid,
        source_evidence = EXCLUDED.source_evidence,
        needs_update = FALSE,
        updated_at = NOW()
    `,
    params
  );

  await syncDiscrepancies('work', canonical.spotify_track_id, resolved);
}

async function buildArtistMap(): Promise<Map<string, { id: number; name: string | null }>> {
  const rows = await query<{ id: number; spotify_artist_id: string; name: string | null }>(
    'SELECT id, spotify_artist_id, name FROM grc20_artists'
  );
  const map = new Map<string, { id: number; name: string | null }>();
  for (const row of rows) {
    map.set(row.spotify_artist_id, { id: row.id, name: row.name });
  }
  return map;
}

async function main() {
  console.log('🚀 Populating GRC-20 tables');

  const { artistFacts, workFacts } = await populateSourceFacts();
  console.log(`   • Source facts refreshed (artists=${artistFacts}, works=${workFacts})`);

  const canonicalArtists = await query<CanonicalArtist>(
    'SELECT spotify_artist_id, primary_name, image_url FROM canonical_artists'
  );

  console.log(`   • Resolving ${canonicalArtists.length} artists`);
  for (const artist of canonicalArtists) {
    const resolved = await resolveArtistFields(artist.spotify_artist_id);
    await upsertArtist(artist, resolved);
  }

  const artistMap = await buildArtistMap();

  const canonicalWorks = await query<CanonicalWork>(
    'SELECT spotify_track_id, primary_title, primary_artist_id, primary_artist_name FROM canonical_works'
  );

  console.log(`   • Resolving ${canonicalWorks.length} works`);
  for (const work of canonicalWorks) {
    const resolved = await resolveWorkFields(work.spotify_track_id);
    await upsertWork(work, resolved, artistMap);
  }

  console.log('✅ GRC-20 population complete');
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('❌ populate-grc20 task failed:', error);
    process.exitCode = 1;
  });
}
