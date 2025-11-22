#!/usr/bin/env bun
/**
 * Populate artist_source_facts & work_source_facts
 *
 * Pulls canonical artists/works from the pipeline and upserts per-field
 * values with provenance, ready for the GRC-20 resolution functions.
 */

import 'dotenv/config';

import { query } from '../../db/connection';
import { uploadToGrove } from '../../services/storage';
import sharp from 'sharp';
import { normalizeISWC } from '../../utils/iswc';

type ArtistFact = {
  artistId: string;
  field: string;
  source: string;
  value: string | null;
  confidence: number;
  raw?: Record<string, any> | null;
};

type WorkFact = {
  trackId: string;
  field: string;
  source: string;
  value: string | null;
  confidence: number;
  raw?: Record<string, any> | null;
};

const THUMBNAIL_SIZE = 256;

type GroveAsset = {
  url: string;
  cid: string | null;
};

type PipelineImageAssets = {
  original: GroveAsset | null;
  thumbnail: GroveAsset | null;
};

let artistImageCache: Map<string, PipelineImageAssets> | null = null;
let workImageCache: Map<string, PipelineImageAssets> | null = null;

async function loadPipelineImageCache(kind: 'artist' | 'work'): Promise<Map<string, PipelineImageAssets>> {
  if (kind === 'artist' && artistImageCache) return artistImageCache;
  if (kind === 'work' && workImageCache) return workImageCache;

  const rows = await query<{
    id: string;
    original_url: string | null;
    original_cid: string | null;
    thumbnail_url: string | null;
    thumbnail_cid: string | null;
  }>(
    kind === 'artist'
      ? `SELECT spotify_artist_id AS id,
               MAX(CASE WHEN field_name = 'image_grove_url' THEN field_value END) AS original_url,
               MAX(CASE WHEN field_name = 'image_grove_cid' THEN field_value END) AS original_cid,
               MAX(CASE WHEN field_name = 'image_thumbnail_url' THEN field_value END) AS thumbnail_url,
               MAX(CASE WHEN field_name = 'image_thumbnail_cid' THEN field_value END) AS thumbnail_cid
          FROM artist_source_facts
         WHERE field_name IN ('image_grove_url','image_grove_cid','image_thumbnail_url','image_thumbnail_cid')
           AND source = 'pipeline'
      GROUP BY spotify_artist_id`
      : `SELECT spotify_track_id AS id,
               MAX(CASE WHEN field_name = 'image_grove_url' THEN field_value END) AS original_url,
               MAX(CASE WHEN field_name = 'image_grove_cid' THEN field_value END) AS original_cid,
               MAX(CASE WHEN field_name = 'image_thumbnail_url' THEN field_value END) AS thumbnail_url,
               MAX(CASE WHEN field_name = 'image_thumbnail_cid' THEN field_value END) AS thumbnail_cid
          FROM work_source_facts
         WHERE field_name IN ('image_grove_url','image_grove_cid','image_thumbnail_url','image_thumbnail_cid')
           AND source = 'pipeline'
      GROUP BY spotify_track_id`
  );

  const cache = new Map<string, PipelineImageAssets>();
  for (const row of rows) {
    if (!row.id) continue;
    cache.set(row.id, {
      original: row.original_url ? { url: row.original_url, cid: row.original_cid } : null,
      thumbnail: row.thumbnail_url ? { url: row.thumbnail_url, cid: row.thumbnail_cid } : null
    });
  }

  if (kind === 'artist') {
    artistImageCache = cache;
  } else {
    workImageCache = cache;
  }

  return cache;
}

function inferExtension(contentType: string | null, fallback: string): string {
  if (!contentType) return fallback;
  if (contentType.includes('jpeg')) return 'jpg';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return fallback;
}

