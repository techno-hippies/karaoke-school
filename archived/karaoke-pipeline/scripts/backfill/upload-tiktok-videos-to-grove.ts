#!/usr/bin/env bun
/**
 * Upload TikTok Videos to Grove via audio-download-service
 *
 * Uses yt-dlp through audio-download-service to download TikTok videos
 * and upload them to Grove for permanent storage.
 *
 * Usage:
 *   bun scripts/backfill/upload-tiktok-videos-to-grove.ts --limit=10
 */

import { query } from '../../src/db/neon';

interface VideoToUpload {
  video_id: string;
  creator_username: string;
  is_copyrighted: boolean;
  pipeline_status: string | null;
}

const AUDIO_DOWNLOAD_SERVICE_URL = process.env.AUDIO_DOWNLOAD_SERVICE_URL || 'http://localhost:3001';

async function uploadVideoToGrove(video: VideoToUpload): Promise<boolean> {
  try {
    // Construct TikTok share URL
    const tiktokUrl = `https://www.tiktok.com/@${video.creator_username}/video/${video.video_id}`;

    console.log(`  📥 Requesting download from audio-download-service...`);

    const response = await fetch(`${AUDIO_DOWNLOAD_SERVICE_URL}/download-tiktok-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: video.video_id,
        tiktok_url: tiktokUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Service returned ${response.status}: ${error}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Download failed');
    }

    console.log(`  ✅ Downloaded and uploaded to Grove`);
    console.log(`     CID: ${result.grove_cid}`);
    console.log(`     URL: ${result.grove_url}`);

    // Update database
    await query(`
      UPDATE tiktok_videos
      SET
        grove_video_cid = $1,
        grove_video_url = $2,
        grove_uploaded_at = NOW(),
        updated_at = NOW()
      WHERE video_id = $3
    `, [result.grove_cid, result.grove_url, video.video_id]);

    console.log(`  ✅ Database updated\n`);
    return true;

  } catch (error: any) {
    console.error(`  ❌ Failed: ${error.message}\n`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;

  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║  Upload TikTok Videos to Grove                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Check service health
  console.log(`🔍 Checking audio-download-service at ${AUDIO_DOWNLOAD_SERVICE_URL}...`);
  try {
    const healthResponse = await fetch(`${AUDIO_DOWNLOAD_SERVICE_URL}/health`);
    const health = await healthResponse.json();
    console.log(`✅ Service healthy (v${health.version})`);
    console.log(`   Strategies: ${health.strategies.join(', ')}`);
  } catch (error: any) {
    console.error(`❌ Service not available: ${error.message}`);
    console.error(`   Make sure audio-download-service is running!`);
    process.exit(1);
  }

  console.log('');

  // Fetch videos needing Grove upload
  console.log(`⏳ Fetching videos (limit: ${limit})...`);

  const videos = await query<VideoToUpload>(`
    SELECT
      v.video_id,
      v.creator_username,
      v.is_copyrighted,
      sp.status as pipeline_status
    FROM tiktok_videos v
    LEFT JOIN song_pipeline sp ON sp.tiktok_video_id = v.video_id
    WHERE v.grove_video_cid IS NULL
    AND (
      -- Priority 1: Copyrighted + completed pipeline
      (v.is_copyrighted = TRUE AND sp.status IN ('clips_cropped', 'audio_downloaded', 'translations_ready'))
      OR
      -- Priority 2: Uncopyrighted (check for false negatives)
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

  console.log(`✅ Found ${videos.length} videos to upload`);

  if (videos.length === 0) {
    console.log('🎉 No videos need Grove upload!');
    return;
  }

  console.log('');

  // Process videos
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    console.log(`[${i + 1}/${videos.length}] ${video.video_id}`);
    console.log(`  Creator: @${video.creator_username}`);
    console.log(`  Copyright: ${video.is_copyrighted ? '✅' : '❌'}`);
    console.log(`  Pipeline: ${video.pipeline_status || 'not started'}`);

    const success = await uploadVideoToGrove(video);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Rate limit: 3s between videos
    if (i < videos.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Summary
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║  Summary                                                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log(`   Total processed: ${videos.length}`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log('');

  if (failCount > 0) {
    console.log('⚠️  Some uploads failed. Run again to retry.');
  } else {
    console.log('🎉 All videos uploaded successfully!');
  }

  // Check remaining
  const remaining = await query<{ count: number }>(`
    SELECT COUNT(*) as count
    FROM tiktok_videos v
    WHERE v.grove_video_cid IS NULL
  `);

  console.log(`📊 Remaining videos: ${remaining[0].count}`);
  console.log('');
}

main()
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
