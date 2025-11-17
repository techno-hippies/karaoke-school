/**
 * ISWC Discovery Task Processor
 *
 * Clean implementation of multi-source ISWC fallback chain:
 * 1. Check all caches (Quansic, MLC, BMI, MusicBrainz)
 * 2. Call Quansic API
 * 3. MLC fallback (direct ISRC→ISWC)
 * 4. BMI fallback (fuzzy title/artist match)
 * 5. Mark as failure (prevents redundant API calls)
 */

import {
  getPendingEnrichmentTasks,
  updateEnrichmentTask,
  updateTrackFlags,
  getISWCFromCache,
  isKnownISWCFailure,
  recordISWCFailure
} from '../../db/queries';
import { query } from '../../db/connection';

// Import services
import { searchBMI } from '../../services/bmi';
import { searchMLC } from '../../services/mlc';
import { normalizeISWC } from '../../utils/iswc';

interface ISWCResult {
  iswc: string;
  source: string;
}

/**
 * Call Quansic API for ISWC enrichment
 */
/**
 * Call Quansic API for ISWC enrichment
 * Uses /enrich-recording endpoint (not /enrich which is for artists!)
 */
async function callQuansicAPI(isrc: string, trackId: string): Promise<ISWCResult | null> {
  const quansicUrl = process.env.QUANSIC_SERVICE_URL;
  if (!quansicUrl) {
    console.log('   ⚠️ QUANSIC_SERVICE_URL not set, skipping Quansic API');
    return null;
  }

  try {
    // Use correct endpoint: /enrich-recording (not /enrich which is for artists)
    const response = await fetch(`${quansicUrl}/enrich-recording`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isrc,
        spotify_track_id: trackId,
      })
    });

    if (!response.ok) {
      throw new Error(`Quansic API returned ${response.status}`);
    }

    const result = await response.json();

    // Handle both success and "not found" cases
    if (!result.success) {
      console.log(`   ⚠️ Quansic: ${result.error || 'Recording not found'}`);
      return null;
    }

    const data = result.data;

    // Extract ISWC from recording data
    const rawIswc = data?.iswc || data?.work?.iswc;
    const iswc = normalizeISWC(rawIswc);
    if (iswc) {
      // Cache in quansic_recordings table
      await query(`
        INSERT INTO quansic_recordings (isrc, iswc, title, artists, quansic_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (isrc)
        DO UPDATE SET iswc = $2, title = $3, artists = $4, quansic_id = $5
      `, [
        isrc,
        iswc,
        data?.title || null,
        JSON.stringify(data?.artists || []),
        data?.quansic_id || null
      ]);

      // Also store artist data if available
      if (data?.artists && Array.isArray(data.artists)) {
        for (const artist of data.artists) {
          if (artist.isni) {
            try {
              await query(`
                INSERT INTO quansic_artists (artist_name, isni, ipi, aliases, metadata)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (artist_name)
                DO UPDATE SET
                  isni = COALESCE($2, quansic_artists.isni),
                  ipi = COALESCE($3, quansic_artists.ipi),
                  aliases = COALESCE($4, quansic_artists.aliases),
                  metadata = COALESCE($5, quansic_artists.metadata),
                  updated_at = NOW()
              `, [
                artist.name,
                artist.isni || null,
                artist.ipi || null,
                JSON.stringify(artist.aliases || []),
                JSON.stringify(artist)
              ]);
            } catch (err) {
              // Ignore duplicate key errors for artists
              console.log(`      ⚠️ Could not store artist ${artist.name}`);
            }
          }
        }
      }

      return { iswc, source: 'quansic_api' };
    }
    if (rawIswc) {
      console.log(`   ⚠️ Quansic returned ISWC in unexpected format: ${rawIswc}`);
    }

    return null;
  } catch (error) {
    console.log(`   ⚠️ Quansic API error: ${error.message}`);
    return null;
  }
}

/**
 * Try MLC direct ISRC→ISWC lookup
 * Strategy:
 * 1. Get writer names from MusicBrainz work contributors (most accurate)
 * 2. Fallback to performer artists if no work data
 * 3. Try each writer name with MLC search
 * 4. Skip title-only search (too slow, 40k+ results)
 */