async function ensurePipelineImages(
  kind: 'artist' | 'work',
  id: string,
  sourceUrl: string | null
): Promise<PipelineImageAssets | null> {
  if (!sourceUrl) return null;

  const cache = await loadPipelineImageCache(kind);
  const existing = cache.get(id) ?? { original: null, thumbnail: null };

  let { original, thumbnail } = existing;
  const needsOriginal = !original;
  const needsThumbnail = !thumbnail;

  if (!needsOriginal && !needsThumbnail) {
    return existing;
  }

  try {
    const sourceForDownload = needsOriginal ? sourceUrl : (original?.url ?? sourceUrl);
    const response = await fetch(sourceForDownload);
    if (!response.ok) {
      console.warn(`[GRC20] Failed to fetch image for ${kind} ${id}: ${response.status}`);
      return existing.original || existing.thumbnail ? existing : null;
    }

    const baseBuffer = Buffer.from(await response.arrayBuffer());
    if (baseBuffer.length === 0) {
      console.warn(`[GRC20] Empty image payload for ${kind} ${id}`);
      return existing.original || existing.thumbnail ? existing : null;
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const urlWithoutQuery = sourceUrl.split('?')[0];
    const fallbackExt = urlWithoutQuery.includes('.')
      ? urlWithoutQuery.split('.').pop() ?? 'bin'
      : 'bin';
    const extension = inferExtension(contentType, fallbackExt);
    const baseFileName = `${kind}-${id}`;

    if (needsOriginal) {
      const upload = await uploadToGrove(baseBuffer, contentType, `${baseFileName}.${extension}`);
      original = { url: upload.url, cid: upload.cid };
    }

    if (needsThumbnail) {
      const thumbBuffer = await sharp(baseBuffer)
        .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbUpload = await uploadToGrove(thumbBuffer, 'image/jpeg', `${baseFileName}-thumb.jpg`);
      thumbnail = { url: thumbUpload.url, cid: thumbUpload.cid };
    }

    const assets: PipelineImageAssets = { original, thumbnail };
    cache.set(id, assets);
    return assets;
  } catch (error: any) {
    console.warn(`[GRC20] Error processing image for ${kind} ${id}: ${error.message}`);
    return existing.original || existing.thumbnail ? existing : null;
  }
}

async function insertArtistFacts(facts: ArtistFact[]): Promise<number> {
  const rows = facts.filter((fact) => fact.value && fact.value.trim().length > 0);
  if (rows.length === 0) return 0;

  const params: any[] = [];
  const placeholders = rows
    .map((fact, idx) => {
      const base = idx * 6;
      params.push(
        fact.artistId,
        fact.field,
        fact.source,
        fact.value,
        fact.confidence,
        fact.raw ?? null
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
    })
    .join(', ');

  await query(
    `INSERT INTO artist_source_facts
       (spotify_artist_id, field_name, source, field_value, confidence, raw_payload)
     VALUES ${placeholders}
     ON CONFLICT (spotify_artist_id, field_name, source)
     DO UPDATE SET
       field_value = EXCLUDED.field_value,
       confidence  = EXCLUDED.confidence,
       raw_payload = EXCLUDED.raw_payload,
       fetched_at  = NOW()`,
    params
  );

  return rows.length;
}

async function insertWorkFacts(facts: WorkFact[]): Promise<number> {
  const rows = facts.filter((fact) => fact.value && fact.value.trim().length > 0);
  if (rows.length === 0) return 0;

  const params: any[] = [];
  const placeholders = rows
    .map((fact, idx) => {
      const base = idx * 6;
      params.push(
        fact.trackId,
        fact.field,
        fact.source,
        fact.value,
        fact.confidence,
        fact.raw ?? null
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
    })
    .join(', ');

  await query(
    `INSERT INTO work_source_facts
       (spotify_track_id, field_name, source, field_value, confidence, raw_payload)
     VALUES ${placeholders}
     ON CONFLICT (spotify_track_id, field_name, source)
     DO UPDATE SET
       field_value = EXCLUDED.field_value,
       confidence  = EXCLUDED.confidence,
       raw_payload = EXCLUDED.raw_payload,
       fetched_at  = NOW()`,
    params
  );

  return rows.length;
}

// ---------------------------------------------------------------------------
// Artist collectors
// ---------------------------------------------------------------------------

async function collectSpotifyArtistFacts(): Promise<ArtistFact[]> {
  const rows = await query<{
    spotify_artist_id: string;
    name: string;
    external_urls: Record<string, string> | null;
    images: Array<{ url: string }> | null;
  }>(
    `SELECT ca.spotify_artist_id,
            sa.name,
            sa.external_urls,
            sa.images
       FROM canonical_artists ca
       JOIN spotify_artists sa
         ON sa.spotify_artist_id = ca.spotify_artist_id`
  );

  const facts: ArtistFact[] = [];

  for (const row of rows) {
    if (row.name) {
      facts.push({
        artistId: row.spotify_artist_id,
        field: 'name',
        source: 'spotify',
        value: row.name,
        confidence: 0.80,
        raw: { name: row.name }
      });
    }

    const spotifyUrl = row.external_urls?.spotify ?? `https://open.spotify.com/artist/${row.spotify_artist_id}`;
    facts.push({
      artistId: row.spotify_artist_id,
      field: 'spotify_url',
      source: 'spotify',
      value: spotifyUrl,
      confidence: 0.80,
      raw: { external_urls: row.external_urls }
    });

    const imageUrl = row.images?.[0]?.url ?? null;
    if (imageUrl) {
      facts.push({
        artistId: row.spotify_artist_id,
        field: 'image_url',
        source: 'spotify',
        value: imageUrl,
        confidence: 0.75,
        raw: { image: imageUrl }
      });

      const assets = await ensurePipelineImages('artist', row.spotify_artist_id, imageUrl);
      if (assets?.original) {
        facts.push({
          artistId: row.spotify_artist_id,
          field: 'image_url',
          source: 'pipeline',
          value: assets.original.url,
          confidence: 1.0,
          raw: { cid: assets.original.cid, original_url: imageUrl }
        });

        facts.push({
          artistId: row.spotify_artist_id,
          field: 'image_grove_url',
          source: 'pipeline',
          value: assets.original.url,
          confidence: 1.0,
          raw: { cid: assets.original.cid, original_url: imageUrl }
        });

        if (assets.original.cid) {
          facts.push({
            artistId: row.spotify_artist_id,
            field: 'image_grove_cid',
            source: 'pipeline',
            value: assets.original.cid,
            confidence: 1.0,
            raw: { original_url: imageUrl }
          });
        }
      }

      if (assets?.thumbnail) {
        facts.push({
          artistId: row.spotify_artist_id,
          field: 'image_thumbnail_url',
          source: 'pipeline',
          value: assets.thumbnail.url,
          confidence: 1.0,
          raw: { cid: assets.thumbnail.cid, original_url: imageUrl }
        });

        if (assets.thumbnail.cid) {
          facts.push({
            artistId: row.spotify_artist_id,
            field: 'image_thumbnail_cid',
            source: 'pipeline',
            value: assets.thumbnail.cid,
            confidence: 1.0,
            raw: { original_url: imageUrl }
          });
        }
      }
    }
  }

  return facts;
}

async function collectMusicBrainzArtistFacts(): Promise<ArtistFact[]> {
  const rows = await query<{
    spotify_id: string | null;
    artist_mbid: string | null;
    isni: string | null;
    isnis: string[] | null;
    all_urls: Record<string, string> | null;
    social_media: Record<string, string> | null;
    streaming: Record<string, string> | null;
    aliases: Array<Record<string, any>> | null;
    artist_type: string | null;
    country: string | null;
    genres: Array<{ name: string }> | null;
  }>(
    `SELECT ma.spotify_id,
            ma.artist_mbid,
            ma.isni,
            ma.isnis,
            ma.all_urls,
            ma.social_media,
            ma.streaming,
            ma.aliases,
            ma.artist_type,
            ma.country,
            ma.genres
       FROM musicbrainz_artists ma
       JOIN canonical_artists ca
         ON ca.spotify_artist_id = ma.spotify_id`
  );

  const facts: ArtistFact[] = [];

  for (const row of rows) {
    if (!row.spotify_id) continue;

    if (row.artist_type) {
      facts.push({
        artistId: row.spotify_id,
        field: 'artist_type',
        source: 'musicbrainz',
        value: row.artist_type,
        confidence: 0.75,
        raw: null
      });
    }

    if (row.country) {
      facts.push({
        artistId: row.spotify_id,
        field: 'country',
        source: 'musicbrainz',
        value: row.country,
        confidence: 0.75,
        raw: null
      });
    }

    if (row.genres && row.genres.length > 0) {
      const genres = row.genres.map((g) => g.name).filter(Boolean);
      if (genres.length > 0) {
        facts.push({
          artistId: row.spotify_id,
          field: 'genres',
          source: 'musicbrainz',
          value: genres.join(', '),
          confidence: 0.7,
          raw: null
        });
      }
    }

    if (row.artist_mbid) {
      facts.push({
        artistId: row.spotify_id,
        field: 'mbid',
        source: 'musicbrainz',
        value: row.artist_mbid,
        confidence: 0.90,
        raw: null
      });
    }

    if (row.isni) {
      facts.push({
        artistId: row.spotify_id,
        field: 'isni',
        source: 'musicbrainz',
        value: row.isni,
        confidence: 0.90,
        raw: null
      });
    }

    if (row.isnis && row.isnis.length > 0) {
      facts.push({
        artistId: row.spotify_id,
        field: 'isni_all',
        source: 'musicbrainz',
        value: row.isnis.join(', '),
        confidence: 0.90,
        raw: null
      });
    }

    if (row.aliases && row.aliases.length > 0) {
      const aliasMap: Record<string, string[]> = {};
      for (const alias of row.aliases) {
        const locale = (alias as any).locale ?? 'und';
        if (!aliasMap[locale]) aliasMap[locale] = [];
        const name = (alias as any).name;
        if (name) aliasMap[locale].push(name);
      }
      if (Object.keys(aliasMap).length > 0) {
        facts.push({
          artistId: row.spotify_id,
          field: 'aliases',
          source: 'musicbrainz',
          value: JSON.stringify(aliasMap),
          confidence: 0.75,
          raw: null
        });
      }
    }

    if (row.all_urls) {
      const spotifyUrl = extractUrl(row.all_urls, 'open.spotify.com/artist/');
      if (spotifyUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'spotify_url',
          source: 'musicbrainz',
          value: spotifyUrl,
          confidence: 0.88,
          raw: { key: findKey(row.all_urls, spotifyUrl) }
        });
      }

      const instagramUrl = extractUrl(row.all_urls, 'instagram.com/');
      if (instagramUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'instagram_url',
          source: 'musicbrainz',
          value: instagramUrl,
          confidence: 0.75,
          raw: { key: findKey(row.all_urls, instagramUrl) }
        });
      }

      const twitterUrl = extractUrl(row.all_urls, 'twitter.com/');
      if (twitterUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'twitter_url',
          source: 'musicbrainz',
          value: twitterUrl,
          confidence: 0.75,
          raw: { key: findKey(row.all_urls, twitterUrl) }
        });
      }

      const wikidataUrl = extractUrl(row.all_urls, 'wikidata.org/wiki/');
      if (wikidataUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'wikidata_url',
          source: 'musicbrainz',
          value: wikidataUrl,
          confidence: 0.85,
          raw: { key: findKey(row.all_urls, wikidataUrl) }
        });
      }

      const tiktokUrl = row.social_media?.tiktok ?? extractUrl(row.all_urls, 'tiktok.com/');
      if (tiktokUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'tiktok_url',
          source: 'musicbrainz',
          value: tiktokUrl,
          confidence: 0.7,
          raw: null
        });
      }

      const youtubeUrl = row.social_media?.youtube ?? extractUrl(row.all_urls, 'youtube.com/');
      if (youtubeUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'youtube_url',
          source: 'musicbrainz',
          value: youtubeUrl,
          confidence: 0.7,
          raw: null
        });
      }

      const soundcloudUrl = row.social_media?.soundcloud ?? extractUrl(row.all_urls, 'soundcloud.com/');
      if (soundcloudUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'soundcloud_url',
          source: 'musicbrainz',
          value: soundcloudUrl,
          confidence: 0.7,
          raw: null
        });
      }

      const bandcampUrl = extractUrl(row.all_urls, 'bandcamp.com/');
      if (bandcampUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'bandcamp_url',
          source: 'musicbrainz',
          value: bandcampUrl,
          confidence: 0.7,
          raw: null
        });
      }

      const songkickUrl = extractUrl(row.all_urls, 'songkick.com/');
      if (songkickUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'songkick_url',
          source: 'musicbrainz',
          value: songkickUrl,
          confidence: 0.7,
          raw: null
        });
      }

      const setlistfmUrl = extractUrl(row.all_urls, 'setlist.fm/');
      if (setlistfmUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'setlistfm_url',
          source: 'musicbrainz',
          value: setlistfmUrl,
          confidence: 0.7,
          raw: null
        });
      }

      const lastfmUrl = extractUrl(row.all_urls, 'last.fm/');
      if (lastfmUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'lastfm_url',
          source: 'musicbrainz',
          value: lastfmUrl,
          confidence: 0.7,
          raw: null
        });
      }

      const pitchforkUrl = extractUrl(row.all_urls, 'pitchfork.com/');
      if (pitchforkUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'pitchfork_url',
          source: 'musicbrainz',
          value: pitchforkUrl,
          confidence: 0.65,
          raw: null
        });
      }

      const songfactsUrl = extractUrl(row.all_urls, 'songfacts.com/');
      if (songfactsUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'songfacts_url',
          source: 'musicbrainz',
          value: songfactsUrl,
          confidence: 0.65,
          raw: null
        });
      }

      const musixmatchUrl = extractUrl(row.all_urls, 'musixmatch.com/');
      if (musixmatchUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'musixmatch_url',
          source: 'musicbrainz',
          value: musixmatchUrl,
          confidence: 0.65,
          raw: null
        });
      }

      const rateyourmusicUrl = extractUrl(row.all_urls, 'rateyourmusic.com/');
      if (rateyourmusicUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'rateyourmusic_url',
          source: 'musicbrainz',
          value: rateyourmusicUrl,
          confidence: 0.65,
          raw: null
        });
      }

      const discogsUrl = extractUrl(row.all_urls, 'discogs.com/');
      if (discogsUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'discogs_url',
          source: 'musicbrainz',
          value: discogsUrl,
          confidence: 0.85,
          raw: null
        });
      }

      const allmusicUrl = extractUrl(row.all_urls, 'allmusic.com/');
      if (allmusicUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'allmusic_url',
          source: 'musicbrainz',
          value: allmusicUrl,
          confidence: 0.85,
          raw: null
        });
      }

      const imdbUrl = extractUrl(row.all_urls, 'imdb.com/');
      if (imdbUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'imdb_url',
          source: 'musicbrainz',
          value: imdbUrl,
          confidence: 0.65,
          raw: null
        });
      }

      const weiboUrlMb = extractUrl(row.all_urls, 'weibo.com/');
      if (weiboUrlMb) {
        facts.push({
          artistId: row.spotify_id,
          field: 'weibo_url',
          source: 'musicbrainz',
          value: weiboUrlMb,
          confidence: 0.6,
          raw: null
        });
      }

      const vkUrlMb = extractUrl(row.all_urls, 'vk.com/');
      if (vkUrlMb) {
        facts.push({
          artistId: row.spotify_id,
          field: 'vk_url',
          source: 'musicbrainz',
          value: vkUrlMb,
          confidence: 0.6,
          raw: null
        });
      }

      const subredditUrlMb = extractUrl(row.all_urls, 'reddit.com/r/');
      if (subredditUrlMb) {
        facts.push({
          artistId: row.spotify_id,
          field: 'subreddit_url',
          source: 'musicbrainz',
          value: subredditUrlMb,
          confidence: 0.6,
          raw: null
        });
      }

      const carnegieHallUrlMb = extractUrl(row.all_urls, 'carnegiehall.org/');
      if (carnegieHallUrlMb) {
        facts.push({
          artistId: row.spotify_id,
          field: 'carnegie_hall_url',
          source: 'musicbrainz',
          value: carnegieHallUrlMb,
          confidence: 0.6,
          raw: null
        });
      }

      const facebookUrl = row.social_media?.facebook ?? extractUrl(row.all_urls, 'facebook.com/');
      if (facebookUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'facebook_url',
          source: 'musicbrainz',
          value: facebookUrl,
          confidence: 0.65,
          raw: null
        });
      }

      const deezerUrl = row.streaming?.deezer ?? extractUrl(row.all_urls, 'deezer.com/artist/');
      if (deezerUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'deezer_url',
          source: 'musicbrainz',
          value: deezerUrl,
          confidence: 0.65,
          raw: null
        });
      }

      const appleMusicUrl = row.streaming?.apple_music ?? extractUrl(row.all_urls, 'music.apple.com/');
      if (appleMusicUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'apple_music_url',
          source: 'musicbrainz',
          value: appleMusicUrl,
          confidence: 0.65,
          raw: null
        });
      }

      const officialEntry = Object.entries(row.all_urls).find(([key]) => key.startsWith('official homepage'));
      const officialSite = officialEntry?.[1];
      if (officialSite) {
        facts.push({
          artistId: row.spotify_id,
          field: 'official_website',
          source: 'musicbrainz',
          value: officialSite,
          confidence: 0.65,
          raw: null
        });
      }

      const wikipediaUrl = extractUrl(row.all_urls, 'wikipedia.org/wiki/');
      if (wikipediaUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'wikipedia_url',
          source: 'musicbrainz',
          value: wikipediaUrl,
          confidence: 0.7,
          raw: null
        });
      }
    }

    
  }

  return facts;
}

