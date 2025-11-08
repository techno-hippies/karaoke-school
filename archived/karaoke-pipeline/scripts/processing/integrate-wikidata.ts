#!/usr/bin/env bun
/**
 * Integrate Wikidata Artists into GRC20 Artists
 * Maps library IDs, identifiers, and aliases from wikidata_artists to grc20_artists
 */

import { query, close } from '../../src/db/neon';

interface WikidataArtist {
  wikidata_id: string;
  spotify_artist_id: string;
  viaf_id: string | null;
  gnd_id: string | null;
  bnf_id: string | null;
  loc_id: string | null;
  sbn_id: string | null;
  bnmm_id: string | null;
  selibr_id: string | null;
  labels: Record<string, string> | null;
  aliases: Record<string, string[]> | null;
  identifiers: Record<string, any> | null;
}

/**
 * Build URL from identifier
 */
function buildUrl(platform: string, value: string): string | null {
  const urlMap: Record<string, (id: string) => string> = {
    'wikidata': (id) => `https://www.wikidata.org/wiki/${id}`,
    'viaf': (id) => `http://viaf.org/viaf/${id}`,
    'gnd': (id) => `https://d-nb.info/gnd/${id}`,
    'bnf': (id) => `https://catalogue.bnf.fr/ark:/12148/cb${id}`,
    'loc': (id) => `http://id.loc.gov/authorities/names/${id}`,
    'musicbrainz': (id) => `https://musicbrainz.org/artist/${id}`,
    'discogs': (id) => `https://www.discogs.com/artist/${id}`,
    'allmusic': (id) => `https://www.allmusic.com/artist/${id}`,
    'spotify': (id) => `https://open.spotify.com/artist/${id}`,
    'lastfm': (id) => `https://www.last.fm/music/${id}`,
    'musixmatch': (id) => `https://www.musixmatch.com/artist/${id}`,
    'songkick': (id) => `https://www.songkick.com/artists/${id}`,
    'setlistfm': (id) => `https://www.setlist.fm/setlists/${id}`,
    'bandsintown': (id) => `https://www.bandsintown.com/a/${id}`,
    'whosampled': (id) => `https://www.whosampled.com/${id}`,
    'rateyourmusic': (id) => `https://rateyourmusic.com/artist/${id}`,
    'imdb': (id) => `https://www.imdb.com/name/${id}/`,
    'twitter': (id) => id, // Already full handle
    'instagram': (id) => id,
    'facebook': (id) => id,
    'youtube': (id) => id,
    'tiktok': (id) => id,
    'soundcloud': (id) => id,
  };

  const builder = urlMap[platform];
  return builder ? builder(value) : null;
}

/**
 * Build UPDATE statement for grc20_artists
 */
