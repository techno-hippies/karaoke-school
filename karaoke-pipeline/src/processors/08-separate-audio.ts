#!/usr/bin/env bun
/**
 * Processor: Submit Audio Separation Jobs to Demucs
 * Step 8 in the pipeline: audio_downloaded → stems_separated (via async webhook)
 *
 * Architecture:
 * - Finds downloaded audio tracks without separation
 * - Submits to DemucsService (local GPU or remote API)
 * - Creates karaoke_segments record with job ID
 * - Webhook (/webhooks/demucs-complete) handles results asynchronously
 *
 * Flow:
 * 1. Find tracks with status='audio_downloaded' and no separation job
 * 2. Get song_audio.grove_url (full-length audio uploaded by audio-download-service)
 * 3. Submit separation job to DemucsService.separateAsync()
 * 4. Create karaoke_segments record with status='processing'
 * 5. Processor returns immediately (webhook updates DB when done)
 * 6. Webhook: Receives instrumental_base64 → uploads to Grove → updates status
 *
 * Usage as CLI:
 *   bun src/processors/08-separate-audio.ts [batchSize]
 *   Example: bun src/processors/08-separate-audio.ts 10
 *
 * Usage in orchestrator:
 *   Imported and called by runUnifiedPipeline()
 *
 * Environment:
 *   DEMUCS_MODE=local|remote
 *   DEMUCS_LOCAL_ENDPOINT=http://localhost:8000
 *   DEMUCS_REMOTE_ENDPOINT=https://api.demucs.example.com (optional)
 *   PIPELINE_WEBHOOK_DOMAIN=https://yourapi.workers.dev
 */

import type { Env } from '../types';
import { query, close } from '../db/neon';
import { DemucsService, createDemucsService } from '../services/demucs';

interface Track {
  id: number;
  spotify_track_id: string;
  title: string;
  artists: string[] | { id: string; name: string }[];
  duration_ms: number;
  grove_url?: string;
}

async function submitDemucsJob(
  track: Track,
  demucsService: DemucsService,
  webhookUrl: string
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
    // Submit to Demucs service
    const result = await demucsService.separateAsync(
      track.spotify_track_id,
      track.grove_url,
      webhookUrl
    );

    console.log(
      `     ✓ Submitted (job: ${result.jobId}, mode: ${result.mode})`
    );

    // Note: Webhook will update song_audio and song_pipeline when Demucs completes
  } catch (error: any) {
    console.error(`     ❌ Submission failed: ${error.message}`);
  }
}

/**
 * Processor function for orchestrator integration
 * Can be called by runUnifiedPipeline() with Env and limit parameters
 */
export async function processSeparateAudio(env: Env, limit: number = 50): Promise<void> {
  console.log(`\n[Step 8] Audio Separation via Demucs (limit: ${limit})`);

  // Initialize Demucs service
  const demucsService = createDemucsService();

  try {
    // Find tracks ready for separation
    // Check: has audio downloaded but no instrumental separated yet
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
    let failedCount = 0;

    for (const track of tracksToProcess) {
      const trackTitle = Array.isArray(track.artists)
        ? `${track.title} - ${
            typeof track.artists[0] === 'object'
              ? (track.artists[0] as { name: string }).name
              : track.artists[0]
          }`
        : track.title;

      try {
        if (!track.grove_url) {
          console.log(`  ⚠️  ${trackTitle}: No audio URL - skipping`);
          failedCount++;
          continue;
        }

        console.log(`  🎵 ${trackTitle}`);

        // Use polling method instead of async webhook
        const result = await demucsService.separateWithRunPod(
          track.spotify_track_id,
          track.grove_url
        );

        // Update song_audio with the instrumental stems immediately
        await query(`
          UPDATE song_audio
          SET
            instrumental_grove_url = $1,
            instrumental_grove_cid = $2,
            vocals_grove_url = $3,
            vocals_grove_cid = $4,
            updated_at = NOW()
          WHERE spotify_track_id = $5
        `, [
          result.instrumental_grove_url,
          result.instrumental_grove_cid,
          result.vocals_grove_url,
          result.vocals_grove_cid,
          track.spotify_track_id
        ]);

        // Update song_pipeline status to stems_separated
        await query(`
          UPDATE song_pipeline
          SET status = 'stems_separated', updated_at = NOW()
          WHERE spotify_track_id = $1
        `, [track.spotify_track_id]);

        console.log(`     ✓ Separated and updated (instrumental: ${result.instrumental_grove_cid.substring(0, 8)}...)`);
        successCount++;
      } catch (error: any) {
        console.log(`     ❌ Separation failed: ${error.message}`);
        failedCount++;
      }
    }

    console.log(`\n✅ Step 8 Complete: ${successCount} separated, ${failedCount} failed`);
  } catch (error: any) {
    throw new Error(`Step 8 failed: ${error.message}`);
  }
}

/**
 * CLI runner - when invoked directly
 */
async function main() {
  const args = process.argv.slice(2);
  const batchSize = args[0] ? parseInt(args[0]) : 10;

  console.log('🎵 Audio Separation Job Submitter (CLI)');
  console.log(`📊 Batch size: ${batchSize}`);
  console.log(
    `🔊 Demucs mode: ${process.env.DEMUCS_MODE || 'local (default)'}`
  );
  console.log('');

  // Validate environment
  const DATABASE_URL = process.env.DATABASE_URL;
  const PIPELINE_WEBHOOK_DOMAIN = process.env.PIPELINE_WEBHOOK_DOMAIN;

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable required');
    process.exit(1);
  }

  if (!PIPELINE_WEBHOOK_DOMAIN) {
    console.error(
      '❌ PIPELINE_WEBHOOK_DOMAIN environment variable required'
    );
    console.error('   Set to your Cloudflare Workers domain (e.g., https://api.example.com)');
    process.exit(1);
  }

  console.log(`🌐 Webhook: ${PIPELINE_WEBHOOK_DOMAIN}/webhooks/demucs-complete`);
  console.log('');

  try {
    // Create a mock Env object for the processor
    const mockEnv = {} as Env;
    await processSeparateAudio(mockEnv, batchSize);

    console.log('');
    console.log('✅ Done! Check webhook logs for processing results.');
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