async function tryMLCFallback(isrc: string, title: string, artists: string): Promise<ISWCResult | null> {
  try {
    let writerNames: string[] = [];

    // Strategy 1: Get writers from MusicBrainz work (if work exists)
    const mbWorks = await query<{ work_mbid: string; contributors: any }>(`
      SELECT mbw.work_mbid, mbw.contributors
      FROM musicbrainz_recordings mbr
      JOIN musicbrainz_works mbw ON mbr.work_mbid = mbw.work_mbid
      WHERE mbr.isrc = $1
      LIMIT 1
    `, [isrc]);

    if (mbWorks.length > 0 && mbWorks[0].contributors) {
      const contributors = mbWorks[0].contributors as Array<{name: string; type: string; mbid?: string}>;
      writerNames = contributors
        .filter((c: any) => c.type === 'writer' || c.type === 'composer')
        .map((c: any) => c.name)
        .filter(Boolean);

      console.log(`      📝 Found ${writerNames.length} writer(s) from MB work: ${writerNames.join(', ')}`);
    }

    // Strategy 2: Fallback to performer artists (when no work data available)
    if (writerNames.length === 0) {
      console.log(`      ⚠️ No work data in MusicBrainz, trying performer artists...`);

      // Try to get individual performer names from musicbrainz_artists
      // This works for individual artists but not bands
      const mbArtists = await query<{ name: string; artist_type: string }>(`
        SELECT DISTINCT mba.name, mba.artist_type
        FROM musicbrainz_recordings mbr
        JOIN musicbrainz_artists mba ON mba.name = ANY(
          SELECT jsonb_array_elements_text(mbr.artist_credits::jsonb)
        )
        WHERE mbr.isrc = $1
        AND mba.artist_type = 'Person'
        LIMIT 3
      `, [isrc]);

      if (mbArtists.length > 0) {
        writerNames = mbArtists.map(a => a.name);
        console.log(`      🎤 Using ${writerNames.length} performer(s): ${writerNames.join(', ')}`);
      }
    }

    // Try MLC search with each writer name
    for (const writerName of writerNames) {
      console.log(`      🔍 Searching MLC: "${title}" by ${writerName}`);
      const result = await searchMLC(isrc, title, writerName);

      const normalizedIswc = normalizeISWC(result?.iswc);
      if (normalizedIswc) {
        await query(`
          INSERT INTO mlc_works (isrc, iswc, work_title, writers)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (isrc)
          DO UPDATE SET iswc = $2, work_title = $3, writers = $4
        `, [isrc, normalizedIswc, result.title, JSON.stringify(result.writers || [])]);

        return { iswc: normalizedIswc, source: 'mlc_fallback' };
      }
    }

    // Skip title-only search - it's too slow (40k+ results) and rarely succeeds
    if (writerNames.length === 0) {
      console.log(`      ⏭️ No writer names available, skipping MLC (title-only would be too slow)`);
    }

    return null;
  } catch (error) {
    console.log(`   ⚠️ MLC fallback error: ${error.message}`);
    return null;
  }
}

/**
 * Try BMI fuzzy match fallback
 */
async function tryBMIFallback(isrc: string, title: string, artists: string): Promise<ISWCResult | null> {
  try {
    const result = await searchBMI(title, artists);

    const normalizedIswc = normalizeISWC(result?.iswc);

    if (normalizedIswc) {
      // Cache result (use bmi_work_id from scraper, default confidence 0.9 for found matches)
      await query(`
        INSERT INTO bmi_works (isrc, work_id, iswc, title, artists, match_confidence, match_method)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (isrc, work_id)
        DO UPDATE SET iswc = $3, match_confidence = $6
      `, [
        isrc,
        result.bmi_work_id || 'unknown',
        normalizedIswc,
        title,
        [artists],
        0.9, // BMI scraper found exact match, assign high confidence
        'scraper'
      ]);

      return { iswc: normalizedIswc, source: 'bmi_fallback' };
    }

    return null;
  } catch (error) {
    console.log(`   ⚠️ BMI fallback error: ${error.message}`);
    return null;
  }
}

/**
 * Main ISWC discovery processor
 */