async function collectWikidataArtistFacts(): Promise<ArtistFact[]> {
  const rows = await query<{
    spotify_id: string | null;
    wikidata_id: string | null;
    isni: string | null;
    viaf: string | null;
    identifiers: Record<string, any> | null;
    aliases: Record<string, string[]> | null;
    wikipedia_sitelinks: Record<string, string> | null;
  }>(
    `SELECT wa.spotify_id,
            wa.wikidata_id,
            wa.isni,
            wa.viaf,
            wa.identifiers,
            wa.aliases,
            wa.wikipedia_sitelinks
       FROM wikidata_artists wa
       JOIN canonical_artists ca
         ON ca.spotify_artist_id = wa.spotify_id`
  );

  const facts: ArtistFact[] = [];

  for (const row of rows) {
    if (!row.spotify_id) continue;

    if (row.wikidata_id) {
      facts.push({
        artistId: row.spotify_id,
        field: 'wikidata_id',
        source: 'wikidata',
        value: row.wikidata_id,
        confidence: 0.95,
        raw: null
      });
    }

    if (row.isni) {
      facts.push({
        artistId: row.spotify_id,
        field: 'isni',
        source: 'wikidata',
        value: row.isni,
        confidence: 0.95,
        raw: null
      });
    }

    if (row.viaf) {
      facts.push({
        artistId: row.spotify_id,
        field: 'viaf',
        source: 'wikidata',
        value: row.viaf,
        confidence: 0.90,
        raw: null
      });
    }

    if (row.identifiers) {
      const identifiers = row.identifiers;
      const firstString = (value: any): string | null => {
        if (!value) return null;
        if (Array.isArray(value)) {
          return value.find((entry) => typeof entry === 'string' && entry.length > 0) ?? null;
        }
        return typeof value === 'string' && value.length > 0 ? value : null;
      };

      const toUrl = (
        platform:
          | 'instagram'
          | 'twitter'
          | 'facebook'
          | 'tiktok'
          | 'youtube'
          | 'soundcloud'
          | 'deezer'
          | 'apple_music'
          | 'bandcamp'
          | 'songkick'
          | 'setlistfm'
          | 'lastfm'
          | 'pitchfork'
          | 'songfacts'
          | 'musixmatch'
          | 'rateyourmusic'
          | 'discogs'
          | 'allmusic'
          | 'imdb'
          | 'weibo'
          | 'vk'
          | 'subreddit'
          | 'carnegie_hall',
        value: any
      ): string | null => {
        const raw = firstString(value);
        if (!raw) return null;
        if (raw.startsWith('http')) return raw;
        const slug = raw.replace(/^@/, '');
        const ensureHttps = (input: string): string => (input.startsWith('http://') || input.startsWith('https://') ? input : `https://${input}`);
        switch (platform) {
          case 'instagram':
            return slug ? `https://www.instagram.com/${slug}` : null;
          case 'twitter':
            return slug ? `https://twitter.com/${slug}` : null;
          case 'facebook':
            return slug ? `https://www.facebook.com/${slug}` : null;
          case 'tiktok':
            return slug ? `https://www.tiktok.com/@${slug}` : null;
          case 'youtube':
            return slug ? `https://www.youtube.com/${slug}` : null;
          case 'soundcloud':
            return slug ? `https://soundcloud.com/${slug}` : null;
          case 'deezer':
            return slug ? `https://www.deezer.com/artist/${slug}` : null;
          case 'apple_music':
            return slug ? (slug.startsWith('artist/') ? `https://music.apple.com/${slug}` : `https://music.apple.com/artist/${slug}`) : null;
          case 'bandcamp':
            if (!slug) return null;
            if (slug.includes('bandcamp.com')) return ensureHttps(slug);
            return `https://${slug}.bandcamp.com`;
          case 'songkick':
            if (!slug) return null;
            if (slug.startsWith('artists/')) return `https://www.songkick.com/${slug}`;
            if (/^\d+$/.test(slug)) return `https://www.songkick.com/artists/${slug}`;
            return `https://www.songkick.com/${slug}`;
          case 'setlistfm':
            if (!slug) return null;
            if (slug.includes('setlist.fm')) return ensureHttps(slug);
            return `https://www.setlist.fm/setlists/${slug.replace(/^\/+/, '')}`;
          case 'lastfm':
            if (!slug) return null;
            if (slug.includes('last.fm')) return ensureHttps(slug);
            return `https://www.last.fm/music/${slug}`;
          case 'pitchfork':
            if (!slug) return null;
            if (slug.includes('pitchfork.com')) return ensureHttps(slug);
            return `https://pitchfork.com/artists/${slug}`;
          case 'songfacts':
            if (!slug) return null;
            if (slug.includes('songfacts.com')) return ensureHttps(slug);
            return `https://www.songfacts.com/facts/${slug}`;
          case 'musixmatch':
            if (!slug) return null;
            if (slug.includes('musixmatch.com')) return ensureHttps(slug);
            return `https://www.musixmatch.com/artist/${slug}`;
          case 'rateyourmusic':
            if (!slug) return null;
            if (slug.includes('rateyourmusic.com')) return ensureHttps(slug);
            return `https://rateyourmusic.com/artist/${slug}`;
          case 'discogs':
            if (!slug) return null;
            if (slug.includes('discogs.com')) return ensureHttps(slug);
            return `https://www.discogs.com/${slug.replace(/^\/+/, '')}`;
          case 'allmusic':
            if (!slug) return null;
            if (slug.includes('allmusic.com')) return ensureHttps(slug);
            return `https://www.allmusic.com/artist/${slug}`;
          case 'imdb':
            if (!slug) return null;
            if (slug.includes('imdb.com')) return ensureHttps(slug);
            return `https://www.imdb.com/name/${slug}`;
          case 'weibo':
            if (!slug) return null;
            if (slug.includes('weibo.com')) return ensureHttps(slug);
            return `https://www.weibo.com/${slug}`;
          case 'vk':
            if (!slug) return null;
            if (slug.includes('vk.com')) return ensureHttps(slug);
            return `https://vk.com/${slug}`;
          case 'subreddit':
            if (!slug) return null;
            if (slug.includes('reddit.com')) return ensureHttps(slug);
            const normalized = slug.replace(/^r\//i, '').replace(/^\/+/, '');
            return normalized ? `https://www.reddit.com/r/${normalized}` : null;
          case 'carnegie_hall':
            if (!slug) return null;
            if (slug.includes('carnegiehall.org')) return ensureHttps(slug);
            // Carnegie Hall IDs should link to data.carnegiehall.org for consistency
            return `https://data.carnegiehall.org/names/${slug}/about`;
          default:
            return null;
        }
      };

      const instagramUrl = toUrl('instagram', identifiers['instagram']);
      if (instagramUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'instagram_url',
          source: 'wikidata',
          value: instagramUrl,
          confidence: 0.8,
          raw: null
        });
      }

      const twitterUrl = toUrl('twitter', identifiers['twitter']);
      if (twitterUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'twitter_url',
          source: 'wikidata',
          value: twitterUrl,
          confidence: 0.8,
          raw: null
        });
      }

      const viaf = identifiers['viaf'];
      if (viaf && typeof viaf === 'string') {
        facts.push({
          artistId: row.spotify_id,
          field: 'viaf_id',
          source: 'wikidata',
          value: viaf,
          confidence: 0.95,
          raw: null
        });
      }

      const bnf = identifiers['bnf'];
      if (bnf) {
        facts.push({
          artistId: row.spotify_id,
          field: 'bnf_id',
          source: 'wikidata',
          value: Array.isArray(bnf) ? bnf[0] : String(bnf),
          confidence: 0.9,
          raw: null
        });
      }

      const gnd = identifiers['gnd'];
      if (gnd) {
        facts.push({
          artistId: row.spotify_id,
          field: 'gnd_id',
          source: 'wikidata',
          value: Array.isArray(gnd) ? gnd[0] : String(gnd),
          confidence: 0.9,
          raw: null
        });
      }

      const loc = identifiers['loc'];
      if (loc) {
        facts.push({
          artistId: row.spotify_id,
          field: 'loc_id',
          source: 'wikidata',
          value: Array.isArray(loc) ? loc[0] : String(loc),
          confidence: 0.9,
          raw: null
        });
      }

      const facebookUrl = toUrl('facebook', identifiers['facebook']);
      if (facebookUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'facebook_url',
          source: 'wikidata',
          value: facebookUrl,
          confidence: 0.75,
          raw: null
        });
      }

      const tiktokUrl = toUrl('tiktok', identifiers['tiktok']);
      if (tiktokUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'tiktok_url',
          source: 'wikidata',
          value: tiktokUrl,
          confidence: 0.75,
          raw: null
        });
      }

      const youtubeUrl = toUrl('youtube', identifiers['youtube']);
      if (youtubeUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'youtube_url',
          source: 'wikidata',
          value: youtubeUrl,
          confidence: 0.75,
          raw: null
        });
      }

      const soundcloudUrl = toUrl('soundcloud', identifiers['soundcloud']);
      if (soundcloudUrl) {
        facts.push({
          artistId: row.spotify_id,
          field: 'soundcloud_url',
          source: 'wikidata',
          value: soundcloudUrl,
          confidence: 0.75,
          raw: null
        });
      }

      const bandcamp = toUrl('bandcamp', identifiers['bandcamp']);
      if (bandcamp) {
        facts.push({
          artistId: row.spotify_id,
          field: 'bandcamp_url',
          source: 'wikidata',
          value: bandcamp,
          confidence: 0.7,
          raw: null
        });
      }

      const songkick = toUrl('songkick', identifiers['songkick']);
      if (songkick) {
        facts.push({
          artistId: row.spotify_id,
          field: 'songkick_url',
          source: 'wikidata',
          value: songkick,
          confidence: 0.7,
          raw: null
        });
      }

      const setlistfm = toUrl('setlistfm', identifiers['setlistfm']);
      if (setlistfm) {
        facts.push({
          artistId: row.spotify_id,
          field: 'setlistfm_url',
          source: 'wikidata',
          value: setlistfm,
          confidence: 0.7,
          raw: null
        });
      }

      const lastfm = toUrl('lastfm', identifiers['lastfm']);
      if (lastfm) {
        facts.push({
          artistId: row.spotify_id,
          field: 'lastfm_url',
          source: 'wikidata',
          value: lastfm,
          confidence: 0.7,
          raw: null
        });
      }

      const pitchfork = toUrl('pitchfork', identifiers['pitchfork']);
      if (pitchfork) {
        facts.push({
          artistId: row.spotify_id,
          field: 'pitchfork_url',
          source: 'wikidata',
          value: pitchfork,
          confidence: 0.7,
          raw: null
        });
      }

      const songfacts = toUrl('songfacts', identifiers['songfacts']);
      if (songfacts) {
        facts.push({
          artistId: row.spotify_id,
          field: 'songfacts_url',
          source: 'wikidata',
          value: songfacts,
          confidence: 0.7,
          raw: null
        });
      }

      const musixmatch = toUrl('musixmatch', identifiers['musixmatch']);
      if (musixmatch) {
        facts.push({
          artistId: row.spotify_id,
          field: 'musixmatch_url',
          source: 'wikidata',
          value: musixmatch,
          confidence: 0.7,
          raw: null
        });
      }

      const rateyourmusic = toUrl('rateyourmusic', identifiers['rateyourmusic']);
      if (rateyourmusic) {
        facts.push({
          artistId: row.spotify_id,
          field: 'rateyourmusic_url',
          source: 'wikidata',
          value: rateyourmusic,
          confidence: 0.7,
          raw: null
        });
      }

      const discogs = toUrl('discogs', identifiers['discogs']);
      if (discogs) {
        facts.push({
          artistId: row.spotify_id,
          field: 'discogs_url',
          source: 'wikidata',
          value: discogs,
          confidence: 0.85,
          raw: null
        });
      }

      const allmusic = toUrl('allmusic', identifiers['allmusic']);
      if (allmusic) {
        facts.push({
          artistId: row.spotify_id,
          field: 'allmusic_url',
          source: 'wikidata',
          value: allmusic,
          confidence: 0.85,
          raw: null
        });
      }

      const imdb = toUrl('imdb', identifiers['imdb']);
      if (imdb) {
        facts.push({
          artistId: row.spotify_id,
          field: 'imdb_url',
          source: 'wikidata',
          value: imdb,
          confidence: 0.7,
          raw: null
        });
      }

      const weibo = toUrl('weibo', identifiers['weibo']);
      if (weibo) {
        facts.push({
          artistId: row.spotify_id,
          field: 'weibo_url',
          source: 'wikidata',
          value: weibo,
          confidence: 0.7,
          raw: null
        });
      }

      const vk = toUrl('vk', identifiers['vk']);
      if (vk) {
        facts.push({
          artistId: row.spotify_id,
          field: 'vk_url',
          source: 'wikidata',
          value: vk,
          confidence: 0.7,
          raw: null
        });
      }

      const subreddit = toUrl('subreddit', identifiers['subreddit']);
      if (subreddit) {
        facts.push({
          artistId: row.spotify_id,
          field: 'subreddit_url',
          source: 'wikidata',
          value: subreddit,
          confidence: 0.7,
          raw: null
        });
      }

      const carnegie = toUrl('carnegie_hall', identifiers['carnegie_hall']);
      if (carnegie) {
        facts.push({
          artistId: row.spotify_id,
          field: 'carnegie_hall_url',
          source: 'wikidata',
          value: carnegie,
          confidence: 0.65,
          raw: null
        });
      }
      const deezerUrlFromIdentifiers = toUrl('deezer', identifiers['deezer']);
      if (deezerUrlFromIdentifiers) {
        facts.push({
          artistId: row.spotify_id,
          field: 'deezer_url',
          source: 'wikidata',
          value: deezerUrlFromIdentifiers,
          confidence: 0.7,
          raw: null
        });
      }

      const appleMusicUrlFromIdentifiers = toUrl('apple_music', identifiers['apple_music']);
      if (appleMusicUrlFromIdentifiers) {
        facts.push({
          artistId: row.spotify_id,
          field: 'apple_music_url',
          source: 'wikidata',
          value: appleMusicUrlFromIdentifiers,
          confidence: 0.7,
          raw: null
        });
      }

      const wikipedia = identifiers['wikipedia'];
      if (wikipedia) {
        facts.push({
          artistId: row.spotify_id,
          field: 'wikipedia_url',
          source: 'wikidata',
          value: Array.isArray(wikipedia) ? wikipedia[0] : String(wikipedia),
          confidence: 0.8,
          raw: null
        });
      }

      const libraryKeys = ['viaf', 'bnf', 'gnd', 'loc', 'sbn', 'bnmm', 'selibr'];
      const libraryIds: Record<string, any> = {};
      for (const key of libraryKeys) {
        if (identifiers[key]) {
          libraryIds[key] = identifiers[key];
        }
      }
      if (Object.keys(libraryIds).length > 0) {
        facts.push({
          artistId: row.spotify_id,
          field: 'library_ids',
          source: 'wikidata',
          value: JSON.stringify(libraryIds),
          confidence: 0.85,
          raw: null
        });
      }

      facts.push({
        artistId: row.spotify_id,
        field: 'external_ids',
        source: 'wikidata',
        value: JSON.stringify(identifiers),
        confidence: 0.8,
        raw: null
      });
    }

    if (row.aliases && Object.keys(row.aliases).length > 0) {
      facts.push({
        artistId: row.spotify_id,
        field: 'aliases',
        source: 'wikidata',
        value: JSON.stringify(row.aliases),
        confidence: 0.75,
        raw: null
      });
    }

    if (row.wikipedia_sitelinks && Object.keys(row.wikipedia_sitelinks).length > 0) {
      facts.push({
        artistId: row.spotify_id,
        field: 'wikipedia_urls',
        source: 'wikidata',
        value: JSON.stringify(row.wikipedia_sitelinks),
        confidence: 0.8,
        raw: null
      });
    }
  }

  return facts;
}

