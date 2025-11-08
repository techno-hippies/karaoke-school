#!/usr/bin/env bun
/**
 * Backfill genius_artist_id in grc20_artists from Genius song metadata
 *
 * The Genius API returns artist objects for:
 * - primary_artist
 * - featured_artists[]
 * - producer_artists[]
 * - writer_artists[]
 *
 * We extract ALL of these and:
 * 1. Insert into genius_artists table
 * 2. Update grc20_artists.genius_artist_id via name matching
 */

import { query } from '../../src/db/neon';

interface GeniusArtistFromAPI {
  id: number;
  name: string;
  url: string;
  api_path: string;
  image_url?: string;
  header_image_url?: string;
  is_verified?: boolean;
  is_meme_verified?: boolean;
  iq?: number;
  alternate_names?: string[];
  instagram_name?: string;
  twitter_name?: string;
  facebook_name?: string;
}

async function main() {
  console.log('🎤 Backfilling genius_artist_id from Genius song metadata\n');

  // 1. Extract ALL unique artists from genius_songs.raw_data
  const songs = await query<{
    genius_song_id: number;
    title: string;
    raw_data: any;
  }>(`
    SELECT genius_song_id, title, raw_data
    FROM genius_songs
  `);

  console.log(`📊 Processing ${songs.length} songs for artist extraction\n`);

  const artistsMap = new Map<number, GeniusArtistFromAPI>();

  for (const song of songs) {
    const raw = song.raw_data;

    // Extract all artist types
    const artistArrays = [
      raw.primary_artist ? [raw.primary_artist] : [],
      raw.featured_artists || [],
      raw.producer_artists || [],
      raw.writer_artists || []
    ];

    for (const artistArray of artistArrays) {
      for (const artist of artistArray) {
        if (artist && artist.id) {
          artistsMap.set(artist.id, {
            id: artist.id,
            name: artist.name,
            url: artist.url,
            api_path: artist.api_path,
            image_url: artist.image_url,
            header_image_url: artist.header_image_url,
            is_verified: artist.is_verified || false,
            is_meme_verified: artist.is_meme_verified || false,
            iq: artist.iq,
            alternate_names: artist.alternate_names || [],
            instagram_name: artist.instagram_name,
            twitter_name: artist.twitter_name,
            facebook_name: artist.facebook_name
          });
        }
      }
    }
  }

  console.log(`✅ Found ${artistsMap.size} unique artists\n`);

  // 2. Insert into genius_artists (ON CONFLICT DO UPDATE)
  let insertedCount = 0;
  let updatedCount = 0;

  for (const artist of artistsMap.values()) {
    const result = await query<{ existed: boolean }>(`
      INSERT INTO genius_artists (
        genius_artist_id, name, alternate_names, is_verified, is_meme_verified,
        image_url, header_image_url, instagram_name, twitter_name, facebook_name,
        url, api_path, raw_data
      ) VALUES (
        $1, $2, $3::text[], $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      )
      ON CONFLICT (genius_artist_id) DO UPDATE SET
        name = EXCLUDED.name,
        alternate_names = EXCLUDED.alternate_names,
        is_verified = EXCLUDED.is_verified,
        is_meme_verified = EXCLUDED.is_meme_verified,
        image_url = EXCLUDED.image_url,
        header_image_url = EXCLUDED.header_image_url,
        instagram_name = EXCLUDED.instagram_name,
        twitter_name = EXCLUDED.twitter_name,
        facebook_name = EXCLUDED.facebook_name,
        url = EXCLUDED.url,
        api_path = EXCLUDED.api_path,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
      RETURNING (xmax = 0) AS existed
    `, [
      artist.id,
      artist.name,
      artist.alternate_names && artist.alternate_names.length > 0 ? artist.alternate_names : null,
      artist.is_verified,
      artist.is_meme_verified,
      artist.image_url,
      artist.header_image_url,
      artist.instagram_name,
      artist.twitter_name,
      artist.facebook_name,
      artist.url,
      artist.api_path,
      JSON.stringify(artist)
    ]);

    if (result[0]?.existed) {
      insertedCount++;
    } else {
      updatedCount++;
    }
  }

  console.log(`📥 genius_artists: ${insertedCount} inserted, ${updatedCount} updated\n`);

  // 3. Update grc20_artists.genius_artist_id via name matching
  console.log('🔗 Linking grc20_artists to genius_artists by name...\n');

  const updateResult = await query(`
    UPDATE grc20_artists grc
    SET genius_artist_id = ga.genius_artist_id,
        updated_at = NOW()
    FROM genius_artists ga
    WHERE grc.genius_artist_id IS NULL
      AND TRIM(LOWER(grc.name)) = TRIM(LOWER(ga.name))
    RETURNING grc.name, ga.genius_artist_id
  `);

  console.log(`✅ Updated ${updateResult.length} artists:\n`);
  for (const row of updateResult) {
    console.log(`   ${row.name} → Genius ID ${row.genius_artist_id}`);
  }

  // 4. Final stats
  console.log('\n📊 Final Statistics:\n');

  const stats = await query(`
    SELECT
      COUNT(*) as total_grc20_artists,
      COUNT(genius_artist_id) as with_genius_id,
      ROUND(COUNT(genius_artist_id) * 100.0 / COUNT(*), 1) as percentage
    FROM grc20_artists
  `);

  console.log(`   Total artists: ${stats[0].total_grc20_artists}`);
  console.log(`   With Genius ID: ${stats[0].with_genius_id} (${stats[0].percentage}%)`);

  const stillMissing = await query(`
    SELECT name, spotify_artist_id
    FROM grc20_artists
    WHERE genius_artist_id IS NULL
    ORDER BY name
  `);

  if (stillMissing.length > 0) {
    console.log(`\n⚠️  Still missing (${stillMissing.length}):`);
    for (const artist of stillMissing) {
      console.log(`   - ${artist.name} (${artist.spotify_artist_id})`);
    }
    console.log('\n   These artists likely don\'t appear in any processed Genius songs.');
  } else {
    console.log('\n🎉 All artists have Genius IDs!');
  }

  console.log('\n✅ Done!\n');
}

main().catch(console.error);