function buildUpdateSQL(artist: WikidataArtist): string {
  const updates: string[] = [];
  const spotifyId = artist.spotify_artist_id;

  // Wikidata URL
  if (artist.wikidata_id) {
    updates.push(`wikidata_url = '${buildUrl('wikidata', artist.wikidata_id)}'`);
  }

  // Library IDs
  if (artist.viaf_id) {
    updates.push(`viaf_url = '${buildUrl('viaf', artist.viaf_id)}'`);
  }
  if (artist.gnd_id) {
    updates.push(`dnb_url = '${buildUrl('gnd', artist.gnd_id)}'`);
  }
  if (artist.bnf_id) {
    updates.push(`bnf_url = '${buildUrl('bnf', artist.bnf_id)}'`);
  }
  if (artist.loc_id) {
    updates.push(`loc_url = '${buildUrl('loc', artist.loc_id)}'`);
  }

  // Process identifiers
  if (artist.identifiers) {
    const ids = artist.identifiers;

    // Social media handles (extract username/handle only)
    if (ids.twitter) {
      const handle = Array.isArray(ids.twitter) ? ids.twitter[0] : ids.twitter;
      updates.push(`twitter_handle = '${handle.replace(/'/g, "''")}'`);
    }
    if (ids.instagram) {
      const handle = Array.isArray(ids.instagram) ? ids.instagram[0] : ids.instagram;
      updates.push(`instagram_handle = '${handle.replace(/'/g, "''")}'`);
    }
    if (ids.facebook) {
      const handle = Array.isArray(ids.facebook) ? ids.facebook[0] : ids.facebook;
      updates.push(`facebook_handle = '${handle.replace(/'/g, "''")}'`);
    }
    if (ids.youtube) {
      const handle = Array.isArray(ids.youtube) ? ids.youtube[0] : ids.youtube;
      updates.push(`youtube_channel = '${handle.replace(/'/g, "''")}'`);
    }
    if (ids.tiktok) {
      const handle = Array.isArray(ids.tiktok) ? ids.tiktok[0] : ids.tiktok;
      updates.push(`tiktok_handle = '${handle.replace(/'/g, "''")}'`);
    }
    if (ids.soundcloud) {
      const handle = Array.isArray(ids.soundcloud) ? ids.soundcloud[0] : ids.soundcloud;
      updates.push(`soundcloud_handle = '${handle.replace(/'/g, "''")}'`);
    }
    if (ids.vk) {
      const handle = Array.isArray(ids.vk) ? ids.vk[0] : ids.vk;
      updates.push(`vk_handle = '${handle.replace(/'/g, "''")}'`);
    }
    if (ids.weibo) {
      const handle = Array.isArray(ids.weibo) ? ids.weibo[0] : ids.weibo;
      updates.push(`weibo_handle = '${handle.replace(/'/g, "''")}'`);
    }

    // Platform URLs
    if (ids.musicbrainz) {
      const id = Array.isArray(ids.musicbrainz) ? ids.musicbrainz[0] : ids.musicbrainz;
      // Skip - we already have mbid from MusicBrainz dataset
    }
    if (ids.discogs) {
      const id = Array.isArray(ids.discogs) ? ids.discogs[0] : ids.discogs;
      updates.push(`discogs_url = '${buildUrl('discogs', id)}'`);
    }
    if (ids.allmusic) {
      const id = Array.isArray(ids.allmusic) ? ids.allmusic[0] : ids.allmusic;
      updates.push(`allmusic_url = '${buildUrl('allmusic', id)}'`);
    }
    if (ids.lastfm) {
      const id = Array.isArray(ids.lastfm) ? ids.lastfm[0] : ids.lastfm;
      updates.push(`lastfm_url = '${buildUrl('lastfm', id)}'`);
    }
    if (ids.musixmatch) {
      const id = Array.isArray(ids.musixmatch) ? ids.musixmatch[0] : ids.musixmatch;
      updates.push(`musixmatch_url = '${buildUrl('musixmatch', id)}'`);
    }
    if (ids.songkick) {
      const id = Array.isArray(ids.songkick) ? ids.songkick[0] : ids.songkick;
      updates.push(`songkick_url = '${buildUrl('songkick', id)}'`);
    }
    if (ids.setlistfm) {
      const id = Array.isArray(ids.setlistfm) ? ids.setlistfm[0] : ids.setlistfm;
      updates.push(`setlistfm_url = '${buildUrl('setlistfm', id)}'`);
    }
    if (ids.bandsintown) {
      const id = Array.isArray(ids.bandsintown) ? ids.bandsintown[0] : ids.bandsintown;
      updates.push(`bandsintown_url = '${buildUrl('bandsintown', id)}'`);
    }
    if (ids.whosampled) {
      const id = Array.isArray(ids.whosampled) ? ids.whosampled[0] : ids.whosampled;
      updates.push(`whosampled_url = '${buildUrl('whosampled', id)}'`);
    }
    if (ids.rateyourmusic) {
      const id = Array.isArray(ids.rateyourmusic) ? ids.rateyourmusic[0] : ids.rateyourmusic;
      updates.push(`rateyourmusic_url = '${buildUrl('rateyourmusic', id)}'`);
    }
    if (ids.imdb) {
      const id = Array.isArray(ids.imdb) ? ids.imdb[0] : ids.imdb;
      updates.push(`imdb_url = '${buildUrl('imdb', id)}'`);
    }
  }

  // Labels - store as-is with language keys
  if (artist.labels && Object.keys(artist.labels).length > 0) {
    updates.push(`labels = '${JSON.stringify(artist.labels).replace(/'/g, "''")}'::jsonb`);
  }

  // Aliases - preserve language structure
  if (artist.aliases && Object.keys(artist.aliases).length > 0) {
    updates.push(`aliases = '${JSON.stringify(artist.aliases).replace(/'/g, "''")}'::jsonb`);
  }

  // Wikidata identifiers - store all platform IDs
  if (artist.identifiers && Object.keys(artist.identifiers).length > 0) {
    updates.push(`wikidata_identifiers = '${JSON.stringify(artist.identifiers).replace(/'/g, "''")}'::jsonb`);
  }

  // Updated timestamp
  updates.push(`updated_at = NOW()`);

  if (updates.length === 0) {
    return '';
  }

  return `
    UPDATE grc20_artists
    SET ${updates.join(',\n        ')}
    WHERE spotify_artist_id = '${spotifyId}'
  `;
}

async function main() {
  console.log('🔗 Integrating Wikidata into GRC20 Artists');
  console.log('');

  // Fetch all wikidata artists
  const wikidataArtists = await query<WikidataArtist>(`
    SELECT *
    FROM wikidata_artists
    WHERE spotify_artist_id IS NOT NULL
    ORDER BY wikidata_id
  `);

  console.log(`✅ Found ${wikidataArtists.length} artists to integrate`);
  console.log('');

  let updatedCount = 0;
  let skippedCount = 0;

  for (const artist of wikidataArtists) {
    try {
      const updateSQL = buildUpdateSQL(artist);

      if (!updateSQL) {
        console.log(`⏭️  ${artist.wikidata_id}: No updates needed`);
        skippedCount++;
        continue;
      }

      // Check if artist exists in grc20_artists
      const exists = await query<{ count: number }>(`
        SELECT COUNT(*) as count
        FROM grc20_artists
        WHERE spotify_artist_id = '${artist.spotify_artist_id}'
      `);

      if (exists[0].count === 0) {
        console.log(`⚠️  ${artist.wikidata_id}: Artist not found in grc20_artists (spotify: ${artist.spotify_artist_id})`);
        skippedCount++;
        continue;
      }

      // Execute update
      await query(updateSQL);

      console.log(`✅ ${artist.wikidata_id}: Updated`);
      updatedCount++;
    } catch (error: any) {
      console.error(`❌ ${artist.wikidata_id}: ${error.message}`);
      skippedCount++;
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('📊 SUMMARY:');
  console.log(`   Total artists: ${wikidataArtists.length}`);
  console.log(`   ✅ Updated: ${updatedCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log('═══════════════════════════════════════');
  console.log('');

  await close();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
