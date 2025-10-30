/**
 * Bulk MusicBrainz Enrichment
 *
 * Fetches MusicBrainz data for all Spotify artists that don't have it yet.
 * Respects MusicBrainz rate limit: 1 request/second
 */

import postgres from 'postgres';
import { config } from '../config';

interface SpotifyArtist {
  spotify_artist_id: string;
  name: string;
}

interface MusicBrainzArtist {
  mbid: string;
  name: string;
  sort_name?: string;
  type?: string;
  disambiguation?: string;
  country?: string;
  gender?: string;
  birth_date?: string;
  death_date?: string;
  isnis?: string[];
  ipi?: string;
  spotify_artist_id?: string;
  wikidata_id?: string;
  discogs_id?: string;
  genius_slug?: string;
  instagram_handle?: string;
  twitter_handle?: string;
  facebook_handle?: string;
  youtube_channel?: string;
  soundcloud_handle?: string;
  tiktok_handle?: string;
  apple_music_id?: string;
  deezer_id?: string;
  tidal_id?: string;
}

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'KaraokeSchool/1.0 (https://github.com/karaoke-school)';
const RATE_LIMIT_MS = 1000; // 1 request per second

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchMusicBrainzArtist(name: string): Promise<any> {
  const url = `${MUSICBRAINZ_API}/artist/?query=${encodeURIComponent(name)}&fmt=json&limit=1`;

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT }
  });

  if (!response.ok) {
    throw new Error(`MusicBrainz search failed: ${response.statusText}`);
  }

  return await response.json();
}

async function getMusicBrainzArtist(mbid: string): Promise<MusicBrainzArtist | null> {
  const url = `${MUSICBRAINZ_API}/artist/${mbid}?inc=aliases+tags+genres+url-rels+artist-rels&fmt=json`;

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT }
  });

  if (!response.ok) {
    throw new Error(`MusicBrainz fetch failed: ${response.statusText}`);
  }

  const data = await response.json();

  // Normalize date helper
  const normalizeDate = (date: string | undefined): string | undefined => {
    if (!date) return undefined;
    const parts = date.split('-');
    if (parts.length === 1) return `${parts[0]}-01-01`; // Year only
    if (parts.length === 2) return `${parts[0]}-${parts[1]}-01`; // Year-Month
    return date;
  };

  // Extract social media identifiers from URL relations
  const relations = data.relations || [];
  const extractSocial = (urlPattern: RegExp): string | undefined => {
    for (const rel of relations) {
      if (!rel.url) continue;
      const url = rel.url.resource || String(rel.url);
      const match = url.match(urlPattern);
      if (match) return match[1] || match[2]; // Support both single and double group captures
    }
    return undefined;
  };

  // Special handler for YouTube - need to extract just the channel ID, not the "channel/" prefix
  const extractYouTubeChannel = (): string | undefined => {
    for (const rel of relations) {
      if (!rel.url) continue;
      const url = rel.url.resource || String(rel.url);
      const match = url.match(/youtube\.com\/(channel|c|user)\/([^/?]+)/);
      if (match) return match[2]; // Return only the ID, not the prefix
    }
    return undefined;
  };

  // Extract platform IDs from URL relations
  const extractAppleMusicId = (): string | undefined => {
    for (const rel of relations) {
      if (!rel.url) continue;
      const url = rel.url.resource || String(rel.url);
      // Matches: https://music.apple.com/us/artist/159260351 or https://itunes.apple.com/us/artist/id159260351
      const match = url.match(/(?:music\.apple\.com|itunes\.apple\.com)\/[a-z]{2}\/artist\/(?:id)?(\d+)/);
      if (match) return match[1];
    }
    return undefined;
  };

  const extractDeezerId = (): string | undefined => {
    for (const rel of relations) {
      if (!rel.url) continue;
      const url = rel.url.resource || String(rel.url);
      // Matches: https://www.deezer.com/artist/1424821
      const match = url.match(/deezer\.com\/artist\/(\d+)/);
      if (match) return match[1];
    }
    return undefined;
  };

  const extractTidalId = (): string | undefined => {
    for (const rel of relations) {
      if (!rel.url) continue;
      const url = rel.url.resource || String(rel.url);
      // Matches: https://tidal.com/artist/4099308 or https://tidal.com/browse/artist/4099308
      const match = url.match(/tidal\.com\/(?:browse\/)?artist\/(\d+)/);
      if (match) return match[1];
    }
    return undefined;
  };

  return {
    mbid: data.id,
    name: data.name,
    sort_name: data['sort-name'],
    type: data.type || undefined,
    disambiguation: data.disambiguation || undefined,
    country: data.country || undefined,
    gender: data.gender || undefined,
    birth_date: normalizeDate(data['life-span']?.begin),
    death_date: normalizeDate(data['life-span']?.end),
    isnis: data.isnis || [],
    ipi: data.ipis?.[0] || undefined,
    wikidata_id: (() => {
      for (const rel of relations) {
        if (!rel.url) continue;
        const url = rel.url.resource || String(rel.url);
        const match = url.match(/wikidata\.org\/(?:entity|wiki)\/(Q\d+)/);
        if (match) return match[1]; // Return only the Q-ID, not the path
      }
      return undefined;
    })(),
    discogs_id: extractSocial(/discogs\.com\/artist\/(\d+)/),
    genius_slug: extractSocial(/genius\.com\/artists\/([^/?]+)/),
    instagram_handle: extractSocial(/instagram\.com\/([^/?]+)/),
    twitter_handle: extractSocial(/(?:twitter|x)\.com\/([^/?]+)/),
    facebook_handle: extractSocial(/facebook\.com\/([^/?]+)/),
    youtube_channel: extractYouTubeChannel(), // Use special handler for YouTube
    soundcloud_handle: extractSocial(/soundcloud\.com\/([^/?]+)/),
    tiktok_handle: extractSocial(/tiktok\.com\/@?([^/?]+)/),
    apple_music_id: extractAppleMusicId(),
    deezer_id: extractDeezerId(),
    tidal_id: extractTidalId(),
  };
}

