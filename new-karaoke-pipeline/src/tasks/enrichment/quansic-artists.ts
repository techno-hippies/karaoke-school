/**
 * Quansic Artists Enrichment Task Processor
 *
 * Enriches artists with Quansic metadata:
 * - ISNI codes (International Standard Name Identifier)
 * - IPI codes (Interested Parties Information)
 * - Wikidata IDs
 * - MusicBrainz IDs
 * - Platform identifiers (Luminate, Gracenote, Amazon, Apple)
 *
 * Depends on: Track discovery (artists populated in tracks.artists JSONB)
 */

import {
  getPendingEnrichmentTasks,
  updateEnrichmentTask,
} from '../../db/queries';
import { query } from '../../db/connection';

const QUANSIC_URL = process.env.QUANSIC_URL || 'http://lojcjq8bi9e71b3q1ns6igbh58.ingress.akash.isites.pl';

interface QuansicArtistData {
  ids?: {
    quansic_id?: string;
    isnis?: string[];
    ipis?: string[];
    musicBrainzIds?: string[];
    wikidataIds?: string[];
    luminateIds?: string[];
    gracenoteIds?: string[];
    amazonIds?: string[];
    appleIds?: string[];
  };
  name: string;
  raw_data?: any;
}

interface ArtistResult {
  spotify_artist_id: string;
  name: string;
  isni: string | null;
  found: boolean;
}

/**
 * Main Quansic artists enrichment processor
 */
