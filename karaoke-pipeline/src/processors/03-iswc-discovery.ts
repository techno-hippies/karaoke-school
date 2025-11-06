/**
 * Step 3: ISWC Discovery (Clean Implementation)
 *
 * Fault-tolerant ISWC lookup with multi-source fallback:
 * 1. Check caches (Quansic, MLC, BMI, MusicBrainz)
 * 2. Call Quansic API
 * 3. MLC fallback (direct ISRC→ISWC)
 * 4. BMI fallback (fuzzy title/artist match)
 * 5. Mark as failure (prevents re-queries)
 *
 * Pipeline advances regardless of ISWC availability (has_iswc flag tracks presence).
 */

import { query } from '../db/neon';
import type { Env } from '../types';
import { searchBMI } from '../services/bmi';
import { searchMLC } from '../services/mlc';

interface Track {
  id: number;
  spotify_track_id: string;
  isrc: string;
  title: string;
  artist_name: string;
}

interface ISWCResult {
  iswc: string | null;
  source: string;
}

/**
 * Check all cache layers for ISWC
 * Priority: Quansic → MLC → BMI → MusicBrainz (live join)
 */
async function checkAllCaches(isrc: string): Promise<ISWCResult | null> {
  // Priority 1: Quansic recordings
  const quansic = await query<{ iswc: string }>(`
    SELECT iswc FROM quansic_recordings
    WHERE isrc = $1 AND iswc IS NOT NULL
    LIMIT 1
  `, [isrc]);
  if (quansic[0]?.iswc) {
    return { iswc: quansic[0].iswc, source: 'quansic_cache' };
  }

  // Priority 2: MLC works (direct ISRC→ISWC)
  const mlc = await query<{ iswc: string }>(`
    SELECT iswc FROM mlc_works
    WHERE isrc = $1 AND iswc IS NOT NULL
    LIMIT 1
  `, [isrc]);
  if (mlc[0]?.iswc) {
    return { iswc: mlc[0].iswc, source: 'mlc_cache' };
  }

  // Priority 3: BMI works (fuzzy match)
  const bmi = await query<{ iswc: string }>(`
    SELECT iswc FROM bmi_works
    WHERE isrc = $1 AND iswc IS NOT NULL
    LIMIT 1
  `, [isrc]);
  if (bmi[0]?.iswc) {
    return { iswc: bmi[0].iswc, source: 'bmi_cache' };
  }

  // Priority 4: MusicBrainz (via recording → work link)
  const mb = await query<{ iswc: string }>(`
    SELECT w.iswc
    FROM musicbrainz_recordings r
    JOIN musicbrainz_works w ON r.work_mbid = w.work_mbid
    WHERE r.isrc = $1 AND w.iswc IS NOT NULL
    LIMIT 1
  `, [isrc]);
  if (mb[0]?.iswc) {
    return { iswc: mb[0].iswc, source: 'musicbrainz' };
  }

  return null;
}

/**
 * Check if this ISRC is a known failure (all sources exhausted recently)
 */
async function isKnownFailure(isrc: string): Promise<boolean> {
  const result = await query<{ isrc: string }>(`
    SELECT isrc FROM iswc_lookup_failures
    WHERE isrc = $1
      AND last_attempted_at > NOW() - INTERVAL '7 days'
    LIMIT 1
  `, [isrc]);

  return result.length > 0;
}

/**
 * Call Quansic API to enrich recording
 */
async function callQuansicAPI(env: Env, isrc: string, spotifyTrackId: string): Promise<any | null> {
  if (!env.QUANSIC_SERVICE_URL) {
    return null;
  }

  try {
    const response = await fetch(`${env.QUANSIC_SERVICE_URL}/enrich-recording`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isrc, spotify_track_id: spotifyTrackId }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      console.log(`   ⚠️  Quansic API returned ${response.status}`);
      return null;
    }

    const result = await response.json();

    if (result.success && result.data) {
      return result.data;
    }

    return null;
  } catch (error: any) {
    console.log(`   ❌ Quansic API error: ${error.message}`);
    return null;
  }
}

/**
 * Cache Quansic result in database
 */