async function collectQuansicArtistFacts(): Promise<ArtistFact[]> {
  const rows = await query<{
    spotify_artist_id: string | null;
    isni: string | null;
    ipi: string | null;
    metadata: Record<string, any> | null;
  }>(
    `SELECT qa.spotify_artist_id,
            qa.isni,
            qa.ipi,
            qa.metadata
       FROM quansic_artists qa
       JOIN canonical_artists ca
         ON ca.spotify_artist_id = qa.spotify_artist_id`
  );

  const facts: ArtistFact[] = [];

  for (const row of rows) {
    if (!row.spotify_artist_id) continue;

    if (row.isni) {
      facts.push({
        artistId: row.spotify_artist_id,
        field: 'isni',
        source: 'quansic',
        value: row.isni,
        confidence: 1.0,
        raw: null
      });
    }

    const spotifyIds = row.metadata?.ids?.spotifyIds;
    if (Array.isArray(spotifyIds) && spotifyIds.length > 0) {
      facts.push({
        artistId: row.spotify_artist_id,
        field: 'spotify_id_from_quansic',
        source: 'quansic',
        value: spotifyIds.join(', '),
        confidence: 1.0,
        raw: { spotifyIds }
      });
    }

    if (row.metadata?.ids?.wikidataIds) {
      facts.push({
        artistId: row.spotify_artist_id,
        field: 'wikidata_id',
        source: 'quansic',
        value: row.metadata.ids.wikidataIds[0],
        confidence: 0.95,
        raw: { wikidataIds: row.metadata.ids.wikidataIds }
      });
    }
  }

  return facts;
}

