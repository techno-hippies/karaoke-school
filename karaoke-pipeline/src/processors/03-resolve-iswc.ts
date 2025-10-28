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
import {
  upsertQuansicRecordingSQL,
  updatePipelineISWCSQL,
  logQuansicProcessingSQL,
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
    console.error('❌ Quansic service is not healthy! Make sure it\'s running on http://localhost:3000');
    console.error('   Run: cd ../quansic-service && bun run dev');
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
  }>(`
    SELECT
      tp.id,
      tp.tiktok_video_id,
      tp.spotify_track_id,
      st.isrc,
      st.title
    FROM track_pipeline tp
    JOIN spotify_tracks st ON tp.spotify_track_id = st.spotify_track_id
    WHERE tp.status = 'spotify_resolved'
      AND st.isrc IS NOT NULL
      AND tp.has_iswc = FALSE
    ORDER BY tp.id
    LIMIT ${batchSize}
  `);

  if (tracksToProcess.length === 0) {
    console.log('✅ No tracks need ISWC resolution. All caught up!');
    return;
  }

  console.log(`✅ Found ${tracksToProcess.length} tracks to process`);
  console.log('');

  // Check cache for existing Quansic data
  const isrcs = tracksToProcess.map(t => t.isrc);
  const cachedRecordings = await query<{
    isrc: string;
    iswc: string | null;
  }>(`
    SELECT isrc, iswc
    FROM quansic_recordings
    WHERE isrc = ANY(ARRAY[${isrcs.map(isrc => `'${isrc}'`).join(',')}])
  `);

  const cachedISRCs = new Set(cachedRecordings.map(r => r.isrc));
  const uncachedTracks = tracksToProcess.filter(t => !cachedISRCs.has(t.isrc));

  console.log(`💾 Cache hits: ${cachedRecordings.length}`);
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

        if (!result.success || !result.data) {
          console.log(`     ❌ Failed: ${result.error || 'No data returned'}`);
          sqlStatements.push(
            logQuansicProcessingSQL(
              track.spotify_track_id,
              track.isrc,
              'failed',
              result.error || 'No data returned'
            )
          );
          failCount++;
          continue;
        }

        const data = result.data;
        const hasISWC = !!data.iswc;

        console.log(`     ✅ ${data.title}`);
        console.log(`        ISWC: ${data.iswc || 'N/A'}`);
        console.log(`        Work: ${data.work_title || 'N/A'}`);
        console.log(`        Composers: ${data.composers.length}`);

        // Store Quansic recording data
        sqlStatements.push(upsertQuansicRecordingSQL(data));

        // Update pipeline status
        sqlStatements.push(
          updatePipelineISWCSQL(track.spotify_track_id, data.iswc)
        );

        // Log success
        sqlStatements.push(
          logQuansicProcessingSQL(
            track.spotify_track_id,
            track.isrc,
            'success',
            `ISWC ${hasISWC ? 'found' : 'not available'}`,
            { iswc: data.iswc, work_title: data.work_title }
          )
        );

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

  for (const track of tracksToProcess.filter(t => cachedISRCs.has(t.isrc))) {
    const cached = cachedRecordings.find(r => r.isrc === track.isrc);
    if (cached) {
      sqlStatements.push(
        updatePipelineISWCSQL(track.spotify_track_id, cached.iswc)
      );

      sqlStatements.push(
        logQuansicProcessingSQL(
          track.spotify_track_id,
          track.isrc,
          'success',
          'Used cached Quansic data',
          { source: 'cache' }
        )
      );

      if (cached.iswc) iswcFoundCount++;
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
  console.log(`   - Cache hits: ${cachedRecordings.length}`);
  console.log(`   - API fetches: ${successCount}`);
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