async function cacheQuansicResult(data: any): Promise<void> {
  await query(`
    INSERT INTO quansic_recordings (
      isrc, iswc, spotify_track_id, title, work_title,
      artists, composers, platform_ids, enriched_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (isrc) DO UPDATE SET
      iswc = EXCLUDED.iswc,
      spotify_track_id = EXCLUDED.spotify_track_id,
      title = EXCLUDED.title,
      work_title = EXCLUDED.work_title,
      artists = EXCLUDED.artists,
      composers = EXCLUDED.composers,
      platform_ids = EXCLUDED.platform_ids,
      enriched_at = NOW()
  `, [
    data.isrc,
    data.iswc || null,
    data.spotify_track_id || null,
    data.title || null,
    data.work_title || null,
    data.artists ? JSON.stringify(data.artists) : null,
    data.composers ? JSON.stringify(data.composers) : null,
    data.platform_ids ? JSON.stringify(data.platform_ids) : null
  ]);
}

/**
 * Cache BMI result in database
 */
async function cacheBMIResult(isrc: string, bmiData: any): Promise<void> {
  await query(`
    INSERT INTO bmi_works (
      isrc, iswc, title, bmi_work_id, writers, publishers, cached_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (iswc) DO UPDATE SET
      isrc = EXCLUDED.isrc,
      title = EXCLUDED.title,
      bmi_work_id = EXCLUDED.bmi_work_id,
      writers = EXCLUDED.writers,
      publishers = EXCLUDED.publishers,
      cached_at = NOW()
  `, [
    isrc,
    bmiData.iswc || null,
    bmiData.title,
    bmiData.bmi_work_id || null,
    bmiData.writers ? JSON.stringify(bmiData.writers) : null,
    bmiData.publishers ? JSON.stringify(bmiData.publishers) : null
  ]);
}

/**
 * Cache MLC result in database
 */
async function cacheMLCResult(mlcData: any): Promise<void> {
  await query(`
    INSERT INTO mlc_works (
      isrc, mlc_song_code, iswc, title, writers, publishers,
      total_publisher_share, cached_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (isrc, mlc_song_code) DO UPDATE SET
      iswc = EXCLUDED.iswc,
      title = EXCLUDED.title,
      writers = EXCLUDED.writers,
      publishers = EXCLUDED.publishers,
      total_publisher_share = EXCLUDED.total_publisher_share,
      cached_at = NOW()
  `, [
    mlcData.isrc,
    mlcData.mlc_song_code,
    mlcData.iswc || null,
    mlcData.title,
    mlcData.writers ? JSON.stringify(mlcData.writers) : null,
    mlcData.publishers ? JSON.stringify(mlcData.publishers) : null,
    mlcData.total_publisher_share || null
  ]);
}

/**
 * Mark ISRC as failed lookup (all sources exhausted)
 */
async function markAsFailure(isrc: string, attemptedSources: string[], reason?: string): Promise<void> {
  // Build PostgreSQL ARRAY[] syntax manually since query() treats arrays as JSONB
  const sourcesArray = `ARRAY[${attemptedSources.map(s => `'${s}'`).join(',')}]::text[]`;

  await query(`
    INSERT INTO iswc_lookup_failures (isrc, attempted_sources, failure_reason, last_attempted_at)
    VALUES ($1, ${sourcesArray}, $2, NOW())
    ON CONFLICT (isrc) DO UPDATE SET
      attempted_sources = EXCLUDED.attempted_sources,
      failure_reason = EXCLUDED.failure_reason,
      last_attempted_at = NOW()
  `, [isrc, reason || 'No ISWC found in any source']);
}

/**
 * Update song_pipeline with ISWC result
 */
async function updatePipeline(track: Track, iswc: string | null, source: string): Promise<void> {
  await query(`
    UPDATE song_pipeline
    SET
      status = 'iswc_found',
      has_iswc = $1,
      iswc = $2,
      last_attempted_at = NOW(),
      updated_at = NOW()
    WHERE id = $3
  `, [iswc !== null, iswc, track.id]);

  // Log to processing_log
  await query(`
    INSERT INTO processing_log (spotify_track_id, stage, action, source, message, metadata)
    VALUES ($1, 'iswc_discovery', $2, $3, $4, $5)
  `, [
    track.spotify_track_id,
    iswc ? 'success' : 'no_iswc',
    source,
    iswc ? `Found ISWC: ${iswc}` : 'No ISWC available',
    JSON.stringify({ iswc, source })
  ]);
}

/**
 * Main processor: ISWC Discovery
 */