export async function processISWCDiscovery(limit: number = 50): Promise<void> {
  console.log(`\n🔍 ISWC Discovery Task Processor (limit: ${limit})\n`);

  // Get pending tasks
  const tasks = await getPendingEnrichmentTasks('iswc_discovery', limit);

  if (tasks.length === 0) {
    console.log('✅ No pending ISWC discovery tasks\n');
    return;
  }

  console.log(`Found ${tasks.length} pending tasks\n`);

  let completedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const task of tasks) {
    // Get track details
    const tracks = await query<{
      title: string;
      artists: Array<{ name: string }>;
      isrc: string | null;
    }>(`
      SELECT title, artists, isrc
      FROM tracks
      WHERE spotify_track_id = $1
    `, [task.spotify_track_id]);

    if (tracks.length === 0) {
      console.log(`   ⚠️ Track ${task.spotify_track_id} not found, skipping`);
      await updateEnrichmentTask(task.id, { status: 'skipped' });
      skippedCount++;
      continue;
    }

    const track = tracks[0];
    const isrc = track.isrc;

    if (!isrc) {
      console.log(`   ⚠️ ${track.title} - No ISRC, marking as skipped`);
      await updateEnrichmentTask(task.id, { status: 'skipped' });
      skippedCount++;
      continue;
    }

    const artistName = track.artists[0]?.name || 'Unknown';
    console.log(`   🎵 ${track.title} by ${artistName} (ISRC: ${isrc})`);

    try {
      // Step 1: Check all caches
      const cachedISWC = await getISWCFromCache(isrc);
      if (cachedISWC) {
        console.log(`      ✅ Found in cache: ${cachedISWC}`);
        await updateEnrichmentTask(task.id, {
          status: 'completed',
          source: 'cache',
          result_data: { iswc: cachedISWC }
        });
        await updateTrackFlags(task.spotify_track_id, { has_iswc: true });
        completedCount++;
        continue;
      }

      // Step 2: Check if known failure
      const isKnownFailure = await isKnownISWCFailure(isrc);
      if (isKnownFailure) {
        console.log(`      ⏭️ Known failure, skipping (will retry after 7 days)`);
        await updateEnrichmentTask(task.id, { status: 'skipped' });
        skippedCount++;
        continue;
      }

      // Step 3: Try Quansic API
      console.log(`      🔍 Trying Quansic API...`);
      const quansicResult = await callQuansicAPI(isrc, task.spotify_track_id);
      if (quansicResult) {
        console.log(`      ✅ Found via Quansic: ${quansicResult.iswc}`);
        await updateEnrichmentTask(task.id, {
          status: 'completed',
          source: quansicResult.source,
          result_data: { iswc: quansicResult.iswc }
        });
        await updateTrackFlags(task.spotify_track_id, { has_iswc: true });
        completedCount++;
        continue;
      }

      // Step 4: Try MLC fallback
      console.log(`      🔍 Trying MLC fallback...`);
      const mlcResult = await tryMLCFallback(isrc, track.title, artistName);
      if (mlcResult) {
        console.log(`      ✅ Found via MLC: ${mlcResult.iswc}`);
        await updateEnrichmentTask(task.id, {
          status: 'completed',
          source: mlcResult.source,
          result_data: { iswc: mlcResult.iswc }
        });
        await updateTrackFlags(task.spotify_track_id, { has_iswc: true });
        completedCount++;
        continue;
      }

      // Step 5: Try BMI fallback
      console.log(`      🔍 Trying BMI fallback...`);
      const bmiResult = await tryBMIFallback(isrc, track.title, artistName);
      if (bmiResult) {
        console.log(`      ✅ Found via BMI: ${bmiResult.iswc}`);
        await updateEnrichmentTask(task.id, {
          status: 'completed',
          source: bmiResult.source,
          result_data: { iswc: bmiResult.iswc }
        });
        await updateTrackFlags(task.spotify_track_id, { has_iswc: true });
        completedCount++;
        continue;
      }

      // Step 6: All sources exhausted - record failure
      console.log(`      ❌ ISWC not found in any source`);
      await recordISWCFailure(isrc, ['quansic', 'mlc', 'bmi'], 'All sources exhausted');
      await updateEnrichmentTask(task.id, {
        status: 'failed',
        error_message: 'ISWC not found in any source after all fallbacks'
      });
      failedCount++;

    } catch (error) {
      console.log(`      ❌ Error: ${error.message}`);
      await updateEnrichmentTask(task.id, {
        status: 'failed',
        error_message: error.message
      });
      failedCount++;
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
  processISWCDiscovery(limit)
    .catch(error => {
      console.error('❌ ISWC discovery failed:', error);
      process.exit(1);
    });
}