async function collectLensArtistFacts(): Promise<ArtistFact[]> {
  const rows = await query<{
    spotify_artist_id: string | null;
    lens_handle: string | null;
  }>(
    `SELECT ca.spotify_artist_id,
            la.lens_handle
       FROM canonical_artists ca
       JOIN lens_accounts la
         ON la.spotify_artist_id = ca.spotify_artist_id
      WHERE la.account_type = 'artist'`
  );

  const facts: ArtistFact[] = [];

  for (const row of rows) {
    if (!row.spotify_artist_id || !row.lens_handle) continue;

    facts.push({
      artistId: row.spotify_artist_id,
      field: 'lens_handle',
      source: 'lens',
      value: row.lens_handle.startsWith('@') ? row.lens_handle : `@${row.lens_handle}`,
      confidence: 0.95,
      raw: null,
    });
  }

  return facts;
}

async function collectGeniusArtistFacts(): Promise<ArtistFact[]> {
  const rows = await query<{
    spotify_artist_id: string | null;
    genius_artist_id: number | null;
    instagram_name: string | null;
    twitter_name: string | null;
    url: string | null;
    name: string | null;
  }>(
    `SELECT sa.spotify_artist_id,
            ga.genius_artist_id,
            ga.instagram_name,
            ga.twitter_name,
            ga.facebook_name,
            ga.url,
            ga.name
       FROM canonical_artists ca
       JOIN spotify_artists sa
         ON sa.spotify_artist_id = ca.spotify_artist_id
       LEFT JOIN genius_artists ga
         ON ga.genius_artist_id = (
             SELECT genius_artist_id
             FROM genius_artists
             WHERE TRIM(LOWER(name)) = TRIM(LOWER(sa.name))
             LIMIT 1
           )`
  );

  const facts: ArtistFact[] = [];

  for (const row of rows) {
    if (!row.spotify_artist_id) continue;

    if (row.genius_artist_id) {
      facts.push({
        artistId: row.spotify_artist_id,
        field: 'genius_artist_id',
        source: 'genius',
        value: String(row.genius_artist_id),
        confidence: 0.85,
        raw: null
      });
    }

    if (row.url) {
      facts.push({
        artistId: row.spotify_artist_id,
        field: 'genius_url',
        source: 'genius',
        value: row.url,
        confidence: 0.85,
        raw: null
      });
    }

    const normalize = (handle: string | null | undefined, urlTemplate: (slug: string) => string): string | null => {
      if (!handle) return null;
      const slug = handle.startsWith('@') ? handle.slice(1) : handle;
      return slug ? urlTemplate(slug) : null;
    };

    const instagramUrl = normalize(row.instagram_name, (slug) => `https://www.instagram.com/${slug}`);
    if (instagramUrl) {
      facts.push({
        artistId: row.spotify_artist_id,
        field: 'instagram_url',
        source: 'genius',
        value: instagramUrl,
        confidence: 0.85,
        raw: null
      });
    }

    const twitterUrl = normalize(row.twitter_name, (slug) => `https://twitter.com/${slug}`);
    if (twitterUrl) {
      facts.push({
        artistId: row.spotify_artist_id,
        field: 'twitter_url',
        source: 'genius',
        value: twitterUrl,
        confidence: 0.85,
        raw: null
      });
    }

    const facebookUrl = normalize(row.facebook_name, (slug) => `https://www.facebook.com/${slug}`);
    if (facebookUrl) {
      facts.push({
        artistId: row.spotify_artist_id,
        field: 'facebook_url',
        source: 'genius',
        value: facebookUrl,
        confidence: 0.75,
        raw: null
      });
    }
  }

  return facts;
}

