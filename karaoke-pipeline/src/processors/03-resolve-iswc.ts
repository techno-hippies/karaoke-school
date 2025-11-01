#!/usr/bin/env bun
/**
 * Processor: Resolve ISWC via Quansic
 * Takes tracks with ISRCs and fetches ISWC + work metadata from Quansic
 *
 * Usage:
 *   bun src/processors/03-resolve-iswc.ts [batchSize]
 */

import { query, transaction, close } from '../db/neon';
import { enrichRecording, checkHealth } from '../services/quansic';
import { searchBMI } from '../services/bmi';
import { searchMLC } from '../services/mlc';
import {
  upsertQuansicRecordingSQL,
  updatePipelineISWCSQL,
  logQuansicProcessingSQL,
  insertBMIWorkSQL,
  insertMLCWorkSQL,
  insertEnrichmentCacheFailureSQL,
} from '../db/quansic';

async function main() {
  const args = process.argv.slice(2);
  const batchSize = args[0] ? parseInt(args[0]) : 10;

  console.log('🎵 ISWC Resolver (via Quansic)');
  console.log(`📊 Batch size: ${batchSize}`);
  console.log('');

  // Check Quansic service health
  console.log('⏳ Checking Quansic service...');
  const isHealthy = await checkHealth();

  if (!isHealthy) {
    console.error('❌ Quansic service is not healthy!');
    console.error('   Service URL: http://d1crjmbvpla6lc3afdemo0mhgo.ingress.dhcloud.xyz (Akash-hosted)');
    console.error('   Or override with QUANSIC_URL environment variable');
    process.exit(1);
  }

  console.log('✅ Quansic service is healthy');
  console.log('');

  // Find tracks that need ISWC resolution
  console.log('⏳ Finding tracks ready for ISWC resolution...');

  const tracksToProcess = await query<{
    id: number;
    tiktok_video_id: string;
    spotify_track_id: string;
    isrc: string;
    title: string;
    artist: string | null;
  }>(`
    SELECT
      tp.id,
      tp.tiktok_video_id,
      tp.spotify_track_id,
      COALESCE(st.isrc, tp.isrc) as isrc,
      st.title,
      st.artists->0->>'name' as artist
    FROM song_pipeline tp
    LEFT JOIN spotify_tracks st ON tp.spotify_track_id = st.spotify_track_id
    WHERE (st.isrc IS NOT NULL OR tp.isrc IS NOT NULL)
      AND tp.iswc IS NULL
      AND tp.status != 'failed'
      AND (tp.last_attempted_at IS NULL OR tp.last_attempted_at < NOW() - INTERVAL '24 hours')
    ORDER BY tp.id
    LIMIT ${batchSize}
  `);

  if (tracksToProcess.length === 0) {
    console.log('✅ No tracks need ISWC resolution. All caught up!');
    return;
  }

  console.log(`✅ Found ${tracksToProcess.length} tracks to process`);
  console.log('');

  // Check four-layer cache: Quansic successes, BMI successes, MLC successes, known failures
  const isrcs = tracksToProcess.map(t => t.isrc);

  const quansicCache = await query<{ isrc: string; iswc: string | null }>(`
    SELECT isrc, iswc FROM quansic_recordings
    WHERE isrc = ANY(ARRAY[${isrcs.map(isrc => `'${isrc}'`).join(',')}])
  `);

  const bmiCache = await query<{ iswc: string }>(`
    SELECT DISTINCT bw.iswc
    FROM bmi_works bw
    WHERE bw.iswc IN (
      SELECT qr.iswc
      FROM quansic_recordings qr
      WHERE qr.isrc = ANY(ARRAY[${isrcs.map(isrc => `'${isrc}'`).join(',')}])
        AND qr.iswc IS NOT NULL
    )
  `);

  const mlcCache = await query<{ isrc: string; iswc: string | null }>(`
    SELECT isrc, iswc FROM mlc_works
    WHERE isrc = ANY(ARRAY[${isrcs.map(isrc => `'${isrc}'`).join(',')}])
  `);

  const failureCache = await query<{ isrc: string }>(`
    SELECT isrc FROM recording_enrichment_cache
    WHERE isrc = ANY(ARRAY[${isrcs.map(isrc => `'${isrc}'`).join(',')}])
      AND lookup_status = 'not_found'
  `);

  const quansicCachedISRCs = new Set(quansicCache.map(r => r.isrc));
  const bmicachedISRCs = new Set(bmiCache.map(r => r.iswc));
  const mlcCachedISRCs = new Set(mlcCache.map(r => r.isrc));
  const failureCachedISRCs = new Set(failureCache.map(r => r.isrc));

  // Tracks we need to query: not in any cache
  const uncachedTracks = tracksToProcess.filter(
    t => !quansicCachedISRCs.has(t.isrc) && !failureCachedISRCs.has(t.isrc)
  );

  console.log(`💾 Quansic cache hits: ${quansicCache.length}`);
  console.log(`📖 BMI cache hits: ${bmiCache.length}`);
  console.log(`📜 MLC cache hits: ${mlcCache.length}`);
  console.log(`⛔ Known failures: ${failureCache.length}`);
  console.log(`🌐 API requests needed: ${uncachedTracks.length}`);
  console.log('');

  // Fetch uncached tracks from Quansic API
  const sqlStatements: string[] = [];
  let successCount = 0;
  let failCount = 0;
  let iswcFoundCount = 0;

  if (uncachedTracks.length > 0) {
    console.log('⏳ Fetching ISWCs from Quansic...');

    for (const track of uncachedTracks) {
      try {
        console.log(`  🔍 ${track.title} (${track.isrc})`);

        const result = await enrichRecording(
          track.isrc,
          track.spotify_track_id
        );

        let finalISWC: string | null = null;
        let quansicData = null;

        if (!result.success || !result.data) {
          console.log(`     ❌ Quansic failed: ${result.error || 'No data returned'}`);

          // Try BMI fallback immediately when Quansic fails
          if (track.artist) {
            const bmiResult = await searchBMI(track.title, track.artist);
            if (bmiResult?.iswc) {
              finalISWC = bmiResult.iswc;
              console.log(`     📖 BMI found ISWC: ${finalISWC}`);

              // Cache BMI result (with Spotify title for reproducibility)
              sqlStatements.push(insertBMIWorkSQL({
                ...bmiResult,
                title: track.title  // Use Spotify title, not BMI's ALL CAPS
              }));

              // Log BMI source
              sqlStatements.push(
                logQuansicProcessingSQL(
                  track.spotify_track_id,
                  track.isrc,
                  'success',
                  `Quansic failed, ISWC found via BMI fallback`,
                  { iswc: finalISWC, source: 'bmi', bmi_work_id: bmiResult.bmi_work_id }
                )
              );
            } else {
              // Try MLC fallback when BMI also fails
              const mlcResult = await searchMLC(track.isrc, track.title, track.artist);
              if (mlcResult?.iswc) {
                finalISWC = mlcResult.iswc;
                console.log(`     📜 MLC found ISWC: ${finalISWC}`);

                // Cache MLC result (with Spotify title for reproducibility)
                sqlStatements.push(insertMLCWorkSQL({
                  ...mlcResult,
                  title: track.title  // Use Spotify title, not MLC's ALL CAPS
                }));

                // Log MLC source
                sqlStatements.push(
                  logQuansicProcessingSQL(
                    track.spotify_track_id,
                    track.isrc,
                    'success',
                    `Quansic and BMI failed, ISWC found via MLC fallback`,
                    { iswc: finalISWC, source: 'mlc', mlc_song_code: mlcResult.mlc_song_code }
                  )
                );
              }
            }
          }

          // Still move pipeline forward (fault-tolerant)
          sqlStatements.push(
            updatePipelineISWCSQL(track.spotify_track_id, finalISWC)
          );

          if (!finalISWC) {
            // Mark as "not found in Quansic, BMI, and MLC"
            sqlStatements.push(insertEnrichmentCacheFailureSQL(track.isrc, ['quansic', 'bmi', 'mlc']));

            sqlStatements.push(
              logQuansicProcessingSQL(
                track.spotify_track_id,
                track.isrc,
                'success',
                `Quansic API failed: ${result.error || 'No data returned'}. BMI and MLC also had no results. Continuing without ISWC.`
              )
            );
          }

          failCount++;
          if (finalISWC) iswcFoundCount++;
          continue;
        }

        quansicData = result.data;
        finalISWC = quansicData.iswc;

        console.log(`     ✅ ${quansicData.title}`);
        console.log(`        ISWC: ${quansicData.iswc || 'N/A'}`);
        console.log(`        Work: ${quansicData.work_title || 'N/A'}`);
        console.log(`        Composers: ${quansicData.composers.length}`);

        // If Quansic doesn't have ISWC, try BMI fallback
        if (!finalISWC && track.artist) {
          const bmiResult = await searchBMI(track.title, track.artist);
          if (bmiResult?.iswc) {
            finalISWC = bmiResult.iswc;
            console.log(`     📖 BMI found ISWC: ${finalISWC}`);

            // Cache BMI result (with Spotify title for reproducibility)
            sqlStatements.push(insertBMIWorkSQL({
              ...bmiResult,
              title: track.title  // Use Spotify title, not BMI's ALL CAPS
            }));

            // Log BMI source
            sqlStatements.push(
              logQuansicProcessingSQL(
                track.spotify_track_id,
                track.isrc,
                'success',
                `ISWC found via BMI fallback`,
                { iswc: finalISWC, source: 'bmi', bmi_work_id: bmiResult.bmi_work_id }
              )
            );
          } else {
            // Try MLC fallback when BMI also doesn't have ISWC
            const mlcResult = await searchMLC(track.isrc, track.title, track.artist);
            if (mlcResult?.iswc) {
              finalISWC = mlcResult.iswc;
              console.log(`     📜 MLC found ISWC: ${finalISWC}`);

              // Cache MLC result (with Spotify title for reproducibility)
              sqlStatements.push(insertMLCWorkSQL({
                ...mlcResult,
                title: track.title  // Use Spotify title, not MLC's ALL CAPS
              }));

              // Log MLC source
              sqlStatements.push(
                logQuansicProcessingSQL(
                  track.spotify_track_id,
                  track.isrc,
                  'success',
                  `BMI had no ISWC, found via MLC fallback`,
                  { iswc: finalISWC, source: 'mlc', mlc_song_code: mlcResult.mlc_song_code }
                )
              );
            }
          }
        }

        const hasISWC = !!finalISWC;

        // Store Quansic recording data
        sqlStatements.push(upsertQuansicRecordingSQL(quansicData));

        // Update pipeline status with final ISWC (from Quansic or BMI)
        sqlStatements.push(
          updatePipelineISWCSQL(track.spotify_track_id, finalISWC)
        );

        // Log Quansic success
        if (quansicData.iswc) {
          sqlStatements.push(
            logQuansicProcessingSQL(
              track.spotify_track_id,
              track.isrc,
              'success',
              `ISWC found in Quansic`,
              { iswc: quansicData.iswc, work_title: quansicData.work_title }
            )
          );
        }

        successCount++;
        if (hasISWC) iswcFoundCount++;

        // Rate limit: 5 requests/second
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error: any) {
        console.log(`     ❌ Error: ${error.message}`);
        sqlStatements.push(
          logQuansicProcessingSQL(
            track.spotify_track_id,
            track.isrc,
            'failed',
            error.message
          )
        );
        failCount++;
      }
    }

    console.log('');
  }

  // Update pipeline status for cached tracks
  console.log('⏳ Updating pipeline entries...');

  for (const track of tracksToProcess.filter(t => quansicCachedISRCs.has(t.isrc))) {
    const cached = quansicCache.find(r => r.isrc === track.isrc);
    if (cached) {
      let finalISWC = cached.iswc;

      // If cached ISWC is null, try BMI fallback
      if (!finalISWC && track.artist) {
        const bmiResult = await searchBMI(track.title, track.artist);
        if (bmiResult?.iswc) {
          finalISWC = bmiResult.iswc;
          console.log(`     📖 BMI found ISWC for cached track: ${finalISWC}`);

          // Cache BMI result (with Spotify title for reproducibility)
          sqlStatements.push(insertBMIWorkSQL({
            ...bmiResult,
            title: track.title  // Use Spotify title, not BMI's ALL CAPS
          }));

          // Log BMI source
          sqlStatements.push(
            logQuansicProcessingSQL(
              track.spotify_track_id,
              track.isrc,
              'success',
              `Cached Quansic had no ISWC, found via BMI fallback`,
              { iswc: finalISWC, source: 'bmi', bmi_work_id: bmiResult.bmi_work_id }
            )
          );
        } else {
          // Try MLC fallback when BMI also doesn't have ISWC
          const mlcResult = await searchMLC(track.isrc, track.title, track.artist);
          if (mlcResult?.iswc) {
            finalISWC = mlcResult.iswc;
            console.log(`     📜 MLC found ISWC for cached track: ${finalISWC}`);

            // Cache MLC result (with Spotify title for reproducibility)
            sqlStatements.push(insertMLCWorkSQL({
              ...mlcResult,
              title: track.title  // Use Spotify title, not MLC's ALL CAPS
            }));

            // Log MLC source
            sqlStatements.push(
              logQuansicProcessingSQL(
                track.spotify_track_id,
                track.isrc,
                'success',
                `Cached Quansic and BMI had no ISWC, found via MLC fallback`,
                { iswc: finalISWC, source: 'mlc', mlc_song_code: mlcResult.mlc_song_code }
              )
            );
          }
        }
      }

      sqlStatements.push(
        updatePipelineISWCSQL(track.spotify_track_id, finalISWC)
      );

      // Log cache usage if no BMI/MLC was needed
      if (cached.iswc) {
        sqlStatements.push(
          logQuansicProcessingSQL(
            track.spotify_track_id,
            track.isrc,
            'success',
            'Used cached Quansic data',
            { source: 'cache' }
          )
        );
      } else if (!finalISWC) {
        // Neither cache nor BMI/MLC had ISWC
        sqlStatements.push(
          logQuansicProcessingSQL(
            track.spotify_track_id,
            track.isrc,
            'success',
            'Cached Quansic had no ISWC, BMI and MLC also had no results',
            { source: 'cache' }
          )
        );
      }

      if (finalISWC) iswcFoundCount++;
    }
  }

  // Execute all SQL statements
  if (sqlStatements.length > 0) {
    try {
      await transaction(sqlStatements);
      console.log(`✅ Executed ${sqlStatements.length} SQL statements`);
    } catch (error) {
      console.error('❌ Failed to execute transaction:', error);
      throw error;
    }
  }

  console.log('');
  console.log('📊 Summary:');
  console.log(`   - Total tracks: ${tracksToProcess.length}`);
  console.log(`   - Quansic cache hits: ${quansicCache.length}`);
  console.log(`   - BMI cache hits: ${bmiCache.length}`);
  console.log(`   - MLC cache hits: ${mlcCache.length}`);
  console.log(`   - Known failures (enrichment cache): ${failureCache.length}`);
  console.log(`   - New API fetches: ${uncachedTracks.length}`);
  console.log(`   - Failed: ${failCount}`);
  console.log(`   - ISWCs found: ${iswcFoundCount}/${tracksToProcess.length}`);
  console.log('');
  console.log(`✅ Done! Tracks ${iswcFoundCount > 0 ? 'with ISWCs moved to: iswc_found' : 'without ISWCs marked: failed'}`);
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await close();
  });
