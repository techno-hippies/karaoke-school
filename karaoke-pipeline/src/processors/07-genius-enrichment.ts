#!/usr/bin/env bun
/**
 * Processor: Genius Enrichment
 * Matches songs to Genius for lyrics metadata corroboration
 *
 * Flow:
 * 1. Find tracks with lyrics but no Genius data
 * 2. Extract artist name from Spotify data
 * 3. Search Genius API with title + artist
 * 4. Validate artist match
 * 5. Store Genius IDs for corroboration
 *
 * Corroboration Use Cases:
 * - Validate Spotify metadata accuracy
 * - Cross-reference with MusicBrainz artist data
 * - Get additional metadata (language, release date)
 * - Lyrics annotations and community data
 *
 * Usage:
 *   GENIUS_API_KEY=your_key bun src/processors/07-genius-enrichment.ts [batchSize]
 */

import { query, transaction, close } from '../db/neon';
import { GeniusService, type GeniusSongData } from '../services/genius';
import {
  logGeniusProcessingSQL,
  updatePipelineGeniusSQL,
  upsertGeniusArtistSQL,
  upsertGeniusSongSQL,
  upsertGeniusReferentSQL,
} from '../db/genius';

async function main() {
  const args = process.argv.slice(2);
  const batchSize = args[0] ? parseInt(args[0]) : 20;

  console.log('🎤 Genius Enrichment v1');
  console.log(`📊 Batch size: ${batchSize}`);
  console.log('');

  // Check for API key
  const apiKey = process.env.GENIUS_API_KEY;
  if (!apiKey) {
    console.error('❌ GENIUS_API_KEY environment variable not set');
    console.error('   Get your key from: https://genius.com/api-clients');
    process.exit(1);
  }

  const genius = new GeniusService(apiKey);

  // Find tracks that need Genius enrichment
  console.log('⏳ Finding tracks ready for Genius enrichment...');

  const tracksToProcess = await query<{
    id: number;
    spotify_track_id: string;
    title: string;
    artists: Array<{ id: string; name: string }>;
    status: string;
  }>(`
    SELECT
      tp.id,
      tp.spotify_track_id,
      st.title,
      st.artists,
      tp.status
    FROM song_pipeline tp
    JOIN spotify_tracks st ON tp.spotify_track_id = st.spotify_track_id
    WHERE tp.status IN ('lyrics_ready', 'audio_downloaded', 'alignment_complete', 'translations_ready', 'stems_separated')
      AND tp.genius_song_id IS NULL
      AND tp.has_lyrics = TRUE
    ORDER BY tp.id
    LIMIT ${batchSize}
  `);

  if (tracksToProcess.length === 0) {
    console.log('✅ No tracks need Genius enrichment. All caught up!');
    await close();
    return;
  }

  console.log(`✅ Found ${tracksToProcess.length} tracks to process`);
  console.log('');

  let successCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  // Process each track
  for (const track of tracksToProcess) {
    const artistName = track.artists[0]?.name || 'Unknown Artist';
    console.log(`\n🎵 Processing: "${track.title}" by ${artistName}`);
    console.log(`   Spotify ID: ${track.spotify_track_id}`);

    try {
      // Search Genius
      const geniusData = await genius.searchAndMatch(
        track.title,
        artistName,
        track.spotify_track_id
      );

      if (!geniusData) {
        console.log('   ⚠️ No validated Genius match found');
        notFoundCount++;

        // Log the attempt
        await query(
          logGeniusProcessingSQL(
            track.spotify_track_id,
            'not_found',
            `No Genius match for: ${track.title} by ${artistName}`,
            { title: track.title, artist: artistName }
          )
        );

        continue;
      }

      console.log(`   ✅ Matched to Genius ID: ${geniusData.genius_song_id}`);
      console.log(`   🎤 Artist: ${geniusData.artist_name} (ID: ${geniusData.genius_artist_id})`);
      if (geniusData.language) {
        console.log(`   🌍 Language: ${geniusData.language}`);
      }

      // Fetch full song details
      console.log('   ⏳ Fetching full song details...');
      const fullSong = await genius.getFullSong(geniusData.genius_song_id, track.spotify_track_id);

      if (!fullSong) {
        console.log('   ⚠️ Could not fetch full song details');
        continue;
      }

      // Extract ALL artists from song (primary, featured, producer, writer)
      console.log('   ⏳ Extracting all artists from song...');
      const allArtistIds = new Set<number>();
      const rawSong = fullSong.raw_data as any;

      // Collect all unique artist IDs
      [rawSong.primary_artist]
        .concat(rawSong.featured_artists || [])
        .concat(rawSong.producer_artists || [])
        .concat(rawSong.writer_artists || [])
        .filter(Boolean)
        .forEach((artist: any) => {
          if (artist?.id) allArtistIds.add(artist.id);
        });

      console.log(`   👥 Found ${allArtistIds.size} unique artists (primary + featured + producer + writer)`);

      // Fetch full details for ALL artists
      const allArtists = [];
      for (const artistId of allArtistIds) {
        try {
          const fullArtist = await genius.getFullArtist(artistId);
          if (fullArtist) {
            allArtists.push(fullArtist);
          }
          // Rate limiting: 50ms between artist fetches
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.log(`   ⚠️ Could not fetch artist ${artistId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      console.log(`   ✅ Fetched ${allArtists.length}/${allArtistIds.size} artist details`);

      // Fetch referents (lyrics annotations)
      console.log('   ⏳ Fetching referents (annotations)...');
      const referents = await genius.getReferents(geniusData.genius_song_id);
      console.log(`   📝 Found ${referents.length} referents`);

      // Build transaction to store all data
      const sqlStatements = [
        // 1. Update pipeline with basic IDs
        updatePipelineGeniusSQL(
          track.spotify_track_id,
          geniusData.genius_song_id,
          geniusData.genius_artist_id,
          geniusData.url,
          geniusData.artist_name
        ),

        // 2. Upsert song
        upsertGeniusSongSQL(fullSong),

        // 3. Log success
        logGeniusProcessingSQL(
          track.spotify_track_id,
          'success',
          `Matched to Genius: ${geniusData.title} by ${geniusData.artist_name}`,
          {
            genius_song_id: geniusData.genius_song_id,
            genius_artist_id: geniusData.genius_artist_id,
            language: geniusData.language,
            lyrics_state: geniusData.lyrics_state,
            referent_count: referents.length,
            annotation_count: fullSong.annotation_count,
            total_artists: allArtists.length
          }
        )
      ];

      // 4. Upsert ALL artists (primary + featured + producer + writer)
      for (const artist of allArtists) {
        sqlStatements.push(upsertGeniusArtistSQL(artist));
      }

      // 5. Add referents to transaction
      for (const referent of referents) {
        sqlStatements.push(upsertGeniusReferentSQL(referent));
      }

      // Execute all inserts in a transaction
      await transaction(sqlStatements);

      console.log(`   ✅ Stored complete data (${referents.length} referents)`);
      successCount++;

      // Rate limiting: 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`   ❌ Error processing track: ${error instanceof Error ? error.message : String(error)}`);
      errorCount++;

      // Log error
      await query(
        logGeniusProcessingSQL(
          track.spotify_track_id,
          'error',
          error instanceof Error ? error.message : String(error),
          { stack: error instanceof Error ? error.stack : undefined }
        )
      );
    }
  }

  console.log('\n');
  console.log('═══════════════════════════════════════');
  console.log('📊 Summary:');
  console.log(`   ✅ Successfully enriched: ${successCount}`);
  console.log(`   ⚠️ Not found on Genius: ${notFoundCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log('═══════════════════════════════════════');

  await close();
}

/**
 * Process Genius enrichment (for orchestrator)
 */
export async function processGeniusEnrichment(_env: any, limit: number = 20): Promise<void> {
  const apiKey = process.env.GENIUS_API_KEY;
  if (!apiKey) {
    console.log('⚠️ GENIUS_API_KEY not set, skipping Genius enrichment');
    return;
  }

  const genius = new GeniusService(apiKey);

  // Find tracks that need Genius enrichment
  const tracksToProcess = await query<{
    id: number;
    spotify_track_id: string;
    title: string;
    artists: Array<{ id: string; name: string }>;
    status: string;
  }>(`
    SELECT
      tp.id,
      tp.spotify_track_id,
      st.title,
      st.artists,
      tp.status
    FROM song_pipeline tp
    JOIN spotify_tracks st ON tp.spotify_track_id = st.spotify_track_id
    WHERE tp.status IN ('lyrics_ready', 'audio_downloaded', 'alignment_complete', 'translations_ready', 'stems_separated')
      AND tp.genius_song_id IS NULL
      AND tp.has_lyrics = TRUE
    ORDER BY tp.id
    LIMIT ${limit}
  `);

  if (tracksToProcess.length === 0) {
    console.log('✅ No tracks need Genius enrichment');
    return;
  }

  console.log(`📊 Processing ${tracksToProcess.length} tracks`);

  let successCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  for (const track of tracksToProcess) {
    const artistName = track.artists[0]?.name || 'Unknown Artist';
    console.log(`\n🎵 "${track.title}" by ${artistName}`);

    try {
      const geniusData = await genius.searchAndMatch(
        track.title,
        artistName,
        track.spotify_track_id
      );

      if (!geniusData) {
        console.log('   ⚠️ No match found');
        notFoundCount++;
        await query(
          logGeniusProcessingSQL(
            track.spotify_track_id,
            'not_found',
            `No Genius match for: ${track.title} by ${artistName}`,
            { title: track.title, artist: artistName }
          )
        );
        continue;
      }

      console.log(`   ✅ Genius ID: ${geniusData.genius_song_id}`);

      // Fetch full data
      const fullSong = await genius.getFullSong(geniusData.genius_song_id, track.spotify_track_id);
      if (!fullSong) {
        console.log('   ⚠️ Could not fetch full song');
        continue;
      }

      // Extract ALL artists from song (primary, featured, producer, writer)
      const allArtistIds = new Set<number>();
      const rawSong = fullSong.raw_data as any;

      // Collect all unique artist IDs
      [rawSong.primary_artist]
        .concat(rawSong.featured_artists || [])
        .concat(rawSong.producer_artists || [])
        .concat(rawSong.writer_artists || [])
        .filter(Boolean)
        .forEach((artist: any) => {
          if (artist?.id) allArtistIds.add(artist.id);
        });

      console.log(`   👥 ${allArtistIds.size} artists`);

      // Fetch full details for ALL artists
      const allArtists = [];
      for (const artistId of allArtistIds) {
        try {
          const fullArtist = await genius.getFullArtist(artistId);
          if (fullArtist) allArtists.push(fullArtist);
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.log(`   ⚠️ Could not fetch artist ${artistId}`);
        }
      }

      const referents = await genius.getReferents(geniusData.genius_song_id);
      console.log(`   📝 ${referents.length} referents`);

      // Build transaction
      const sqlStatements = [
        updatePipelineGeniusSQL(
          track.spotify_track_id,
          geniusData.genius_song_id,
          geniusData.genius_artist_id,
          geniusData.url,
          geniusData.artist_name
        ),
        upsertGeniusSongSQL(fullSong),
        logGeniusProcessingSQL(
          track.spotify_track_id,
          'success',
          `Matched to Genius: ${geniusData.title} by ${geniusData.artist_name}`,
          {
            genius_song_id: geniusData.genius_song_id,
            referent_count: referents.length,
            total_artists: allArtists.length
          }
        )
      ];

      // Upsert ALL artists
      for (const artist of allArtists) {
        sqlStatements.push(upsertGeniusArtistSQL(artist));
      }

      for (const referent of referents) {
        sqlStatements.push(upsertGeniusReferentSQL(referent));
      }

      await transaction(sqlStatements);

      successCount++;
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      errorCount++;
    }
  }

  console.log('\n📊 Genius Enrichment Summary:');
  console.log(`   ✅ Enriched: ${successCount}`);
  console.log(`   ⚠️ Not found: ${notFoundCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
}

// Run if called directly
if (import.meta.main) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
