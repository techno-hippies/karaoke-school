#!/usr/bin/env bun
/**
 * Full GRC-20 population task
 *
 * 1. Refresh source facts (artist & work staging tables)
 * 2. Resolve definitive values using SQL helpers
 * 3. Upsert rows into grc20_artists / grc20_works with provenance
 * 4. Log discrepancies surfaced during resolution
 */

import 'dotenv/config';

import { populateSourceFacts } from './populate-source-facts';
import { query } from '../../db/connection';
import { normalizeISWC } from '../../utils/iswc';
import { getWikidataArtist } from '../../services/wikidata';
import { upsertWikidataArtistSQL } from '../../db/wikidata';
import {
  createArtistTask,
  getArtistTask,
  startArtistTask,
  completeArtistTask,
  failArtistTask,
} from '../../db/artist-tasks';

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

function parseJson<T>(value: string | null, fallback: T | null = null): T | null {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn(`⚠️  Failed to parse JSON value: ${error instanceof Error ? error.message : String(error)}`);
    return fallback;
  }
}

function normalizeLensHandle(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith('@') ? value : `@${value}`;
}

function extractWikidataIdFromUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const match = url.match(/Q\d+/i);
  return match ? match[0] : null;
}

async function resolveWikidataId(spotifyArtistId: string): Promise<{ wikidataId: string | null; source: 'quansic' | 'musicbrainz' | null }> {
  const quansicRows = await query<{ wikidata_ids: any }>(
    `SELECT metadata->'ids'->'wikidataIds' AS wikidata_ids
       FROM quansic_artists
      WHERE spotify_artist_id = $1
      LIMIT 1`,
    [spotifyArtistId]
  );

  let wikidataId: string | null = null;
  let source: 'quansic' | 'musicbrainz' | null = null;

  if (quansicRows.length > 0) {
    const raw = quansicRows[0].wikidata_ids;
    if (Array.isArray(raw)) {
      const candidate = raw.find((entry) => typeof entry === 'string' && entry.startsWith('Q'));
      if (candidate) {
        wikidataId = candidate;
        source = 'quansic';
      }
    } else if (typeof raw === 'string' && raw.startsWith('Q')) {
      wikidataId = raw;
      source = 'quansic';
    }
  }

  if (!wikidataId) {
    const mbRows = await query<{ wikidata_id: string | null; all_urls: Record<string, unknown> | null }>(
      `SELECT wikidata_id, all_urls
         FROM musicbrainz_artists
        WHERE spotify_id = $1
        LIMIT 1`,
      [spotifyArtistId]
    );

    if (mbRows.length > 0) {
      const row = mbRows[0];
      if (row.wikidata_id) {
        wikidataId = row.wikidata_id;
        source = 'musicbrainz';
      } else if (row.all_urls) {
        const urls = Object.values(row.all_urls);
        for (const url of urls) {
          const candidate = extractWikidataIdFromUrl(url);
          if (candidate) {
            wikidataId = candidate;
            source = 'musicbrainz';
            break;
          }
        }
      }
    }
  }

  return { wikidataId, source };
}

async function ensureWikidataTaskRecord(artistId: string): Promise<void> {
  const existing = await getArtistTask(artistId, 'wikidata_enrichment');
  if (!existing) {
    await createArtistTask(artistId, 'wikidata_enrichment');
  }
}