// ---------------------------------------------------------------------------
// Work collectors
// ---------------------------------------------------------------------------

async function collectSpotifyWorkFacts(): Promise<WorkFact[]> {
  const rows = await query<{
    spotify_track_id: string;
    title: string;
    album: { image_url?: string | null } | null;
    isrc: string | null;
    release_date: string | null;
    duration_ms: number | null;
  }>(
    `SELECT cw.spotify_track_id,
            st.title,
            st.album,
            st.isrc,
            st.release_date,
            st.duration_ms
       FROM canonical_works cw
       JOIN spotify_tracks st
         ON st.spotify_track_id = cw.spotify_track_id`
  );

  const facts: WorkFact[] = [];

  for (const row of rows) {
    if (row.title) {
      facts.push({
        trackId: row.spotify_track_id,
        field: 'title',
        source: 'spotify',
        value: row.title,
        confidence: 0.80,
        raw: null
      });
    }

    facts.push({
      trackId: row.spotify_track_id,
      field: 'spotify_url',
      source: 'spotify',
      value: `https://open.spotify.com/track/${row.spotify_track_id}`,
      confidence: 0.80,
      raw: null
    });

    if (row.isrc) {
      facts.push({
        trackId: row.spotify_track_id,
        field: 'isrc',
        source: 'spotify',
        value: row.isrc,
        confidence: 0.90,
        raw: null
      });
    }

    if (row.release_date) {
      facts.push({
        trackId: row.spotify_track_id,
        field: 'release_date',
        source: 'spotify',
        value: row.release_date,
        confidence: 0.80,
        raw: null
      });
    }

    if (typeof row.duration_ms === 'number') {
      facts.push({
        trackId: row.spotify_track_id,
        field: 'duration_ms',
        source: 'spotify',
        value: String(row.duration_ms),
        confidence: 0.90,
        raw: null
      });
    }

    const coverUrl = row.album?.image_url ?? null;
    if (coverUrl) {
      facts.push({
        trackId: row.spotify_track_id,
        field: 'image_url',
        source: 'spotify_album',
        value: coverUrl,
        confidence: 0.70,
        raw: { image: coverUrl }
      });

      const assets = await ensurePipelineImages('work', row.spotify_track_id, coverUrl);
      if (assets?.original) {
        facts.push({
          trackId: row.spotify_track_id,
          field: 'image_url',
          source: 'pipeline',
          value: assets.original.url,
          confidence: 1.0,
          raw: { cid: assets.original.cid, original_url: coverUrl }
        });

        facts.push({
          trackId: row.spotify_track_id,
          field: 'image_grove_url',
          source: 'pipeline',
          value: assets.original.url,
          confidence: 1.0,
          raw: { cid: assets.original.cid, original_url: coverUrl }
        });

        if (assets.original.cid) {
          facts.push({
            trackId: row.spotify_track_id,
            field: 'image_grove_cid',
            source: 'pipeline',
            value: assets.original.cid,
            confidence: 1.0,
            raw: { original_url: coverUrl }
          });
        }
      }

      if (assets?.thumbnail) {
        facts.push({
          trackId: row.spotify_track_id,
          field: 'image_thumbnail_url',
          source: 'pipeline',
          value: assets.thumbnail.url,
          confidence: 1.0,
          raw: { cid: assets.thumbnail.cid, original_url: coverUrl }
        });

        if (assets.thumbnail.cid) {
          facts.push({
            trackId: row.spotify_track_id,
            field: 'image_thumbnail_cid',
            source: 'pipeline',
            value: assets.thumbnail.cid,
            confidence: 1.0,
            raw: { original_url: coverUrl }
          });
        }
      }
    }
  }

  return facts;
}

