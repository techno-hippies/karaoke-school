/**
 * Step 8: ISWC Discovery Processor (THE GATE!)
 *
 * Tries to find ISWC for tracks via:
 * 1. Cache lookup (quansic_cache, quansic_recordings, musicbrainz)
 * 2. Quansic API call (if not cached)
 * 3. MusicBrainz fallback (if Quansic fails)
 *
 * Gate logic:
 * - ISWC found → status = 'iswc_found' (can continue)
 * - ISWC not found → status = 'failed' (dead end, can't mint without ISWC)
 */

import { NeonDB } from '../db';
import type { Env, TrackToProcess } from '../types';

export async function processISWCDiscovery(env: Env, limit: number = 50): Promise<void> {
  console.log('🚪 Step 8: ISWC Discovery (Gate)');

  const db = new NeonDB(env.NEON_DATABASE_URL);

  // Get tracks ready for ISWC lookup
  const tracks = await db.sql<TrackToProcess[]>`
    SELECT
      tp.id,
      tp.spotify_track_id,
      tp.isrc,
      st.title
    FROM song_pipeline tp
    JOIN spotify_tracks st ON tp.spotify_track_id = st.spotify_track_id
    WHERE tp.status = 'spotify_resolved'
      AND tp.isrc IS NOT NULL
      AND (tp.last_attempted_at IS NULL OR tp.last_attempted_at < NOW() - INTERVAL '1 hour')
      AND tp.retry_count < 3
    ORDER BY tp.created_at ASC
    LIMIT ${limit}
  `;

  if (tracks.length === 0) {
    console.log('   No tracks need ISWC lookup');
    return;
  }

  console.log(`   Processing ${tracks.length} tracks\n`);

  let passed = 0;
  let failed = 0;
  let cached = 0;
  let apiCalls = 0;

  for (const track of tracks) {
    try {
      // Step 1: Check all caches
      let iswc = await checkCacheForISWC(db, track.isrc);

      if (iswc) {
        cached++;
        console.log(`   ✅ ${track.title} - cached ISWC: ${iswc}`);

        // Update pipeline with cached ISWC
        await db.sql`
          UPDATE song_pipeline
          SET
            status = 'iswc_found',
            has_iswc = TRUE,
            iswc = ${iswc},
            last_attempted_at = NOW(),
            updated_at = NOW()
          WHERE id = ${track.id}
        `;

        // Log to processing_log
        await db.sql`
          INSERT INTO processing_log (spotify_track_id, stage, action, source, message)
          VALUES (${track.spotify_track_id}, 'iswc_lookup', 'success', 'cache', ${`Found ISWC: ${iswc}`})
        `;

        passed++;
        continue;
      }

      // Step 2: Call Quansic API (DISABLED - Akash maintenance)
      // TODO: Re-enable when Akash is back online
      if (false && env.QUANSIC_SERVICE_URL) {
        apiCalls++;
        console.log(`   🔍 ${track.title} - calling Quansic API...`);

        try {
          const quansicResponse = await fetch(`${env.QUANSIC_SERVICE_URL}/enrich-recording`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              isrc: track.isrc,
              spotify_track_id: track.spotify_track_id
            })
          });

          if (quansicResponse.ok) {
            const { data } = await quansicResponse.json();

            // Extract ISWC
            iswc = data.iswc || data.raw_data?.recording?.works?.[0]?.iswc;

            if (iswc) {
              console.log(`   ✅ ${track.title} - API found ISWC: ${iswc}`);

              // Cache in quansic_cache
              await db.sql`
                INSERT INTO quansic_cache (isrc, iswc, raw_data, fetched_at)
                VALUES (${track.isrc}, ${iswc}, ${JSON.stringify(data)}, NOW())
                ON CONFLICT (isrc) DO UPDATE SET
                  iswc = EXCLUDED.iswc,
                  raw_data = EXCLUDED.raw_data,
                  fetched_at = NOW()
              `;

              // Update pipeline
              await db.sql`
                UPDATE song_pipeline
                SET
                  status = 'iswc_found',
                  has_iswc = TRUE,
                  iswc = ${iswc},
                  last_attempted_at = NOW(),
                  updated_at = NOW()
                WHERE id = ${track.id}
              `;

              // Log success
              await db.sql`
                INSERT INTO processing_log (spotify_track_id, stage, action, source, message)
                VALUES (${track.spotify_track_id}, 'iswc_lookup', 'success', 'quansic_api', ${`Found ISWC: ${iswc}`})
              `;

              passed++;
              await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit
              continue;
            } else {
              console.log(`   ⚠️ ${track.title} - Quansic returned no ISWC`);
            }
          } else {
            console.log(`   ⚠️ ${track.title} - Quansic API error: ${quansicResponse.status}`);
          }
        } catch (error: any) {
          console.error(`   ❌ ${track.title} - Quansic API call failed:`, error.message);
        }
      }

      // Step 3: No ISWC found - GATE FAILED
      console.log(`   ❌ ${track.title} - NO ISWC FOUND (gate failed)`);

      await db.sql`
        UPDATE song_pipeline
        SET
          status = 'failed',
          error_message = 'No ISWC found in Quansic or MusicBrainz',
          error_stage = 'iswc_lookup',
          last_attempted_at = NOW(),
          retry_count = retry_count + 1,
          updated_at = NOW()
        WHERE id = ${track.id}
      `;

      // Log failure
      await db.sql`
        INSERT INTO processing_log (spotify_track_id, stage, action, message)
        VALUES (${track.spotify_track_id}, 'iswc_lookup', 'failed', 'No ISWC found - cannot proceed to mint')
      `;

      failed++;

    } catch (error: any) {
      console.error(`   ❌ ${track.title} - Processing error:`, error.message);

      // Increment retry count
      await db.sql`
        UPDATE song_pipeline
        SET
          retry_count = retry_count + 1,
          error_message = ${error.message},
          error_stage = 'iswc_lookup',
          last_attempted_at = NOW(),
          updated_at = NOW()
        WHERE id = ${track.id}
      `;

      failed++;
    }
  }

  console.log(`\n✅ Step 8 Complete:`);
  console.log(`   ✅ Passed gate: ${passed} / ${tracks.length}`);
  console.log(`   ❌ Failed gate: ${failed} / ${tracks.length}`);
  console.log(`   📊 Cache hits: ${cached}`);
  console.log(`   🌐 API calls: ${apiCalls}`);
}

