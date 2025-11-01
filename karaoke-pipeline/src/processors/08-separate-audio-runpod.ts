#!/usr/bin/env bun
/**
 * Processor: Separate Audio with RunPod (Polling, No Webhook)
 * Step 8 in the pipeline: audio_downloaded → stems_separated
 *
 * This version uses RunPod serverless GPU and polls for completion instead of webhooks.
 * Perfect for local development without needing a public webhook endpoint.
 *
 * Flow:
 * 1. Find tracks with status='translations_ready' and downloaded audio
 * 2. Submit to RunPod GPU service
 * 3. Poll status until complete (~20-30s)
 * 4. Update song_audio with instrumental/vocals Grove URLs
 * 5. Update song_pipeline status to 'stems_separated'
 *
 * Usage as CLI:
 *   bun src/processors/08-separate-audio-runpod.ts [batchSize]
 *   Example: bun src/processors/08-separate-audio-runpod.ts 5
 *
 * Environment:
 *   DEMUCS_MODE=runpod
 *   RUNPOD_DEMUCS_ENDPOINT_ID=d5m1hiw88fsh2e
 *   RUNPOD_API_KEY=rpa_...
 */

import type { Env } from '../types';
import { query, close } from '../db/neon';
import { createDemucsService } from '../services/demucs';

interface Track {
  id: number;
  spotify_track_id: string;
  title: string;
  artists: string[] | { id: string; name: string }[];
  duration_ms: number;
  grove_url?: string;
}

async function separateTrack(
  track: Track
): Promise<void> {
  const trackTitle = Array.isArray(track.artists)
    ? `${track.title} - ${
        typeof track.artists[0] === 'object'
          ? (track.artists[0] as { name: string }).name
          : track.artists[0]
      }`
    : track.title;

  console.log(
    `  🎵 ${trackTitle} (${(track.duration_ms / 1000 / 60).toFixed(1)}m)`
  );

  if (!track.grove_url) {
    console.log(`     ⚠️  No audio URL found - skipping`);
    return;
  }

  try {
    const demucsService = createDemucsService();

    // Submit and poll until complete
    console.log(`     🚀 Submitting to RunPod...`);
    const result = await demucsService.separateWithRunPod(
      track.spotify_track_id,
      track.grove_url
    );

    console.log(`     ✓ Separation complete!`);
    console.log(`       Vocals: ${result.vocals_grove_cid}`);
    console.log(`       Instrumental: ${result.instrumental_grove_cid}`);
    console.log(`       Duration: ${result.duration.toFixed(1)}s (GPU: ${result.gpu_time.toFixed(1)}s)`);

    // Update song_audio table
    await query(`
      UPDATE song_audio
      SET
        vocals_grove_cid = $1,
        vocals_grove_url = $2,
        instrumental_grove_cid = $3,
        instrumental_grove_url = $4,
        separation_duration_seconds = $5,
        separation_mode = 'runpod-gpu',
        separated_at = NOW(),
        updated_at = NOW()
      WHERE spotify_track_id = $6
    `, [
      result.vocals_grove_cid,
      result.vocals_grove_url,
      result.instrumental_grove_cid,
      result.instrumental_grove_url,
      result.duration,
      track.spotify_track_id
    ]);

    // Update pipeline status
    await query(`
      UPDATE song_pipeline
      SET status = 'stems_separated', updated_at = NOW()
      WHERE spotify_track_id = $1
    `, [track.spotify_track_id]);

    console.log(`     ✅ Database updated`);

  } catch (error: any) {
    console.error(`     ❌ Failed: ${error.message}`);
    throw error;
  }
}

/**
 * Processor function for orchestrator integration
 */
export async function processSeparateAudioRunPod(env: Env, limit: number = 50): Promise<void> {
  console.log(`\n[Step 8] Audio Separation via RunPod GPU (limit: ${limit})`);

  // Validate environment
  if (!process.env.RUNPOD_DEMUCS_ENDPOINT_ID || !process.env.RUNPOD_API_KEY) {
    throw new Error('RUNPOD_DEMUCS_ENDPOINT_ID and RUNPOD_API_KEY required');
  }

  try {
    // Find tracks ready for separation
    const tracksToProcess = await query<Track>(`
      SELECT
        sp.id,
        sp.spotify_track_id,
        st.title,
        st.artists,
        st.duration_ms,
        sa.grove_url
      FROM song_pipeline sp
      JOIN spotify_tracks st ON sp.spotify_track_id = st.spotify_track_id
      LEFT JOIN song_audio sa ON sp.spotify_track_id = sa.spotify_track_id
      WHERE sp.status = 'translations_ready'
        AND sa.grove_url IS NOT NULL
        AND sa.instrumental_grove_url IS NULL
      ORDER BY sp.created_at ASC
      LIMIT ${limit}
    `);

    if (tracksToProcess.length === 0) {
      console.log('✓ No tracks need separation (all caught up!)');
      return;
    }

    console.log(`Found ${tracksToProcess.length} tracks needing separation`);

    let successCount = 0;
    let failCount = 0;

    for (const track of tracksToProcess) {
      try {
        await separateTrack(track);
        successCount++;

        // Small delay between tracks
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.log(`  ❌ ${track.spotify_track_id}: ${error.message}`);
        failCount++;
      }
    }

    console.log(`\n✅ Complete: ${successCount} separated, ${failCount} failed`);
  } catch (error: any) {
    throw new Error(`Step 8 (RunPod) failed: ${error.message}`);
  }
}

/**
 * CLI runner - when invoked directly
 */
async function main() {
  const args = process.argv.slice(2);
  const batchSize = args[0] ? parseInt(args[0]) : 5;

  console.log('🎵 Audio Separation with RunPod GPU (CLI)');
  console.log(`📊 Batch size: ${batchSize}`);
  console.log(`🔧 Endpoint: ${process.env.RUNPOD_DEMUCS_ENDPOINT_ID || 'NOT SET'}`);
  console.log('');

  // Validate environment
  const DATABASE_URL = process.env.DATABASE_URL;
  const RUNPOD_DEMUCS_ENDPOINT_ID = process.env.RUNPOD_DEMUCS_ENDPOINT_ID;
  const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable required');
    process.exit(1);
  }

  if (!RUNPOD_DEMUCS_ENDPOINT_ID) {
    console.error('❌ RUNPOD_DEMUCS_ENDPOINT_ID environment variable required');
    process.exit(1);
  }

  if (!RUNPOD_API_KEY) {
    console.error('❌ RUNPOD_API_KEY environment variable required');
    process.exit(1);
  }

  try {
    const mockEnv = {} as Env;
    await processSeparateAudioRunPod(mockEnv, batchSize);

    console.log('');
    console.log('✅ Done!');
  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await close();
  }
}

// Run CLI if this script is invoked directly
if (import.meta.main) {
  main();
}
