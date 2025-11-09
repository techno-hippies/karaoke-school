#!/usr/bin/env bun
/**
 * Populate artist_source_facts & work_source_facts
 *
 * Pulls canonical artists/works from the pipeline and upserts per-field
 * values with provenance, ready for the GRC-20 resolution functions.
 */

import { query } from '../../db/connection';
import { uploadToGrove } from '../../services/storage';
import sharp from 'sharp';

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
  }>(
    `SELECT ma.spotify_id,
            ma.artist_mbid,
            ma.isni,
            ma.isnis,
            ma.all_urls
       FROM musicbrainz_artists ma
       JOIN canonical_artists ca
         ON ca.spotify_artist_id = ma.spotify_id`
  );

  const facts: ArtistFact[] = [];

  for (const row of rows) {
    if (!row.spotify_id) continue;

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
    identifiers: Record<string, string> | null;
  }>(
    `SELECT wa.spotify_id,
            wa.wikidata_id,
            wa.isni,
            wa.viaf,
            wa.identifiers
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
      const instagram = row.identifiers['instagram'];
      if (instagram) {
        facts.push({
          artistId: row.spotify_id,
          field: 'instagram_handle',
          source: 'wikidata',
          value: instagram,
          confidence: 0.80,
          raw: null
        });
      }

      const twitter = row.identifiers['twitter'];
      if (twitter) {
        facts.push({
          artistId: row.spotify_id,
          field: 'twitter_handle',
          source: 'wikidata',
          value: twitter,
          confidence: 0.80,
          raw: null
        });
      }
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

    if (row.instagram_name) {
      facts.push({
        artistId: row.spotify_artist_id,
        field: 'instagram_handle',
        source: 'genius',
        value: row.instagram_name,
        confidence: 0.85,
        raw: null
      });
    }

    if (row.twitter_name) {
      facts.push({
        artistId: row.spotify_artist_id,
        field: 'twitter_handle',
        source: 'genius',
        value: row.twitter_name,
        confidence: 0.85,
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
  }>(
    `SELECT cw.spotify_track_id,
            st.title,
            st.album
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

    if (row.iswc) {
      facts.push({
        trackId: row.spotify_track_id,
        field: 'iswc',
        source: 'quansic',
        value: row.iswc,
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

    if (row.iswc) {
      facts.push({
        trackId: row.spotify_track_id,
        field: 'iswc',
        source: 'musicbrainz_work',
        value: row.iswc,
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

    if (row.iswc) {
      facts.push({
        trackId: row.spotify_track_id,
        field: 'iswc',
        source: 'wikidata_work',
        value: row.iswc,
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
