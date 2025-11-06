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

  // Find Genius songs that have not had their artists fully enriched
  // We look for songs where raw_data contains artist IDs that aren't in genius_artists yet
  const songs = await query<GeniusSong>(`
    SELECT
      gs.genius_song_id,
      gs.spotify_track_id,
      gs.raw_data,
      gs.title
    FROM genius_songs gs
    WHERE gs.raw_data IS NOT NULL
      AND gs.created_at > NOW() - INTERVAL '7 days'  -- Only recent songs
    ORDER BY gs.created_at DESC
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
    console.log(`\n🎵 "${song.title}" (ID: ${song.genius_song_id})`);

    try {
      // Extract ALL artist IDs from song (primary, featured, producer, writer)
      const allArtistIds = new Set<number>();
      const rawSong = song.raw_data as any;

      // Collect all unique artist IDs
      [rawSong.primary_artist]
        .concat(rawSong.featured_artists || [])
        .concat(rawSong.producer_artists || [])
        .concat(rawSong.writer_artists || [])
        .filter(Boolean)
        .forEach((artist: any) => {
          if (artist?.id) allArtistIds.add(artist.id);
        });

      console.log(`   👥 Found ${allArtistIds.size} unique artists`);
      totalArtistsProcessed += allArtistIds.size;

      // Check which artists we already have in the database
      const existingArtistIds = await query<{ genius_artist_id: number }>(`
        SELECT genius_artist_id
        FROM genius_artists
        WHERE genius_artist_id = ANY($1)
      `, [Array.from(allArtistIds)]);

      const existingSet = new Set(existingArtistIds.map(a => a.genius_artist_id));
      const artistsToFetch = Array.from(allArtistIds).filter(id => !existingSet.has(id));

      if (artistsToFetch.length === 0) {
        console.log(`   ✅ All artists already in database`);
        continue;
      }

      console.log(`   ⏳ Fetching ${artistsToFetch.length} new artists...`);

      // Fetch full details for new artists
      const sqlStatements = [];
      let fetchedCount = 0;

      for (const artistId of artistsToFetch) {
        try {
          const fullArtist = await genius.getFullArtist(artistId);
          if (fullArtist) {
            sqlStatements.push(upsertGeniusArtistSQL(fullArtist));
            fetchedCount++;
          }
          // Rate limiting: 50ms between artist fetches
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.log(`   ⚠️ Could not fetch artist ${artistId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Store all artists in a transaction
      if (sqlStatements.length > 0) {
        await transaction(sqlStatements);
        console.log(`   ✅ Stored ${fetchedCount} artists`);
        totalArtistsFetched += fetchedCount;
      }

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
