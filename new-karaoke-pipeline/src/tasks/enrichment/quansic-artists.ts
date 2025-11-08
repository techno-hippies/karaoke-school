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

const QUANSIC_URL = process.env.QUANSIC_URL || 'http://1lsb38mac5f273k366859u5390.ingress.akash-palmito.org';

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
        const response = await fetch(`${QUANSIC_URL}/lookup-artist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spotify_artist_id: spotifyArtistId })
        });

        if (!response.ok) {
          console.log(`      ⚠️ Quansic API error: ${response.status}`);
          artistsSkipped++;
          results.push({
            spotify_artist_id: spotifyArtistId,
            name: artistName,
            isni: null,
            found: false,
          });
          continue;
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
        const isniAll = data.ids?.isnis || null;
        const ipiAll = data.ids?.ipis || null;
        const mbid = data.ids?.musicBrainzIds?.[0] || null;
        const wikidataIds = data.ids?.wikidataIds || null;

        console.log(`      ✅ Found: ${data.name}`);
        if (isni) {
          console.log(`      📋 ISNI: ${isni}`);
        }
        if (ipiAll && ipiAll.length > 0) {
          console.log(`      📋 IPI: ${ipiAll.length} code(s)`);
        }
        if (wikidataIds && wikidataIds.length > 0) {
          console.log(`      🌐 Wikidata: ${wikidataIds[0]}`);
        }

        // Store in quansic_artists table
        await query(`
          INSERT INTO quansic_artists (
            spotify_artist_id,
            quansic_id,
            name,
            isni,
            isni_all,
            ipi_all,
            musicbrainz_mbid,
            luminate_ids,
            gracenote_ids,
            amazon_ids,
            apple_ids,
            raw_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (spotify_artist_id) DO UPDATE SET
            quansic_id = EXCLUDED.quansic_id,
            name = EXCLUDED.name,
            isni = EXCLUDED.isni,
            isni_all = EXCLUDED.isni_all,
            ipi_all = EXCLUDED.ipi_all,
            musicbrainz_mbid = EXCLUDED.musicbrainz_mbid,
            luminate_ids = EXCLUDED.luminate_ids,
            gracenote_ids = EXCLUDED.gracenote_ids,
            amazon_ids = EXCLUDED.amazon_ids,
            apple_ids = EXCLUDED.apple_ids,
            raw_data = EXCLUDED.raw_data,
            updated_at = NOW()
        `, [
          spotifyArtistId,
          data.ids?.quansic_id || null,
          data.name,
          isni,
          isniAll,
          ipiAll,
          mbid,
          data.ids?.luminateIds || null,
          data.ids?.gracenoteIds || null,
          data.ids?.amazonIds || null,
          data.ids?.appleIds || null,
          data.raw_data || null
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
        console.log(`      ❌ Error: ${error.message}`);
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
