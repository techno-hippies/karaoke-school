/**
 * Step 4.5: Genius Songs Enrichment (Block 1: WORKS)
 *
 * Matches songs to Genius for work-level metadata:
 * - Song IDs, URLs, titles
 * - Language, release dates
 * - Lyrics annotations and referents
 *
 * Runs after: metadata_enriched (Step 4)
 * Status: metadata_enriched → metadata_enriched (no status change)
 * Next: Step 4.6 (Wikidata Works)
 *
 * Note: This processor only handles SONGS (work-level data).
 * Artist enrichment happens in Step 4.9 (04-genius-artists.ts)
 */

import { query, transaction } from '../db/neon';
import type { Env } from '../types';
import { GeniusService } from '../services/genius';
import {
  logGeniusProcessingSQL,
  updatePipelineGeniusSQL,
  upsertGeniusSongSQL,
  upsertGeniusReferentSQL,
  upsertGeniusArtistSQL,
} from '../db/genius';

interface Track {
  id: number;
  spotify_track_id: string;
  title: string;
  artists: Array<{ id: string; name: string }>;
  status: string;
}

/**
 * Process Genius Songs enrichment (for orchestrator)
 */
export async function processGeniusSongs(env: Env, limit: number = 20): Promise<void> {
  console.log(`[Step 4.5] Genius Songs Enrichment (limit: ${limit})`);

  const apiKey = process.env.GENIUS_API_KEY;
  if (!apiKey) {
    console.log('⚠️ GENIUS_API_KEY not set, skipping Genius songs enrichment');
    return;
  }

  const genius = new GeniusService(apiKey);

  // Find tracks that need Genius song enrichment
  // Process tracks at metadata_enriched or later (catch any that were skipped)
  const tracks = await query<Track>(`
    SELECT
      tp.id,
      tp.spotify_track_id,
      st.title,
      st.artists,
      tp.status
    FROM song_pipeline tp
    JOIN spotify_tracks st ON tp.spotify_track_id = st.spotify_track_id
    WHERE tp.status IN ('metadata_enriched', 'lyrics_ready', 'audio_downloaded', 'alignment_complete', 'translations_ready', 'stems_separated', 'segments_selected', 'enhanced', 'clips_cropped')
      AND tp.has_genius_songs = FALSE
    ORDER BY tp.id
    LIMIT $1
  `, [limit]);

  if (tracks.length === 0) {
    console.log('✅ No tracks need Genius songs enrichment');
    return;
  }

  console.log(`Found ${tracks.length} tracks`);

  let successCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  for (const track of tracks) {
    const artistName = track.artists[0]?.name || 'Unknown Artist';
    console.log(`\n🎵 "${track.title}" by ${artistName}`);

    try {
      // 1. Search and match song on Genius
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
      if (geniusData.language) {
        console.log(`   🌍 Language: ${geniusData.language}`);
      }

      // 2. Fetch full song details
      const fullSong = await genius.getFullSong(geniusData.genius_song_id, track.spotify_track_id);
      if (!fullSong) {
        console.log('   ⚠️ Could not fetch full song');
        continue;
      }

      // 3. Fetch referents (lyrics annotations)
      const referents = await genius.getReferents(geniusData.genius_song_id);
      console.log(`   📝 ${referents.length} referents`);

      // 4. Ensure primary artist exists (fetch if needed)
      const artistExists = await query(`
        SELECT 1 FROM genius_artists WHERE genius_artist_id = $1
      `, [geniusData.genius_artist_id]);

      if (artistExists.length === 0) {
        console.log(`   👤 Fetching primary artist (ID: ${geniusData.genius_artist_id})...`);
        const artistData = await genius.getFullArtist(geniusData.genius_artist_id);
        if (artistData) {
          await query(upsertGeniusArtistSQL(artistData));
          console.log(`   ✅ Stored artist: ${artistData.name}`);
        }
      }

      // 5. Store song data in transaction
      const sqlStatements = [
        // Update pipeline with Genius IDs
        updatePipelineGeniusSQL(
          track.spotify_track_id,
          geniusData.genius_song_id,
          geniusData.genius_artist_id,
          geniusData.url,
          geniusData.artist_name
        ),

        // Upsert song
        upsertGeniusSongSQL(fullSong),

        // Log success
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
            annotation_count: fullSong.annotation_count
          }
        )
      ];

      // Add referents
      for (const referent of referents) {
        sqlStatements.push(upsertGeniusReferentSQL(referent));
      }

      // Execute all inserts in a transaction
      await transaction(sqlStatements);

      // Mark track as enriched with Genius song data
      await query(`
        UPDATE song_pipeline
        SET has_genius_songs = TRUE
        WHERE spotify_track_id = $1
      `, [track.spotify_track_id]);

      successCount++;
      console.log(`   ✅ Stored song + ${referents.length} referents`);

      // Rate limiting: 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      errorCount++;

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

  console.log('\n✅ Step 4.5 Complete:');
  console.log(`   Songs enriched: ${successCount}`);
  console.log(`   Not found: ${notFoundCount}`);
  console.log(`   Errors: ${errorCount}`);
}