/**
 * Check all caches for ISWC
 */
async function checkCacheForISWC(db: NeonDB, isrc: string): Promise<string | null> {
  // Priority 1: quansic_cache
  const qcResult = await db.sql`SELECT iswc FROM quansic_cache WHERE isrc = ${isrc} AND iswc IS NOT NULL`;
  if (qcResult[0]?.iswc) return qcResult[0].iswc as string;

  // Priority 2: quansic_recordings
  const qrResult = await db.sql`SELECT iswc FROM quansic_recordings WHERE isrc = ${isrc} AND iswc IS NOT NULL`;
  if (qrResult[0]?.iswc) return qrResult[0].iswc as string;

  // Priority 3: musicbrainz_cache
  const mbcResult = await db.sql`SELECT iswc FROM musicbrainz_cache WHERE isrc = ${isrc} AND iswc IS NOT NULL`;
  if (mbcResult[0]?.iswc) return mbcResult[0].iswc as string;

  // Priority 4: musicbrainz_recordings → works
  const mbResult = await db.sql`
    SELECT w.iswc
    FROM musicbrainz_recordings r
    JOIN work_recording_links wrl ON r.recording_mbid = wrl.recording_mbid
    JOIN musicbrainz_works w ON wrl.work_mbid = w.work_mbid
    WHERE r.isrc = ${isrc} AND w.iswc IS NOT NULL
    LIMIT 1
  `;
  if (mbResult[0]?.iswc) return mbResult[0].iswc as string;

  return null;
}
