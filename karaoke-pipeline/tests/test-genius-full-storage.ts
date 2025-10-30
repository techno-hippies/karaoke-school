#!/usr/bin/env bun
/**
 * Test Full Genius Data Storage
 * Verifies that full song, artist, and referent data is stored correctly
 */

import { GeniusService } from './src/services/genius';
import { query, transaction, close } from './src/db/neon';
import {
  upsertGeniusArtistSQL,
  upsertGeniusSongSQL,
  upsertGeniusReferentSQL,
} from './src/db/genius';

async function main() {
  const apiKey = process.env.GENIUS_API_KEY;
  if (!apiKey) {
    console.error('❌ GENIUS_API_KEY not set');
    process.exit(1);
  }

  console.log('🎤 Testing Full Genius Data Storage\n');

  const genius = new GeniusService(apiKey);

  // Test with Billie Eilish - ocean eyes
  console.log('Test: Fetch and store complete data for "ocean eyes" by Billie Eilish');

  // Step 1: Search and match
  const match = await genius.searchAndMatch('ocean eyes', 'Billie Eilish', '');

  if (!match) {
    console.error('❌ Could not find song');
    await close();
    return;
  }

  console.log(`✅ Found: ${match.title} by ${match.artist_name}`);
  console.log(`   Genius Song ID: ${match.genius_song_id}`);
  console.log(`   Genius Artist ID: ${match.genius_artist_id}`);

  // Step 2: Fetch full song (use NULL for spotify_track_id to avoid FK constraint)
  console.log('\n⏳ Fetching full song details...');
  const fullSong = await genius.getFullSong(match.genius_song_id);
  fullSong.spotify_track_id = ''; // NULL in database

  if (!fullSong) {
    console.error('❌ Could not fetch full song');
    await close();
    return;
  }

  console.log('✅ Full song data retrieved');
  console.log(`   Language: ${fullSong.language}`);
  console.log(`   Release date: ${fullSong.release_date}`);
  console.log(`   Lyrics state: ${fullSong.lyrics_state}`);
  console.log(`   Annotation count: ${fullSong.annotation_count}`);
  console.log(`   Pyongs count: ${fullSong.pyongs_count}`);

  // Step 3: Fetch full artist
  console.log('\n⏳ Fetching full artist details...');
  const fullArtist = await genius.getFullArtist(match.genius_artist_id);

  if (!fullArtist) {
    console.error('❌ Could not fetch full artist');
    await close();
    return;
  }

  console.log('✅ Full artist data retrieved');
  console.log(`   Name: ${fullArtist.name}`);
  console.log(`   Verified: ${fullArtist.is_verified}`);
  console.log(`   Followers: ${fullArtist.followers_count}`);
  console.log(`   Instagram: ${fullArtist.instagram_name || 'N/A'}`);
  console.log(`   Twitter: ${fullArtist.twitter_name || 'N/A'}`);
  console.log(`   Alternate names: ${fullArtist.alternate_names.join(', ') || 'None'}`);

  // Step 4: Fetch referents
  console.log('\n⏳ Fetching referents (annotations)...');
  const referents = await genius.getReferents(match.genius_song_id);

  console.log(`✅ Found ${referents.length} referents`);

  if (referents.length > 0) {
    console.log('\n📝 Sample referent:');
    const sample = referents[0];
    console.log(`   Fragment: "${sample.fragment.substring(0, 50)}..."`);
    console.log(`   Classification: ${sample.classification}`);
    console.log(`   Votes: ${sample.votes_total}`);
    console.log(`   Comments: ${sample.comment_count}`);
    console.log(`   Verified: ${sample.is_verified}`);
    console.log(`   Annotations count: ${sample.annotations.length}`);
  }

  // Step 5: Store all data in database
  console.log('\n⏳ Storing all data in database...');

  const sqlStatements = [
    upsertGeniusArtistSQL(fullArtist),
    upsertGeniusSongSQL(fullSong),
  ];

  // Add referents
  for (const referent of referents) {
    sqlStatements.push(upsertGeniusReferentSQL(referent));
  }

  await transaction(sqlStatements);

  console.log(`✅ Stored complete data:`);
  console.log(`   - 1 artist`);
  console.log(`   - 1 song`);
  console.log(`   - ${referents.length} referents`);

  // Step 6: Verify data in database
  console.log('\n⏳ Verifying data in database...');

  const artistCheck = await query<{ count: string }>(`
    SELECT COUNT(*) as count FROM genius_artists WHERE genius_artist_id = ${fullArtist.genius_artist_id}
  `);
  console.log(`✅ Artist stored: ${artistCheck[0]?.count || 0} row(s)`);

  const songCheck = await query<{ count: string }>(`
    SELECT COUNT(*) as count FROM genius_songs WHERE genius_song_id = ${fullSong.genius_song_id}
  `);
  console.log(`✅ Song stored: ${songCheck[0]?.count || 0} row(s)`);

  const referentCheck = await query<{ count: string }>(`
    SELECT COUNT(*) as count FROM genius_song_referents WHERE genius_song_id = ${fullSong.genius_song_id}
  `);
  console.log(`✅ Referents stored: ${referentCheck[0]?.count || 0} row(s)`);

  // Show sample data
  const artistData = await query<any>(`
    SELECT genius_artist_id, name, is_verified, followers_count, instagram_name, twitter_name
    FROM genius_artists
    WHERE genius_artist_id = ${fullArtist.genius_artist_id}
  `);

  if (artistData.length > 0) {
    console.log('\n📊 Artist in DB:');
    console.log(`   Name: ${artistData[0].name}`);
    console.log(`   Verified: ${artistData[0].is_verified}`);
    console.log(`   Followers: ${artistData[0].followers_count}`);
    console.log(`   Instagram: ${artistData[0].instagram_name || 'N/A'}`);
  }

  const songData = await query<any>(`
    SELECT genius_song_id, title, language, lyrics_state, annotation_count
    FROM genius_songs
    WHERE genius_song_id = ${fullSong.genius_song_id}
  `);

  if (songData.length > 0) {
    console.log('\n📊 Song in DB:');
    console.log(`   Title: ${songData[0].title}`);
    console.log(`   Language: ${songData[0].language}`);
    console.log(`   Lyrics state: ${songData[0].lyrics_state}`);
    console.log(`   Annotation count: ${songData[0].annotation_count}`);
  }

  const referentData = await query<any>(`
    SELECT fragment, classification, votes_total, is_verified
    FROM genius_song_referents
    WHERE genius_song_id = ${fullSong.genius_song_id}
    LIMIT 3
  `);

  if (referentData.length > 0) {
    console.log('\n📊 Sample referents in DB:');
    referentData.forEach((ref, i) => {
      console.log(`   ${i + 1}. "${ref.fragment.substring(0, 40)}..."`);
      console.log(`      Classification: ${ref.classification}, Votes: ${ref.votes_total}`);
    });
  }

  console.log('\n═══════════════════════════════════════');
  console.log('✅ Full Genius data storage test complete!');
  console.log('═══════════════════════════════════════');

  await close();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