export async function processQuansicArtists(limit: number = 50): Promise<void> {
  console.log(`\n🎯 Quansic Artists Enrichment (limit: ${limit})`);
  console.log(`🌐 Quansic URL: ${QUANSIC_URL}\n`);

  // Get pending tasks
  const tasks = await getPendingEnrichmentTasks('quansic_artists', limit);

  if (tasks.length === 0) {
    console.log('✅ No pending Quansic artists tasks\n');
    return;
  }

  console.log(`Found ${tasks.length} pending tasks\n`);

  let completedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const task of tasks) {
    // Get track artists
    const trackData = await query<{
      artists: Array<{ id: string; name: string }>;
    }>(`
      SELECT artists
      FROM tracks
      WHERE spotify_track_id = $1
    `, [task.spotify_track_id]);

    if (trackData.length === 0 || !trackData[0].artists) {
      console.log(`   ⚠️ No artists found for ${task.spotify_track_id}, skipping`);
      await updateEnrichmentTask(task.id, { status: 'skipped' });
      skippedCount++;
      continue;
    }

    const artists = trackData[0].artists;
    console.log(`   🎵 Track has ${artists.length} artist(s)`);

    let artistsProcessed = 0;
    let artistsSkipped = 0;
    const results: ArtistResult[] = [];

    for (const artist of artists) {
      const spotifyArtistId = artist.id;
      const artistName = artist.name;

      console.log(`\n   🎤 ${artistName} (${spotifyArtistId})`);

      // Check if already processed
      const existing = await query<{ spotify_artist_id: string }>(`
        SELECT spotify_artist_id FROM quansic_artists
        WHERE spotify_artist_id = $1
      `, [spotifyArtistId]);

      if (existing.length > 0) {
        console.log(`      ✅ Already in cache`);
        artistsProcessed++;
        results.push({
          spotify_artist_id: spotifyArtistId,
          name: artistName,
          isni: null,
          found: true,
        });
        continue;
      }

      try {
        // Call Quansic /lookup-artist
        console.log(`      🔍 Calling Quansic API...`);

        let response;
        try {
          response = await fetch(`${QUANSIC_URL}/lookup-artist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spotify_artist_id: spotifyArtistId }),
            signal: AbortSignal.timeout(15000) // 15 second timeout
          });
        } catch (fetchError: any) {
          // Network failure, timeout, or service unavailable
          console.log(`      ❌ Service unavailable: ${fetchError.message}`);
          console.log(`      🔄 Will retry later`);
          throw new Error(`Quansic service unavailable: ${fetchError.message}`);
        }

        // Got response from service - now check status
        if (!response.ok) {
          if (response.status === 404) {
            // Legitimate 404 from working service = artist not in Quansic DB
            console.log(`      ⚠️ Not found in Quansic database`);
            artistsSkipped++;
            results.push({
              spotify_artist_id: spotifyArtistId,
              name: artistName,
              isni: null,
              found: false,
            });
            continue;
          } else {
            // Other HTTP errors (500, 502, 503, etc.) = service problem
            console.log(`      ❌ Quansic API error: ${response.status}`);
            console.log(`      🔄 Will retry later`);
            throw new Error(`Quansic API returned ${response.status}`);
          }
        }

        const result = await response.json();

        if (!result.success) {
          console.log(`      ⚠️ Not found in Quansic: ${result.error || 'Unknown error'}`);
          artistsSkipped++;
          results.push({
            spotify_artist_id: spotifyArtistId,
            name: artistName,
            isni: null,
            found: false,
          });
          continue;
        }

        const data: QuansicArtistData = result.data;

        // Extract identifiers
        const isni = data.ids?.isnis?.[0] || null;
        const ipi = data.ids?.ipis?.[0] || null;

        console.log(`      ✅ Found: ${data.name}`);
        if (isni) {
          console.log(`      📋 ISNI: ${isni}`);
        }
        if (data.ids?.ipis && data.ids.ipis.length > 0) {
          console.log(`      📋 IPI: ${data.ids.ipis.length} code(s)`);
        }
        if (data.ids?.wikidataIds && data.ids.wikidataIds.length > 0) {
          console.log(`      🌐 Wikidata: ${data.ids.wikidataIds[0]}`);
        }

        // Store in quansic_artists table (matches archived schema)
        await query(`
          INSERT INTO quansic_artists (
            artist_name,
            spotify_artist_id,
            isni,
            ipi,
            aliases,
            metadata
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (artist_name) DO UPDATE SET
            spotify_artist_id = EXCLUDED.spotify_artist_id,
            isni = EXCLUDED.isni,
            ipi = EXCLUDED.ipi,
            aliases = EXCLUDED.aliases,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        `, [
          data.name,
          spotifyArtistId,
          isni,
          ipi,
          JSON.stringify([]),
          JSON.stringify({
            ids: data.ids,
            isni,
            ipi,
            name: data.name,
            role: 'MainArtist'
          })
        ]);

        console.log(`      ✅ Stored in quansic_artists`);
        artistsProcessed++;
        results.push({
          spotify_artist_id: spotifyArtistId,
          name: artistName,
          isni,
          found: true,
        });

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error: any) {
        // Check if this is a service failure (thrown from fetch block above)
        if (error.message.includes('Quansic service unavailable') ||
            error.message.includes('Quansic API returned')) {
          // Service failure - fail the entire task so it retries later
          console.log(`\n❌ Quansic service failure, task will retry`);
          await updateEnrichmentTask(task.id, {
            status: 'failed',
            error_message: error.message,
          });
          failedCount++;
          throw error; // Stop processing this batch
        }

        // Other errors (DB errors, parsing errors, etc.)
        console.log(`      ❌ Unexpected error: ${error.message}`);
        artistsSkipped++;
        results.push({
          spotify_artist_id: spotifyArtistId,
          name: artistName,
          isni: null,
          found: false,
        });
      }
    }

    console.log(`\n   📊 Track summary: ${artistsProcessed} processed, ${artistsSkipped} skipped`);

    if (artistsProcessed > 0) {
      await updateEnrichmentTask(task.id, {
        status: 'completed',
        source: 'quansic',
        result_data: {
          artists_processed: artistsProcessed,
          artists_skipped: artistsSkipped,
          results,
        },
      });
      completedCount++;
    } else {
      await updateEnrichmentTask(task.id, {
        status: 'skipped',
        error_message: 'No artists could be enriched (all not found in Quansic)',
      });
      skippedCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Completed: ${completedCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log(`   ⏭️ Skipped: ${skippedCount}`);
  console.log('');
}

// Run if called directly
if (import.meta.main) {
  const limit = parseInt(process.argv[2]) || 50;
  processQuansicArtists(limit)
    .catch(error => {
      console.error('❌ Quansic artists enrichment failed:', error);
      process.exit(1);
    });
}
