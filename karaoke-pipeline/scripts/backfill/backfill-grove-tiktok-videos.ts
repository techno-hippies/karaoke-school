#!/usr/bin/env bun
/**
 * Backfill: Upload TikTok Videos to Grove
 *
 * Downloads TikTok videos and uploads to Grove for permanent storage.
 * Prevents reliance on expiring TikTok CDN URLs.
 *
 * Usage:
 *   bun scripts/backfill/backfill-grove-tiktok-videos.ts --limit=10
 */

import { query } from '../../src/db/neon';
import { createGroveService, type GroveUploadResult } from '../../src/services/grove';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

interface VideoToUpload {
  video_id: string;
  creator_username: string;
  video_url: string;
  is_copyrighted: boolean;
  pipeline_status: string | null;
}

async function downloadVideo(url: string, outputPath: string): Promise<void> {
  console.log(`  🌐 Downloading from TikTok CDN...`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  writeFileSync(outputPath, buffer);

  const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  console.log(`  ✓ Downloaded ${sizeMB} MB`);
}

async function uploadVideoToGrove(
  videoPath: string,
  videoId: string
): Promise<GroveUploadResult> {
  console.log(`  📦 Uploading to Grove...`);

  const groveService = createGroveService();
  const videoBuffer = require('fs').readFileSync(videoPath);
  const base64Video = videoBuffer.toString('base64');

  // Upload using Grove service (it expects base64)
  const result = await groveService.uploadAudio(
    base64Video,
    `tiktok-${videoId}.mp4`,
    'instrumental' // Reusing audio method, works for video too
  );

  console.log(`  ✓ Uploaded to Grove: ${result.cid}`);
  console.log(`  📍 URL: ${result.url}`);

  return result;
}

async function updateDatabase(
  videoId: string,
  result: GroveUploadResult
): Promise<void> {
  await query(`
    UPDATE tiktok_videos
    SET
      grove_video_cid = $1,
      grove_video_url = $2,
      grove_uploaded_at = NOW()
    WHERE video_id = $3
  `, [result.cid, result.url, videoId]);

  console.log(`  ✓ Database updated`);
}

async function processVideo(video: VideoToUpload): Promise<boolean> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📹 Processing: ${video.video_id}`);
  console.log(`   Creator: @${video.creator_username}`);
  console.log(`   Copyright: ${video.is_copyrighted ? '✅' : '❌'}`);
  console.log(`   Pipeline: ${video.pipeline_status || 'not started'}`);

  const tempPath = join(tmpdir(), `tiktok-${video.video_id}.mp4`);

  try {
    // Step 1: Download video
    await downloadVideo(video.video_url, tempPath);

    // Step 2: Upload to Grove
    const result = await uploadVideoToGrove(tempPath, video.video_id);

    // Step 3: Update database
    await updateDatabase(video.video_id, result);

    console.log(`  ✅ SUCCESS`);
    return true;

  } catch (error: any) {
    console.error(`  ❌ FAILED: ${error.message}`);
    return false;

  } finally {
    // Cleanup temp file
    if (existsSync(tempPath)) {
      unlinkSync(tempPath);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  Backfill: Upload TikTok Videos to Grove                 ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  // Fetch videos needing Grove upload
  console.log(`⏳ Fetching videos (limit: ${limit})...`);

  const videos = await query<VideoToUpload>(`
    SELECT
      v.video_id,
      v.creator_username,
      v.video_url,
      v.is_copyrighted,
      sp.status as pipeline_status
    FROM tiktok_videos v
    LEFT JOIN song_pipeline sp ON sp.tiktok_video_id = v.video_id
    WHERE v.grove_video_cid IS NULL
      AND v.video_url IS NOT NULL
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
      END
    LIMIT $1
  `, [limit]);

  console.log(`✅ Found ${videos.length} videos to upload`);
  console.log('');

  if (videos.length === 0) {
    console.log('🎉 No videos need Grove upload!');
    return;
  }

  // Process videos
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    console.log(`\n[${i + 1}/${videos.length}]`);

    const success = await processVideo(video);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Rate limiting: wait 2 seconds between uploads
    if (i < videos.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Summary
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  Summary                                                  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`   Total processed: ${videos.length}`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log('');

  if (failCount > 0) {
    console.log('⚠️  Some uploads failed. Run again to retry failed videos.');
  } else {
    console.log('🎉 All videos uploaded successfully!');
  }
}

main()
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
