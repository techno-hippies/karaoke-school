#!/usr/bin/env bun
/**
 * Backfill Genius Data
 * Populates genius_songs, genius_artists, and genius_song_referents
 * for tracks that already have genius_song_id in song_pipeline
 */

import { query, transaction, close } from '../../src/db/neon';
import { GeniusService } from '../../src/services/genius';
import {
  upsertGeniusArtistSQL,
  upsertGeniusSongSQL,
  upsertGeniusReferentSQL,
} from '../../src/db/genius';

async function main() {
  const apiKey = process.env.GENIUS_API_KEY;
  if (!apiKey) {
    console.error('❌ GENIUS_API_KEY not set');
    process.exit(1);
  }

  console.log('🔄 Backfilling Genius Data for Existing Matches\n');

  const genius = new GeniusService(apiKey);

  // Find tracks with Genius IDs but no data in genius_songs table
  const tracksToBackfill = await query<{
    spotify_track_id: string;
    genius_song_id: number;
    genius_artist_id: number;
  }>(`
    SELECT sp.spotify_track_id, sp.genius_song_id, sp.genius_artist_id
    FROM song_pipeline sp
    WHERE sp.genius_song_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM genius_songs gs
        WHERE gs.genius_song_id = sp.genius_song_id
      )
    ORDER BY sp.id
  `);

  console.log(`📊 Found ${tracksToBackfill.length} tracks to backfill\n`);

  if (tracksToBackfill.length === 0) {
    console.log('✅ All tracks already backfilled!');
    await close();
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  // Track unique artists to avoid redundant API calls
  const processedArtists = new Set<number>();

  for (const track of tracksToBackfill) {
    console.log(`\n🎵 Track: ${track.spotify_track_id}`);
    console.log(`   Genius Song ID: ${track.genius_song_id}`);
    console.log(`   Genius Artist ID: ${track.genius_artist_id}`);

    try {
      // Fetch full song
      console.log('   ⏳ Fetching song details...');
      const fullSong = await genius.getFullSong(track.genius_song_id, track.spotify_track_id);

      if (!fullSong) {
        console.log('   ⚠️ Could not fetch song');
        errorCount++;
        continue;
      }

      console.log(`   ✅ Song: ${fullSong.title}`);

      // Fetch full artist (if not already processed)
      let fullArtist = null;
      if (!processedArtists.has(track.genius_artist_id)) {
        console.log('   ⏳ Fetching artist details...');
        fullArtist = await genius.getFullArtist(track.genius_artist_id);

        if (!fullArtist) {
          console.log('   ⚠️ Could not fetch artist');
        } else {
          processedArtists.add(track.genius_artist_id);
          console.log(`   ✅ Artist: ${fullArtist.name}`);
        }
      } else {
        console.log(`   ⏭️ Artist already processed`);
      }

      // Fetch referents
      console.log('   ⏳ Fetching referents...');
      const referents = await genius.getReferents(track.genius_song_id);
      console.log(`   📝 Found ${referents.length} referents`);

      // Build transaction
      const sqlStatements = [];

      if (fullArtist) {
        sqlStatements.push(upsertGeniusArtistSQL(fullArtist));
      }

      sqlStatements.push(upsertGeniusSongSQL(fullSong));

      for (const referent of referents) {
        sqlStatements.push(upsertGeniusReferentSQL(referent));
      }

      await transaction(sqlStatements);

      console.log(`   ✅ Stored: song + ${fullArtist ? 'artist + ' : ''}${referents.length} referents`);
      successCount++;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      errorCount++;
    }
  }

  console.log('\n');
  console.log('═══════════════════════════════════════');
  console.log('📊 Backfill Summary:');
  console.log(`   ✅ Successfully backfilled: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   🎤 Unique artists processed: ${processedArtists.size}`);
  console.log('═══════════════════════════════════════');

  await close();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
