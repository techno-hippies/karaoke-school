/**
 * Step 4.9: Genius Artists Enrichment (Block 2: ARTISTS)
 *
 * Fetches full artist profiles from Genius for all artists associated with songs:
 * - Primary artists, featured artists, producers, writers
 * - Artist bios, social links, descriptions
 * - Enriches spotify_artists with Genius metadata
 *
 * Runs after: Step 4.8 (MusicBrainz Artists)
 * Dependencies: Requires Step 4.5 (Genius Songs) to be completed first
 * Status: metadata_enriched → metadata_enriched (no status change)
 * Next: Step 4.10 (Wikidata Artists)
 */

import { query, transaction } from '../db/neon';
import type { Env } from '../types';
import { GeniusService } from '../services/genius';
import { upsertGeniusArtistSQL } from '../db/genius';

interface GeniusSong {
  genius_song_id: number;
  spotify_track_id: string;
  raw_data: any;
  title: string;
}

/**
 * Process Genius Artists enrichment (for orchestrator)
 */
export async function processGeniusArtists(env: Env, limit: number = 20): Promise<void> {
  console.log(`[Step 4.9] Genius Artists Enrichment (limit: ${limit})`);

  const apiKey = process.env.GENIUS_API_KEY;
  if (!apiKey) {
    console.log('⚠️ GENIUS_API_KEY not set, skipping Genius artists enrichment');
    return;
  }

  const genius = new GeniusService(apiKey);

  // Find tracks that need Genius artist enrichment (flag-based tracking)
  const songs = await query<GeniusSong>(`
    SELECT DISTINCT ON (tp.genius_artist_id)
      tp.genius_artist_id::integer as artist_id,
      tp.genius_artist_name as artist_name,
      tp.spotify_track_id,
      st.title,
      tp.created_at
    FROM song_pipeline tp
    JOIN spotify_tracks st ON tp.spotify_track_id = st.spotify_track_id
    WHERE tp.genius_artist_id IS NOT NULL
      AND tp.has_genius_artists = FALSE
      AND tp.status IN ('metadata_enriched', 'lyrics_ready', 'audio_downloaded', 'alignment_complete', 'translations_ready', 'stems_separated')
    ORDER BY tp.genius_artist_id, tp.created_at DESC
    LIMIT $1
  `, [limit]);

  if (songs.length === 0) {
    console.log('✅ No songs need Genius artists enrichment');
    return;
  }

  console.log(`Found ${songs.length} songs`);

  let totalArtistsProcessed = 0;
  let totalArtistsFetched = 0;
  let errorCount = 0;

  for (const song of songs) {
    console.log(`\n🎵 "${song.title}" - Artist: ${song.artist_name} (ID: ${song.artist_id})`);

    try {
      const artistId = song.artist_id;
      totalArtistsProcessed++;

      // Fetch full artist details from Genius API
      const fullArtist = await genius.getFullArtist(artistId);

      if (!fullArtist) {
        console.log(`   ⚠️ Could not fetch artist data`);
        continue;
      }

      // Store artist in database
      await query(upsertGeniusArtistSQL(fullArtist));
      console.log(`   ✅ Stored artist: ${fullArtist.name}`);
      totalArtistsFetched++;

      // Mark track as enriched with Genius artist
      await query(`
        UPDATE song_pipeline
        SET has_genius_artists = TRUE
        WHERE spotify_track_id = $1
      `, [song.spotify_track_id]);

      // Rate limiting: 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      errorCount++;
    }
  }

  console.log('\n✅ Step 4.9 Complete:');
  console.log(`   Songs processed: ${songs.length}`);
  console.log(`   Artists found: ${totalArtistsProcessed}`);
  console.log(`   New artists fetched: ${totalArtistsFetched}`);
  console.log(`   Errors: ${errorCount}`);
}