export async function processISWCDiscovery(env: Env, limit: number = 50): Promise<void> {
  console.log(`[Step 3] ISWC Discovery (limit: ${limit})`);

  // Get tracks ready for ISWC lookup
  const tracks = await query<Track>(`
    SELECT
      sp.id,
      sp.spotify_track_id,
      sp.isrc,
      st.title,
      st.artists->0->>'name' as artist_name
    FROM song_pipeline sp
    JOIN spotify_tracks st ON sp.spotify_track_id = st.spotify_track_id
    WHERE sp.status = 'spotify_resolved'
      AND sp.isrc IS NOT NULL
      AND (sp.last_attempted_at IS NULL OR sp.last_attempted_at < NOW() - INTERVAL '1 hour')
    ORDER BY sp.created_at ASC
    LIMIT $1
  `, [limit]);

  if (tracks.length === 0) {
    console.log('✓ No tracks need ISWC lookup');
    return;
  }

  console.log(`Found ${tracks.length} tracks`);

  let succeeded = 0;
  let failed = 0;
  let cached = 0;

  for (const track of tracks) {
    try {
      let iswc: string | null = null;
      let source: string = 'unknown';
      const attemptedSources: string[] = [];

      console.log(`\n🔍 ${track.title} - ${track.artist_name}`);
      console.log(`   ISRC: ${track.isrc}`);

      // STEP 1: Check all caches
      const cacheResult = await checkAllCaches(track.isrc);
      if (cacheResult) {
        iswc = cacheResult.iswc;
        source = cacheResult.source;
        cached++;
        console.log(`   ✅ Cache hit (${source}): ${iswc}`);
        await updatePipeline(track, iswc, source);
        succeeded++;
        continue;
      }

      // STEP 2: Check if known failure
      if (await isKnownFailure(track.isrc)) {
        console.log(`   ⏭️  Known failure (skip)` );
        await updatePipeline(track, null, 'known_failure');
        failed++;
        continue;
      }

      // STEP 3: Call Quansic API
      attemptedSources.push('quansic');
      console.log(`   🌐 Calling Quansic API...`);
      const quansicData = await callQuansicAPI(env, track.isrc, track.spotify_track_id);

      if (quansicData) {
        await cacheQuansicResult(quansicData);

        if (quansicData.iswc) {
          iswc = quansicData.iswc;
          source = 'quansic_api';
          console.log(`   ✅ Quansic found ISWC: ${iswc}`);
          await updatePipeline(track, iswc, source);
          succeeded++;
          await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit
          continue;
        } else {
          console.log(`   ⚠️  Quansic returned no ISWC`);
        }
      }

      // STEP 4: Try MLC fallback (direct ISRC→ISWC)
      attemptedSources.push('mlc');
      console.log(`   🔍 Trying MLC fallback (ISRC→ISWC)...`);
      const mlcResult = await searchMLC(track.isrc, track.title, track.artist_name);

      if (mlcResult?.iswc) {
        await cacheMLCResult(mlcResult);
        iswc = mlcResult.iswc;
        source = 'mlc_api';
        console.log(`   ✅ MLC found ISWC: ${iswc}`);
        await updatePipeline(track, iswc, source);
        succeeded++;
        await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit
        continue;
      } else {
        console.log(`   ⚠️  MLC returned no ISWC`);
      }

      // STEP 5: Try BMI fallback (fuzzy title/artist match)
      if (!track.artist_name) {
        console.log(`   ⏭️  No artist name, skipping BMI`);
        await markAsFailure(track.isrc, attemptedSources, 'No artist name for BMI fallback search');
        await updatePipeline(track, null, 'no_artist');
        failed++;
        continue;
      }

      attemptedSources.push('bmi');
      console.log(`   🔍 Trying BMI fallback (fuzzy match)...`);
      const bmiResult = await searchBMI(track.title, track.artist_name);

      if (bmiResult?.iswc) {
        await cacheBMIResult(track.isrc, bmiResult);
        iswc = bmiResult.iswc;
        source = 'bmi_api';
        console.log(`   ✅ BMI found ISWC: ${iswc}`);
        await updatePipeline(track, iswc, source);
        succeeded++;
        await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit
        continue;
      } else {
        console.log(`   ⚠️  BMI returned no ISWC`);
      }

      // STEP 6: All sources exhausted - mark as failure
      console.log(`   ❌ No ISWC found in any source`);
      await markAsFailure(track.isrc, attemptedSources);
      await updatePipeline(track, null, 'all_sources_exhausted');
      failed++;

    } catch (error: any) {
      console.error(`   ❌ Processing error: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Step 3 Complete: ${succeeded} succeeded, ${failed} failed, ${cached} from cache`);
}
