#!/usr/bin/env bun
/**
 * Pipeline Step 11.5: Upload TikTok Videos to Grove
 *
 * Uploads TikTok creator videos to Grove/IPFS for permanent storage.
 * Runs AFTER Step 11 (clips_cropped) to ensure videos are mint-ready.
 *
 * Flow:
 * - Fetch videos from tiktok_videos where:
 *   * grove_video_cid IS NULL (not yet uploaded)
 *   * Either: copyrighted + pipeline complete (clips_cropped)
 *   * Or: uncopyrighted (for copyright detection via lrclib similarity)
 * - Download via audio-download-service (/download-tiktok-video)
 * - Upload to Grove and update tiktok_videos table
 *
 * Usage:
 *   bun src/processors/upload-videos-grove.ts --limit=10
 */

import type { Env } from '../types';
import { query } from '../db/neon';

interface VideoToUpload {
  video_id: string;
  creator_username: string;
  is_copyrighted: boolean;
  pipeline_status: string | null;
  spotify_track_id: string | null;
}

const AUDIO_DOWNLOAD_SERVICE_URL = process.env.AUDIO_DOWNLOAD_SERVICE_URL || 'http://localhost:3001';

/**
 * Upload a single video to Grove via audio-download-service
 */
async function uploadVideoToGrove(video: VideoToUpload, neonDatabaseUrl: string): Promise<{
  success: boolean;
  status?: string;
  error?: string;
}> {
  try {
    // Construct TikTok share URL
    const tiktokUrl = `https://www.tiktok.com/@${video.creator_username}/video/${video.video_id}`;

    console.log(`  📥 Submitting to audio-download-service (fire-and-forget)...`);

    const response = await fetch(`${AUDIO_DOWNLOAD_SERVICE_URL}/download-tiktok-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: video.video_id,
        tiktok_url: tiktokUrl,
        neon_database_url: neonDatabaseUrl, // Service updates DB directly
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Service returned ${response.status}: ${error}`);
    }

    const result = await response.json();

    // Handle async (fire-and-forget) response
    if (result.status === 'processing' || result.status === 'already_processing') {
      console.log(`  ✅ Submitted (${result.status})`);
      console.log(`     Service will update database when complete\n`);
      return {
        success: true,
        status: result.status,
      };
    }

    // Handle synchronous completion
    if (result.success && result.grove_video_cid) {
      console.log(`  ✅ Completed synchronously`);
      console.log(`     Video: ${result.grove_video_cid}`);
      if (result.grove_thumbnail_cid) {
        console.log(`     Thumbnail: ${result.grove_thumbnail_cid}`);
      }
      console.log(`     Method: ${result.download_method}\n`);
      return {
        success: true,
        status: 'completed',
      };
    }

    throw new Error(`Unexpected response: ${JSON.stringify(result)}`);

  } catch (error: any) {
    console.error(`  ❌ Failed: ${error.message}\n`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Main processor function
 */
export async function processUploadGroveVideos(env: Env, limit = 10): Promise<void> {
  console.log('═══════════════════════════════════════════════════════');
  console.log('Step 11.5: Upload TikTok Videos to Grove');
  console.log('═══════════════════════════════════════════════════════\n');

  // Check service health
  console.log(`🔍 Checking audio-download-service at ${AUDIO_DOWNLOAD_SERVICE_URL}...`);
  try {
    const healthResponse = await fetch(`${AUDIO_DOWNLOAD_SERVICE_URL}/health`);
    if (!healthResponse.ok) {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }
    const health = await healthResponse.json();
    console.log(`✅ Service healthy (v${health.version})`);
    console.log(`   Strategies: ${health.strategies.join(', ')}\n`);
  } catch (error: any) {
    console.error(`❌ Service not available: ${error.message}`);
    console.error(`   Make sure audio-download-service is running!`);
    throw new Error('audio-download-service unavailable');
  }

  // Fetch videos needing Grove upload
  console.log(`⏳ Fetching videos (limit: ${limit})...\n`);

  const videos = await query<VideoToUpload>(`
    SELECT
      v.video_id,
      v.creator_username,
      v.is_copyrighted,
      sp.status as pipeline_status,
      sp.spotify_track_id
    FROM tiktok_videos v
    LEFT JOIN song_pipeline sp ON sp.tiktok_video_id = v.video_id
    WHERE v.grove_video_cid IS NULL
    AND (
      -- Priority 1: Copyrighted + completed pipeline (mint-ready)
      (v.is_copyrighted = TRUE AND sp.status IN ('clips_cropped', 'enhanced', 'segments_selected'))
      OR
      -- Priority 2: Uncopyrighted (check for false negatives via lrclib)
      (v.is_copyrighted = FALSE OR v.is_copyrighted IS NULL)
    )
    ORDER BY
      -- Prioritize copyrighted videos that completed pipeline
      CASE
        WHEN v.is_copyrighted = TRUE AND sp.status IS NOT NULL THEN 1
        ELSE 2
      END,
      v.video_id
    LIMIT $1
  `, [limit]);

  console.log(`✅ Found ${videos.length} video(s) to upload\n`);

  if (videos.length === 0) {
    console.log('🎉 No videos need Grove upload!');
    console.log('All eligible videos have been uploaded.\n');
    return;
  }

  // Show summary
  const copyrightedCount = videos.filter(v => v.is_copyrighted).length;
  const uncopyrightedCount = videos.filter(v => !v.is_copyrighted).length;
  console.log(`   Copyrighted (mint-ready): ${copyrightedCount}`);
  console.log(`   Uncopyrighted (check false negatives): ${uncopyrightedCount}\n`);

  // Process videos
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    console.log(`[${i + 1}/${videos.length}] ${video.video_id}`);
    console.log(`  Creator: @${video.creator_username}`);
    console.log(`  Copyright: ${video.is_copyrighted ? '✅ Copyrighted' : '❌ Uncopyrighted'}`);
    console.log(`  Pipeline: ${video.pipeline_status || 'not started'}`);
    if (video.spotify_track_id) {
      console.log(`  Track: ${video.spotify_track_id}`);
    }

    const result = await uploadVideoToGrove(video, env.NEON_DATABASE_URL);
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }

    // Rate limit: 3s between videos (respect TikTok/service)
    if (i < videos.length - 1) {
      console.log(`  ⏸️  Rate limiting (3s)...\n`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('Processing Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`   Total processed: ${videos.length}`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);

  if (failCount > 0) {
    console.log(`\n⚠️  ${failCount} upload(s) failed. They will be retried on next run.`);
  } else {
    console.log(`\n🎉 All videos uploaded successfully!`);
  }

  // Check remaining
  const remaining = await query<{ count: number }>(`
    SELECT COUNT(*) as count
    FROM tiktok_videos v
    LEFT JOIN song_pipeline sp ON sp.tiktok_video_id = v.video_id
    WHERE v.grove_video_cid IS NULL
    AND (
      (v.is_copyrighted = TRUE AND sp.status IN ('clips_cropped', 'enhanced', 'segments_selected'))
      OR (v.is_copyrighted = FALSE OR v.is_copyrighted IS NULL)
    )
  `);

  console.log(`\n📊 Remaining videos needing upload: ${remaining[0].count}`);
  console.log('');
}

// CLI execution
if (import.meta.main) {
  const args = process.argv.slice(2);
  let limit = 10;

  // Parse CLI arguments
  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1]);
    }
  }

  const env: Env = {
    DATABASE_URL: process.env.DATABASE_URL!,
    NEON_DATABASE_URL: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL!,
    AUDIO_DOWNLOAD_SERVICE_URL: process.env.AUDIO_DOWNLOAD_SERVICE_URL || 'http://localhost:3001',
  };

  processUploadGroveVideos(env, limit)
    .then(() => {
      console.log('✅ Step 11.5 complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Step 11.5 failed:', error);
      process.exit(1);
    });
}