async function collectQuansicWorkFacts(): Promise<WorkFact[]> {
  const rows = await query<{
    spotify_track_id: string | null;
    iswc: string | null;
    title: string | null;
    work_titles: string[] | null;
  }>(
    `SELECT cw.spotify_track_id,
            qr.iswc,
            qr.title,
            qr.work_titles
       FROM canonical_works cw
       JOIN spotify_tracks st
         ON st.spotify_track_id = cw.spotify_track_id
      INNER JOIN quansic_recordings qr
         ON qr.isrc = st.isrc`
  );

  const facts: WorkFact[] = [];

  for (const row of rows) {
    if (!row.spotify_track_id) continue;

    const iswc = normalizeISWC(row.iswc);
    if (iswc) {
      facts.push({
        trackId: row.spotify_track_id,
        field: 'iswc',
        source: 'quansic',
        value: iswc,
        confidence: 1.0,
        raw: null
      });
    }

    const workTitle = Array.isArray(row.work_titles) ? row.work_titles[0] : row.title;
    if (workTitle) {
      facts.push({
        trackId: row.spotify_track_id,
        field: 'title',
        source: 'quansic',
        value: workTitle,
        confidence: 0.95,
        raw: { title: row.title, work_titles: row.work_titles }
      });
    }
  }

  return facts;
}

