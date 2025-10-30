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
import { upsertSegmentSQL } from '../db/karaoke-segments';
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

    // Create karaoke_segments record with status='processing'
    const sql = upsertSegmentSQL({
      spotify_track_id: track.spotify_track_id,
      separation_status: 'processing',
      separation_job_id: result.jobId,
      separation_mode: result.mode,
    });

    await query(sql);
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

  // Get webhook domain from env or fallback to hardcoded default
  const PIPELINE_WEBHOOK_DOMAIN = process.env.PIPELINE_WEBHOOK_DOMAIN || 'https://api.workers.dev';

  // Initialize Demucs service
  const demucsService = createDemucsService();
  const webhookUrl = `${PIPELINE_WEBHOOK_DOMAIN}/webhooks/demucs-complete`;

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
      WHERE sp.status = 'audio_downloaded'
        AND NOT EXISTS (
          SELECT 1 FROM karaoke_segments ks
          WHERE ks.spotify_track_id = sp.spotify_track_id
            AND ks.separation_status IN ('processing', 'completed')
        )
      ORDER BY sp.created_at ASC
      LIMIT ${limit}
    `);

    if (tracksToProcess.length === 0) {
      console.log('✓ No tracks need separation (all caught up!)');
      return;
    }

    console.log(`Found ${tracksToProcess.length} tracks needing separation`);

    let submittedCount = 0;
    let skippedCount = 0;

    for (const track of tracksToProcess) {
      try {
        if (!track.grove_url) {
          console.log(`  ⚠️  ${track.spotify_track_id}: No audio URL - skipping`);
          skippedCount++;
          continue;
        }

        const result = await demucsService.separateAsync(
          track.spotify_track_id,
          track.grove_url,
          webhookUrl
        );

        // Create karaoke_segments record
        const sql = upsertSegmentSQL({
          spotify_track_id: track.spotify_track_id,
          separation_status: 'processing',
          separation_job_id: result.jobId,
          separation_mode: result.mode,
        });

        await query(sql);
        submittedCount++;

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        console.log(`  ❌ ${track.spotify_track_id}: ${error.message}`);
        skippedCount++;
      }
    }

    console.log(`\n✅ Separation jobs submitted: ${submittedCount} (skipped: ${skippedCount})`);
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
