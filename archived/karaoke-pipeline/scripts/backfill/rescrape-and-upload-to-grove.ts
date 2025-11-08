#!/usr/bin/env bun
/**
 * Re-scrape TikTok Creators and Upload Videos to Grove
 *
 * Fetches fresh video URLs by re-scraping creators, then downloads
 * and uploads videos to Grove for permanent storage.
 *
 * Usage:
 *   bun scripts/backfill/rescrape-and-upload-to-grove.ts [creator1] [creator2] ...
 *   bun scripts/backfill/rescrape-and-upload-to-grove.ts --all
 */

import { TikTokScraper } from '../../src/services/tiktok-scraper';
import { query } from '../../src/db/neon';
import { createGroveService, type GroveUploadResult } from '../../src/services/grove';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

interface CreatorToScrape {
  creator_username: string;
  video_count: number;
}

async function downloadVideo(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  writeFileSync(outputPath, buffer);

  const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  console.log(`    ✓ Downloaded ${sizeMB} MB`);
}

async function uploadToGrove(
  videoPath: string,
  videoId: string
): Promise<GroveUploadResult> {
  const groveService = createGroveService();
  const videoBuffer = require('fs').readFileSync(videoPath);
  const base64Video = videoBuffer.toString('base64');

  const result = await groveService.uploadAudio(
    base64Video,
    `tiktok-${videoId}.mp4`,
    'instrumental'
  );

  console.log(`    ✓ Uploaded: ${result.cid}`);
  return result;
}

async function processCreator(username: string): Promise<{ success: number; failed: number }> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`👤 Creator: @${username}`);
  console.log(`${'='.repeat(70)}`);

  const scraper = new TikTokScraper();
  let successCount = 0;
  let failCount = 0;

  try {
    // Step 1: Fetch profile
    console.log(`  ⏳ Fetching profile...`);
    const profile = await scraper.getUserProfile(username);

    if (!profile) {
      console.error(`  ❌ Failed to fetch profile`);
      return { success: 0, failed: 1 };
    }

    console.log(`  ✅ Profile: ${profile.nickname}`);

    // Step 2: Fetch videos (get fresh URLs!)
    console.log(`  ⏳ Fetching videos...`);
    const videos = await scraper.getUserVideos(profile.secUid);
    console.log(`  ✅ Found ${videos.length} videos`);

    // Step 3: Get videos that need Grove upload from DB
    const videosNeedingGrove = await query<{ video_id: string }>(`
      SELECT video_id
      FROM tiktok_videos
      WHERE creator_username = $1
        AND grove_video_cid IS NULL
    `, [username]);

    const videoIdsNeedingGrove = new Set(videosNeedingGrove.map(v => v.video_id));
    const videosToProcess = videos.filter(v => videoIdsNeedingGrove.has(v.id));

    console.log(`  📦 Processing ${videosToProcess.length} videos needing Grove upload`);
    console.log('');

    // Step 4: Download and upload each video
    for (let i = 0; i < videosToProcess.length; i++) {
      const video = videosToProcess[i];
      console.log(`  [${i + 1}/${videosToProcess.length}] Video: ${video.id}`);

      const tempPath = join(tmpdir(), `tiktok-${video.id}.mp4`);

      try {
        // Download
        await downloadVideo(video.video.playAddr, tempPath);

        // Upload to Grove
        const result = await uploadToGrove(tempPath, video.id);

        // Update database
        await query(`
          UPDATE tiktok_videos
          SET
            video_url = $1,
            grove_video_cid = $2,
            grove_video_url = $3,
            grove_uploaded_at = NOW(),
            updated_at = NOW()
          WHERE video_id = $4
        `, [video.video.playAddr, result.cid, result.url, video.id]);

        console.log(`    ✅ SUCCESS\n`);
        successCount++;

      } catch (error: any) {
        console.error(`    ❌ FAILED: ${error.message}\n`);
        failCount++;

      } finally {
        if (existsSync(tempPath)) {
          unlinkSync(tempPath);
        }
      }

      // Rate limit: 2s between videos
      if (i < videosToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

  } catch (error: any) {
    console.error(`  ❌ Failed to process creator: ${error.message}`);
    failCount++;
  }

  return { success: successCount, failed: failCount };
}

async function main() {
  const args = process.argv.slice(2);

  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║  Re-scrape Creators & Upload Videos to Grove                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('');

  let creatorsToProcess: string[] = [];

  if (args.includes('--all') || args.length === 0) {
    // Get all creators needing Grove upload
    const creators = await query<CreatorToScrape>(`
      SELECT DISTINCT v.creator_username, COUNT(*) as video_count
      FROM tiktok_videos v
      WHERE v.grove_video_cid IS NULL
        AND v.video_url IS NOT NULL
      GROUP BY v.creator_username
      ORDER BY video_count DESC
    `);

    creatorsToProcess = creators.map(c => c.creator_username);

    console.log(`📊 Found ${creatorsToProcess.length} creators needing Grove upload:`);
    creators.forEach((c, i) => {
      console.log(`   ${i + 1}. @${c.creator_username} (${c.video_count} videos)`);
    });
    console.log('');

  } else {
    // Process specific creators
    creatorsToProcess = args.filter(arg => !arg.startsWith('--'));
    console.log(`📊 Processing ${creatorsToProcess.length} creator(s): ${creatorsToProcess.join(', ')}`);
    console.log('');
  }

  if (creatorsToProcess.length === 0) {
    console.log('🎉 No creators need Grove upload!');
    return;
  }

  // Process each creator
  let totalSuccess = 0;
  let totalFailed = 0;

  for (const username of creatorsToProcess) {
    const { success, failed } = await processCreator(username);
    totalSuccess += success;
    totalFailed += failed;

    // Rate limit between creators
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Final summary
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║  Final Summary                                                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log(`   Creators processed: ${creatorsToProcess.length}`);
  console.log(`   ✅ Videos uploaded: ${totalSuccess}`);
  console.log(`   ❌ Videos failed: ${totalFailed}`);
  console.log('');

  if (totalFailed > 0) {
    console.log('⚠️  Some uploads failed. Check logs and retry if needed.');
  } else if (totalSuccess > 0) {
    console.log('🎉 All videos uploaded successfully!');
  }
}

main()
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