async function main() {
  if (!config.neonConnectionString) {
    throw new Error('Missing DATABASE_URL');
  }

  const sql = postgres(config.neonConnectionString);
  const BATCH_SIZE = parseInt(process.argv[2] || '50'); // Default 50, can override

  console.log(`🎼 MusicBrainz Bulk Enrichment`);
  console.log(`   Batch size: ${BATCH_SIZE}`);
  console.log(`   Rate limit: 1 req/sec (${BATCH_SIZE} artists = ~${Math.ceil(BATCH_SIZE / 60)} minutes)\n`);

  try {
    // Get Spotify artists without MusicBrainz data
    const artistsToEnrich = await sql<SpotifyArtist[]>`
      SELECT DISTINCT sa.spotify_artist_id, sa.name
      FROM spotify_artists sa
      LEFT JOIN musicbrainz_artists ma ON sa.spotify_artist_id = ma.spotify_artist_id
      WHERE ma.spotify_artist_id IS NULL
      ORDER BY sa.name
      LIMIT ${BATCH_SIZE}
    `;

    if (artistsToEnrich.length === 0) {
      console.log('✅ All Spotify artists already have MusicBrainz data!');
      return;
    }

    console.log(`📊 Found ${artistsToEnrich.length} artists to enrich\n`);

    let enriched = 0;
    let failed = 0;
    let notFound = 0;

    for (let i = 0; i < artistsToEnrich.length; i++) {
      const artist = artistsToEnrich[i];
      const progress = `[${i + 1}/${artistsToEnrich.length}]`;

      try {
        console.log(`${progress} Searching: ${artist.name}`);

        // Search MusicBrainz
        const searchResult = await searchMusicBrainzArtist(artist.name);

        if (!searchResult?.artists?.length) {
          console.log(`   ⚠️  Not found in MusicBrainz`);
          notFound++;
          await sleep(RATE_LIMIT_MS);
          continue;
        }

        const topResult = searchResult.artists[0];
        console.log(`   → Match: ${topResult.name} (${topResult.id}), score: ${topResult.score}`);

        // Fetch full artist details
        await sleep(RATE_LIMIT_MS); // Rate limit between search and fetch
        const mbArtistData = await getMusicBrainzArtist(topResult.id);

        if (!mbArtistData) {
          console.log(`   ⚠️  Failed to fetch details`);
          failed++;
          await sleep(RATE_LIMIT_MS);
          continue;
        }

        // Store raw data for reference
        const { mbid, name, sort_name, type, disambiguation, country, gender, birth_date, death_date, isnis, ipi, wikidata_id, discogs_id, genius_slug, instagram_handle, twitter_handle, facebook_handle, youtube_channel, soundcloud_handle, tiktok_handle, apple_music_id, deezer_id, tidal_id, ...rawData } = mbArtistData;
        const mbArtist = { mbid, name, sort_name, type, disambiguation, country, gender, birth_date, death_date, isnis, ipi, wikidata_id, discogs_id, genius_slug, instagram_handle, twitter_handle, facebook_handle, youtube_channel, soundcloud_handle, tiktok_handle, apple_music_id, deezer_id, tidal_id };
        const geniusSlug = mbArtist.genius_slug;

        // Insert into database (convert undefined to null for postgres)
        await sql`
          INSERT INTO musicbrainz_artists (
            mbid, name, sort_name, type, disambiguation,
            country, gender, birth_date, death_date,
            isnis, ipi,
            spotify_artist_id, wikidata_id, discogs_id, genius_slug,
            instagram_handle, twitter_handle, facebook_handle,
            youtube_channel, soundcloud_handle, tiktok_handle,
            apple_music_id, deezer_id, tidal_id,
            raw_data, fetched_at
          ) VALUES (
            ${mbArtist.mbid}, ${mbArtist.name}, ${mbArtist.sort_name || null}, ${mbArtist.type || null}, ${mbArtist.disambiguation || null},
            ${mbArtist.country || null}, ${mbArtist.gender || null}, ${mbArtist.birth_date || null}, ${mbArtist.death_date || null},
            ${mbArtist.isnis}, ${mbArtist.ipi || null},
            ${artist.spotify_artist_id}, ${mbArtist.wikidata_id || null}, ${mbArtist.discogs_id || null}, ${geniusSlug || null},
            ${mbArtist.instagram_handle || null}, ${mbArtist.twitter_handle || null}, ${mbArtist.facebook_handle || null},
            ${mbArtist.youtube_channel || null}, ${mbArtist.soundcloud_handle || null}, ${mbArtist.tiktok_handle || null},
            ${mbArtist.apple_music_id || null}, ${mbArtist.deezer_id || null}, ${mbArtist.tidal_id || null},
            ${sql.json(mbArtistData)}, NOW()
          )
          ON CONFLICT (mbid) DO UPDATE SET
            spotify_artist_id = EXCLUDED.spotify_artist_id,
            apple_music_id = EXCLUDED.apple_music_id,
            deezer_id = EXCLUDED.deezer_id,
            tidal_id = EXCLUDED.tidal_id,
            raw_data = EXCLUDED.raw_data,
            fetched_at = NOW()
        `;

        console.log(`   ✅ Enriched: MBID=${mbArtist.mbid}, Apple=${mbArtist.apple_music_id || 'none'}, Deezer=${mbArtist.deezer_id || 'none'}, Tidal=${mbArtist.tidal_id || 'none'}`);
        enriched++;

      } catch (error) {
        console.error(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
        failed++;
      }

      // Rate limit between artists
      await sleep(RATE_LIMIT_MS);
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Enriched: ${enriched}`);
    console.log(`   ⚠️  Not found: ${notFound}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📈 Success rate: ${Math.round((enriched / artistsToEnrich.length) * 100)}%`);

    // Check remaining work
    const remaining = await sql`
      SELECT COUNT(*) as count
      FROM spotify_artists sa
      LEFT JOIN musicbrainz_artists ma ON sa.spotify_artist_id = ma.spotify_artist_id
      WHERE ma.spotify_artist_id IS NULL
    `;

    console.log(`\n📋 Remaining: ${remaining[0].count} artists still need enrichment`);

    if (remaining[0].count > 0) {
      console.log(`   Run again with: bun run enrich-mb ${BATCH_SIZE}`);
    } else {
      console.log(`\n✅ All artists enriched! Run corroboration:`);
      console.log(`   bun run corroborate`);
    }

  } catch (error) {
    console.error('❌ Bulk enrichment failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch(console.error);