async function ensureWikidataCoverage(artists: CanonicalArtist[]): Promise<void> {
  if (artists.length === 0) return;

  const spotifyIds = artists.map((artist) => artist.spotify_artist_id);

  const missing = await query<{ spotify_artist_id: string }>(
    `SELECT ca.spotify_artist_id
       FROM canonical_artists ca
       LEFT JOIN wikidata_artists wa
         ON wa.spotify_id = ca.spotify_artist_id
      WHERE ca.spotify_artist_id = ANY($1::text[])
        AND (
          wa.wikidata_id IS NULL
          OR wa.name IS NULL
          OR wa.name = wa.wikidata_id
        )`,
    [spotifyIds]
  );

  if (missing.length === 0) {
    return;
  }

  console.log(`   • Fetching Wikidata metadata for ${missing.length} artists`);

  const failures: string[] = [];

  for (const { spotify_artist_id } of missing) {
    const artistName = artists.find((artist) => artist.spotify_artist_id === spotify_artist_id)?.primary_name ?? spotify_artist_id;

    await ensureWikidataTaskRecord(spotify_artist_id);

    const canonicalName = artists.find((artist) => artist.spotify_artist_id === spotify_artist_id)?.primary_name;
    const { wikidataId, source } = await resolveWikidataId(spotify_artist_id);
    if (!wikidataId) {
      const message = 'No Wikidata ID found via Quansic or MusicBrainz';
      await failArtistTask(spotify_artist_id, 'wikidata_enrichment', message);
      failures.push(`${artistName} (${spotify_artist_id}): ${message}`);
      continue;
    }

    await startArtistTask(spotify_artist_id, 'wikidata_enrichment');

    try {
      const wikidataArtist = await getWikidataArtist(wikidataId, canonicalName ?? artistName);
      if (!wikidataArtist) {
        const message = `Wikidata entity ${wikidataId} not found`;
        await failArtistTask(spotify_artist_id, 'wikidata_enrichment', message);
        failures.push(`${artistName} (${spotify_artist_id}): ${message}`);
        continue;
      }

      await query(upsertWikidataArtistSQL(wikidataArtist, spotify_artist_id));
      await completeArtistTask(spotify_artist_id, 'wikidata_enrichment', {
        wikidata_id: wikidataId,
        source: source ?? 'unknown',
      });

      console.log(`      ✅ ${artistName} → ${wikidataId}`);

      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error: any) {
      const message = error?.message ?? String(error);
      await failArtistTask(spotify_artist_id, 'wikidata_enrichment', message);
      failures.push(`${artistName} (${spotify_artist_id}): ${message}`);
    }
  }

  const remaining = await query<{ spotify_artist_id: string }>(
    `SELECT ca.spotify_artist_id
       FROM canonical_artists ca
       LEFT JOIN wikidata_artists wa
         ON wa.spotify_id = ca.spotify_artist_id
      WHERE ca.spotify_artist_id = ANY($1::text[])
        AND (
          wa.wikidata_id IS NULL
          OR wa.name IS NULL
          OR wa.name = wa.wikidata_id
        )`,
    [spotifyIds]
  );

  if (remaining.length > 0) {
    for (const { spotify_artist_id } of remaining) {
      const artistName = artists.find((artist) => artist.spotify_artist_id === spotify_artist_id)?.primary_name ?? spotify_artist_id;
      const message = 'Missing Wikidata metadata after enrichment attempt';
      failures.push(`${artistName} (${spotify_artist_id}): ${message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Wikidata enrichment incomplete:\n${failures.map((failure) => ` - ${failure}`).join('\n')}`);
  }
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
  const tiktokUrl = getValue(resolved, 'tiktok_url', null);
  const youtubeUrl = getValue(resolved, 'youtube_url', null);
  const soundcloudUrl = getValue(resolved, 'soundcloud_url', null);
  const facebookUrl = getValue(resolved, 'facebook_url', null);
  const deezerUrl = getValue(resolved, 'deezer_url', null);
  const appleMusicUrl = getValue(resolved, 'apple_music_url', null);
  const bandcampUrl = getValue(resolved, 'bandcamp_url', null);
  const songkickUrl = getValue(resolved, 'songkick_url', null);
  const setlistfmUrl = getValue(resolved, 'setlistfm_url', null);
  const lastfmUrl = getValue(resolved, 'lastfm_url', null);
  const pitchforkUrl = getValue(resolved, 'pitchfork_url', null);
  const songfactsUrl = getValue(resolved, 'songfacts_url', null);
  const musixmatchUrl = getValue(resolved, 'musixmatch_url', null);
  const rateyourmusicUrl = getValue(resolved, 'rateyourmusic_url', null);
  const discogsUrl = getValue(resolved, 'discogs_url', null);
  const allmusicUrl = getValue(resolved, 'allmusic_url', null);
  const imdbUrl = getValue(resolved, 'imdb_url', null);
  const weiboUrl = getValue(resolved, 'weibo_url', null);
  const vkUrl = getValue(resolved, 'vk_url', null);
  const subredditUrl = getValue(resolved, 'subreddit_url', null);
  const carnegieHallUrl = getValue(resolved, 'carnegie_hall_url', null);
  const wikipediaUrl = getValue(resolved, 'wikipedia_url', null);
  const wikipediaUrls = parseJson<Record<string, string>>(getValue(resolved, 'wikipedia_urls', null));
  const lensHandle = normalizeLensHandle(getValue(resolved, 'lens_handle', null));
  const imageUrl = getValue(resolved, 'image_url', canonical.image_url);
  const imageGroveUrl = getValue(resolved, 'image_grove_url', null);
  const imageGroveCid = getValue(resolved, 'image_grove_cid', null);
  const imageThumbnailUrl = getValue(resolved, 'image_thumbnail_url', null);
  const imageThumbnailCid = getValue(resolved, 'image_thumbnail_cid', null);
  const artistType = getValue(resolved, 'artist_type', null);
  const country = getValue(resolved, 'country', null);
  const genres = getValue(resolved, 'genres', null);
  const viafId = getValue(resolved, 'viaf_id', null) ?? getValue(resolved, 'viaf', null);
  const bnfId = getValue(resolved, 'bnf_id', null);
  const gndId = getValue(resolved, 'gnd_id', null);
  const locId = getValue(resolved, 'loc_id', null);
  const libraryIds = parseJson<Record<string, any>>(getValue(resolved, 'library_ids', null));
  const externalIds = parseJson<Record<string, any>>(getValue(resolved, 'external_ids', null));
  const aliases = parseJson<Record<string, string[]>>(getValue(resolved, 'aliases', null));
  const libraryIdsJson = libraryIds ? JSON.stringify(libraryIds) : null;
  const externalIdsJson = externalIds ? JSON.stringify(externalIds) : null;
  const aliasesJson = aliases ? JSON.stringify(aliases) : null;
  const officialWebsite = getValue(resolved, 'official_website', null);

  // Extract discogs_id from external_ids or parse from discogs_url
  // Handle both single ID and array of IDs from external_ids
  let discogsId: string | null = null;
  if (externalIds?.discogs) {
    const rawDiscogs = externalIds.discogs;
    if (Array.isArray(rawDiscogs)) {
      discogsId = rawDiscogs[0]; // Take first ID if multiple
    } else {
      discogsId = String(rawDiscogs);
    }
  } else if (discogsUrl) {
    discogsId = discogsUrl.match(/\/(\d+)$/)?.[1] ?? null;
  }

  // Flatten aliases->en into alternate_names for backward compatibility
  const alternateNames = aliases?.en ? aliases.en.slice(0, 5).join(', ') : null;

  const params = [
    canonical.spotify_artist_id,
    name,
    alternateNames,
    discogsId,
    isni,
    isniAll,
    mbid,
    geniusArtistId,
    spotifyUrl,
    geniusUrl,
    wikidataUrl,
    instagramUrl,
    twitterUrl,
    tiktokUrl,
    youtubeUrl,
    soundcloudUrl,
    bandcampUrl,
    songkickUrl,
    setlistfmUrl,
    lastfmUrl,
    pitchforkUrl,
    songfactsUrl,
    musixmatchUrl,
    rateyourmusicUrl,
    discogsUrl,
    allmusicUrl,
    imdbUrl,
    facebookUrl,
    deezerUrl,
    appleMusicUrl,
    weiboUrl,
    vkUrl,
    subredditUrl,
    carnegieHallUrl,
    wikipediaUrl,
    wikipediaUrls,
    lensHandle,
    officialWebsite,
    imageUrl,
    imageGroveUrl,
    imageGroveCid,
    imageThumbnailUrl,
    imageThumbnailCid,
    artistType,
    country,
    genres,
    viafId,
    bnfId,
    gndId,
    locId,
    libraryIdsJson,
    externalIdsJson,
    aliasesJson,
    evidence
  ];

  await query(
    `INSERT INTO grc20_artists (
        spotify_artist_id,
        name,
        alternate_names,
        discogs_id,
        isni,
        isni_all,
        mbid,
        genius_artist_id,
        spotify_url,
        genius_url,
        wikidata_url,
        instagram_url,
        twitter_url,
        tiktok_url,
        youtube_url,
        soundcloud_url,
        bandcamp_url,
        songkick_url,
        setlistfm_url,
        lastfm_url,
        pitchfork_url,
        songfacts_url,
        musixmatch_url,
        rateyourmusic_url,
        discogs_url,
        allmusic_url,
        imdb_url,
        facebook_url,
        deezer_url,
        apple_music_url,
        weibo_url,
        vk_url,
        subreddit_url,
        carnegie_hall_url,
        wikipedia_url,
        wikipedia_urls,
        lens_handle,
        official_website,
        image_url,
        image_grove_url,
        image_grove_cid,
        image_thumbnail_url,
        image_thumbnail_cid,
        artist_type,
        country,
        genres,
        viaf_id,
        bnf_id,
        gnd_id,
        loc_id,
        library_ids,
        external_ids,
        aliases,
        source_evidence,
        needs_update
     ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, FALSE
     )
     ON CONFLICT (spotify_artist_id) DO UPDATE SET
        name = EXCLUDED.name,
        alternate_names = EXCLUDED.alternate_names,
        discogs_id = EXCLUDED.discogs_id,
        isni = EXCLUDED.isni,
        isni_all = EXCLUDED.isni_all,
        mbid = EXCLUDED.mbid,
        genius_artist_id = EXCLUDED.genius_artist_id,
        spotify_url = EXCLUDED.spotify_url,
        genius_url = EXCLUDED.genius_url,
        wikidata_url = EXCLUDED.wikidata_url,
        instagram_url = EXCLUDED.instagram_url,
        twitter_url = EXCLUDED.twitter_url,
        tiktok_url = EXCLUDED.tiktok_url,
        youtube_url = EXCLUDED.youtube_url,
        soundcloud_url = EXCLUDED.soundcloud_url,
        bandcamp_url = EXCLUDED.bandcamp_url,
        songkick_url = EXCLUDED.songkick_url,
        setlistfm_url = EXCLUDED.setlistfm_url,
        lastfm_url = EXCLUDED.lastfm_url,
        pitchfork_url = EXCLUDED.pitchfork_url,
        songfacts_url = EXCLUDED.songfacts_url,
        musixmatch_url = EXCLUDED.musixmatch_url,
        rateyourmusic_url = EXCLUDED.rateyourmusic_url,
        discogs_url = EXCLUDED.discogs_url,
        allmusic_url = EXCLUDED.allmusic_url,
        imdb_url = EXCLUDED.imdb_url,
        facebook_url = EXCLUDED.facebook_url,
        deezer_url = EXCLUDED.deezer_url,
        apple_music_url = EXCLUDED.apple_music_url,
        weibo_url = EXCLUDED.weibo_url,
        vk_url = EXCLUDED.vk_url,
        subreddit_url = EXCLUDED.subreddit_url,
        carnegie_hall_url = EXCLUDED.carnegie_hall_url,
        wikipedia_url = EXCLUDED.wikipedia_url,
        wikipedia_urls = EXCLUDED.wikipedia_urls,
        lens_handle = EXCLUDED.lens_handle,
        official_website = EXCLUDED.official_website,
        image_url = EXCLUDED.image_url,
        image_grove_url = EXCLUDED.image_grove_url,
        image_grove_cid = EXCLUDED.image_grove_cid,
        image_thumbnail_url = EXCLUDED.image_thumbnail_url,
        image_thumbnail_cid = EXCLUDED.image_thumbnail_cid,
        artist_type = EXCLUDED.artist_type,
        country = EXCLUDED.country,
        genres = EXCLUDED.genres,
        viaf_id = EXCLUDED.viaf_id,
        bnf_id = EXCLUDED.bnf_id,
        gnd_id = EXCLUDED.gnd_id,
        loc_id = EXCLUDED.loc_id,
        library_ids = EXCLUDED.library_ids,
        external_ids = EXCLUDED.external_ids,
        aliases = EXCLUDED.aliases,
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

  const iswcRow = resolved.find((entry) => entry.field_name === 'iswc');
  const rawIswc = iswcRow?.value ?? null;
  const iswc = normalizeISWC(rawIswc);
  const iswcSource = iswcRow?.primary_source ?? getValue(resolved, 'iswc_source', null);
  const mbid = getValue(resolved, 'mbid', null);
  const isrc = getValue(resolved, 'isrc', null);
  const spotifyUrl = getValue(resolved, 'spotify_url', `https://open.spotify.com/track/${canonical.spotify_track_id}`);
  const geniusUrl = getValue(resolved, 'genius_url', null);
  const wikidataUrl = normalizeWikidataUrl(getValue(resolved, 'wikidata_url', null) ?? getValue(resolved, 'wikidata_id', null));
  const geniusSongId = parseInteger(getValue(resolved, 'genius_song_id', null));
  const releaseDate = getValue(resolved, 'release_date', null);
  const durationMs = parseInteger(getValue(resolved, 'duration_ms', null));
  const language = getValue(resolved, 'language', null);
  const imageUrl = getValue(resolved, 'image_url', null);
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
    iswcSource,
    isrc,
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
        iswc_source,
        isrc,
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
        image_grove_url,
        image_grove_cid,
        image_thumbnail_url,
        image_thumbnail_cid,
        source_evidence,
        needs_update
     ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, FALSE
     )
     ON CONFLICT (spotify_track_id) DO UPDATE SET
        title = EXCLUDED.title,
        iswc = EXCLUDED.iswc,
        iswc_source = EXCLUDED.iswc_source,
        isrc = EXCLUDED.isrc,
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

  // Only process artists that already have valid Wikidata metadata
  // This skips illegitimate artists blocked by the GRC-20 legitimacy gate
  const canonicalArtists = await query<CanonicalArtist>(
    `SELECT ca.spotify_artist_id, ca.primary_name, ca.image_url
     FROM canonical_artists ca
     JOIN wikidata_artists wa ON wa.spotify_id = ca.spotify_artist_id
     WHERE wa.wikidata_id IS NOT NULL
       AND wa.name IS NOT NULL
       AND wa.name != wa.wikidata_id`
  );

  console.log(`   • Processing ${canonicalArtists.length} artists with valid Wikidata`);

  await ensureWikidataCoverage(canonicalArtists);

  const { artistFacts, workFacts } = await populateSourceFacts();
  console.log(`   • Source facts refreshed (artists=${artistFacts}, works=${workFacts})`);

  console.log(`   • Resolving ${canonicalArtists.length} artists`);
  for (const artist of canonicalArtists) {
    const resolved = await resolveArtistFields(artist.spotify_artist_id);
    await upsertArtist(artist, resolved);
  }

  const artistMap = await buildArtistMap();

  // Only process works by legitimate artists (those with Wikidata)
  const canonicalWorks = await query<CanonicalWork>(
    `SELECT cw.spotify_track_id, cw.primary_title, cw.primary_artist_id, cw.primary_artist_name
     FROM canonical_works cw
     JOIN wikidata_artists wa ON wa.spotify_id = cw.primary_artist_id
     WHERE wa.wikidata_id IS NOT NULL
       AND wa.name IS NOT NULL
       AND wa.name != wa.wikidata_id`
  );

  console.log(`   • Resolving ${canonicalWorks.length} works (filtered for legitimate artists)`);
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