async function collectMusicBrainzWorkFacts(): Promise<WorkFact[]> {
  const rows = await query<{
    spotify_track_id: string;
    iswc: string | null;
    work_mbid: string | null;
    title: string | null;
  }>(
    `SELECT cw.spotify_track_id,
            mbw.iswc,
            mbw.work_mbid,
            mbw.title
       FROM canonical_works cw
       JOIN spotify_tracks st
         ON st.spotify_track_id = cw.spotify_track_id
      INNER JOIN musicbrainz_recordings mr
         ON mr.isrc = st.isrc
      INNER JOIN musicbrainz_works mbw
         ON mbw.work_mbid = mr.work_mbid`
  );

  const facts: WorkFact[] = [];

  for (const row of rows) {
    if (row.work_mbid) {
      facts.push({
        trackId: row.spotify_track_id,
        field: 'mbid',
        source: 'musicbrainz_work',
        value: row.work_mbid,
        confidence: 0.90,
        raw: null
      });
    }

    const iswc = normalizeISWC(row.iswc);
    if (iswc) {
      facts.push({
        trackId: row.spotify_track_id,
        field: 'iswc',
        source: 'musicbrainz_work',
        value: iswc,
        confidence: 0.90,
        raw: null
      });
    }

    if (row.title) {
      facts.push({
        trackId: row.spotify_track_id,
        field: 'title',
        source: 'musicbrainz_work',
        value: row.title,
        confidence: 0.88,
        raw: null
      });
    }
  }

  return facts;
}

async function collectWikidataWorkFacts(): Promise<WorkFact[]> {
  const rows = await query<{
    spotify_track_id: string;
    wikidata_id: string | null;
    iswc: string | null;
  }>(
    `SELECT cw.spotify_track_id,
            ww.wikidata_id,
            ww.iswc
       FROM canonical_works cw
       JOIN spotify_tracks st
         ON st.spotify_track_id = cw.spotify_track_id
      INNER JOIN musicbrainz_recordings mr
         ON mr.isrc = st.isrc
      INNER JOIN musicbrainz_works mw
         ON mw.work_mbid = mr.work_mbid
       LEFT JOIN wikidata_works ww
         ON (ww.identifiers->>'musicbrainz_work') = mw.work_mbid
      WHERE ww.wikidata_id IS NOT NULL`
  );

  const facts: WorkFact[] = [];

  for (const row of rows) {
    if (row.wikidata_id) {
      facts.push({
        trackId: row.spotify_track_id,
        field: 'wikidata_id',
        source: 'wikidata_work',
        value: row.wikidata_id,
        confidence: 0.95,
        raw: null
      });
    }

    const iswc = normalizeISWC(row.iswc);
    if (iswc) {
      facts.push({
        trackId: row.spotify_track_id,
        field: 'iswc',
        source: 'wikidata_work',
        value: iswc,
        confidence: 0.95,
        raw: null
      });
    }
  }

  return facts;
}

async function collectLyricsWorkFacts(): Promise<WorkFact[]> {
  const rows = await query<{
    spotify_track_id: string;
    language: string | null;
  }>(
    `SELECT cw.spotify_track_id,
            sl.language
       FROM canonical_works cw
       JOIN song_lyrics sl
         ON sl.spotify_track_id = cw.spotify_track_id
      WHERE sl.language IS NOT NULL`
  );

  const facts: WorkFact[] = [];

  for (const row of rows) {
    if (!row.language) continue;
    facts.push({
      trackId: row.spotify_track_id,
      field: 'language',
      source: 'lyrics',
      value: row.language,
      confidence: 0.95,
      raw: null
    });
  }

  return facts;
}

async function collectGeniusWorkFacts(): Promise<WorkFact[]> {
  const rows = await query<{
    spotify_track_id: string | null;
    genius_song_id: number | null;
    title: string | null;
    url: string | null;
  }>(
    `SELECT gs.spotify_track_id,
            gs.genius_song_id,
            gs.title,
            gs.url
       FROM genius_songs gs
       JOIN canonical_works cw
         ON cw.spotify_track_id = gs.spotify_track_id`
  );

  const facts: WorkFact[] = [];

  for (const row of rows) {
    if (!row.spotify_track_id) continue;

    if (row.genius_song_id) {
      facts.push({
        trackId: row.spotify_track_id,
        field: 'genius_song_id',
        source: 'genius',
        value: String(row.genius_song_id),
        confidence: 0.85,
        raw: null
      });
    }

    if (row.url) {
      facts.push({
        trackId: row.spotify_track_id,
        field: 'genius_url',
        source: 'genius',
        value: row.url,
        confidence: 0.85,
        raw: null
      });
    }

    if (row.title) {
      facts.push({
        trackId: row.spotify_track_id,
        field: 'title',
        source: 'genius',
        value: row.title,
        confidence: 0.82,
        raw: null
      });
    }
  }

  return facts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractUrl(allUrls: Record<string, string> | null, needle: string): string | null {
  if (!allUrls) return null;
  for (const value of Object.values(allUrls)) {
    if (typeof value === 'string' && value.includes(needle)) {
      return value;
    }
  }
  return null;
}

function findKey(allUrls: Record<string, string> | null, value: string): string | null {
  if (!allUrls) return null;
  for (const [key, url] of Object.entries(allUrls)) {
    if (url === value) return key;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------

async function populateArtistFacts(): Promise<number> {
  let total = 0;

  total += await insertArtistFacts(await collectSpotifyArtistFacts());
  total += await insertArtistFacts(await collectMusicBrainzArtistFacts());
  total += await insertArtistFacts(await collectWikidataArtistFacts());
  total += await insertArtistFacts(await collectQuansicArtistFacts());
  total += await insertArtistFacts(await collectLensArtistFacts());
  total += await insertArtistFacts(await collectGeniusArtistFacts());

  return total;
}

async function populateWorkFacts(): Promise<number> {
  let total = 0;

  total += await insertWorkFacts(await collectSpotifyWorkFacts());
  total += await insertWorkFacts(await collectQuansicWorkFacts());
  total += await insertWorkFacts(await collectMusicBrainzWorkFacts());
  total += await insertWorkFacts(await collectWikidataWorkFacts());
  total += await insertWorkFacts(await collectGeniusWorkFacts());
  total += await insertWorkFacts(await collectLyricsWorkFacts());

  return total;
}

export async function populateSourceFacts(): Promise<{ artistFacts: number; workFacts: number }> {
  const artistCount = await populateArtistFacts();
  const workCount = await populateWorkFacts();
  return { artistFacts: artistCount, workFacts: workCount };
}

async function main() {
  console.log('🧮 Populating GRC-20 source facts');

  const { artistFacts, workFacts } = await populateSourceFacts();
  console.log(`   • Artist facts upserted: ${artistFacts}`);
  console.log(`   • Work facts upserted:   ${workFacts}`);

  console.log('✅ Source fact population complete');
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('❌ Failed to populate source facts:', error);
    process.exitCode = 1;
  });
}
