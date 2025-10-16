#!/usr/bin/env bun
/**
 * Step 2.9: Convert Videos to H.264 for Browser Compatibility
 *
 * Converts downloaded TikTok videos from HEVC/H.265 to H.264 using ffmpeg
 * This ensures videos play correctly in Chrome and all modern browsers.
 *
 * Why this is needed:
 * - TikTok videos are often encoded in HEVC/H.265
 * - Chrome doesn't support HEVC (shows black screen)
 * - H.264 is universally supported across all browsers
 *
 * Prerequisites:
 * - Videos downloaded from crawler (data/videos/{handle}/video_*.mp4)
 * - ffmpeg installed
 *
 * Usage:
 *   bun run convert-videos --creator @charlidamelio
 *
 * Output:
 *   - Videos converted to H.264 in place
 *   - Original HEVC videos backed up with .hevc extension
 */

import { readFile, writeFile, rename } from 'fs/promises';
import { parseArgs } from 'util';
import { spawn } from 'child_process';
import path from 'path';

// Parse CLI args
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    creator: { type: 'string', short: 'c' },
    skipBackup: { type: 'boolean', default: false }, // Skip backup of original files
  },
});

interface VideoData {
  postId: string;
  localFiles: {
    video: string | null;
    thumbnail: string | null;
  };
  converted?: {
    originalCodec?: string;
    convertedAt?: string;
  };
}

interface Manifest {
  tiktokHandle: string;
  videos: VideoData[];
}

/**
 * Check video codec using ffprobe
 */
async function getVideoCodec(videoPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ]);

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim() || null);
      } else {
        resolve(null);
      }
    });

    ffprobe.on('error', () => {
      resolve(null);
    });
  });
}

/**
 * Convert video to H.264 using ffmpeg
 */
async function convertToH264(inputPath: string, outputPath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-c:v', 'libx264',         // H.264 video codec
      '-crf', '23',              // Quality (18-28, 23 is standard)
      '-preset', 'medium',       // Encoding speed vs compression
      '-profile:v', 'high',      // H.264 profile for modern devices
      '-c:a', 'aac',             // AAC audio codec
      '-b:a', '128k',            // Audio bitrate
      '-movflags', '+faststart', // Enable streaming (web playback)
      '-y',                      // Overwrite output file
      outputPath
    ]);

    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`ffmpeg failed with code ${code}: ${errorOutput}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });
  });
}

async function convertVideos(tiktokHandle: string, skipBackup: boolean = false): Promise<void> {
  console.log('\n🎬 Step 2.9: Converting Videos to H.264');
  console.log('═══════════════════════════════════════════════════\n');

  const cleanHandle = tiktokHandle.replace('@', '');

  // Load manifest
  const manifestPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, 'manifest.json');
  console.log(`📂 Loading manifest: ${manifestPath}`);

  const manifest: Manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
  const manifestDir = path.dirname(manifestPath);

  const videosToCheck = manifest.videos.filter(v => v.localFiles.video);
  console.log(`📹 Found ${videosToCheck.length} videos to check\n`);

  if (videosToCheck.length === 0) {
    console.log('⚠️  No videos found. Run crawler first.\n');
    return;
  }

  let converted = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < videosToCheck.length; i++) {
    const video = videosToCheck[i];
    const videoFilename = path.basename(video.localFiles.video!);
    const videoPath = path.join(manifestDir, videoFilename);

    console.log(`\n🎥 Video ${i + 1}/${videosToCheck.length}: ${video.postId}`);
    console.log(`   File: ${videoFilename}`);

    try {
      // Check current codec
      const codec = await getVideoCodec(videoPath);
      console.log(`   Current codec: ${codec || 'unknown'}`);

      if (!codec) {
        console.log('   ⚠️  Could not detect codec, skipping');
        failed++;
        continue;
      }

      // Skip if already H.264
      if (codec === 'h264') {
        console.log('   ✅ Already H.264, skipping conversion');
        skipped++;
        continue;
      }

      // Convert to H.264
      console.log(`   🔄 Converting ${codec} → H.264...`);
      const tempPath = videoPath + '.converting.mp4';

      await convertToH264(videoPath, tempPath);
      console.log('   ✅ Conversion complete');

      // Backup original if requested
      if (!skipBackup) {
        const backupPath = videoPath + '.hevc';
        await rename(videoPath, backupPath);
        console.log(`   💾 Original backed up: ${path.basename(backupPath)}`);
      }

      // Replace with converted version
      await rename(tempPath, videoPath);
      console.log('   ✅ Replaced with H.264 version');

      // Update manifest
      video.converted = {
        originalCodec: codec,
        convertedAt: new Date().toISOString(),
      };

      converted++;

    } catch (error: any) {
      console.error(`   ❌ Conversion failed: ${error.message}`);
      failed++;
    }
  }

  // Save updated manifest
  if (converted > 0) {
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('\n💾 Updated manifest with conversion metadata');
  }

  // Final summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Conversion Summary:');
  console.log(`   ✅ Converted: ${converted}`);
  console.log(`   ⏭️  Skipped (already H.264): ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📄 Total: ${videosToCheck.length}`);
  console.log('═'.repeat(60));

  if (converted > 0) {
    console.log(`\n✅ Videos converted to H.264!`);
    console.log(`   All modern browsers (Chrome, Firefox, Safari, Edge) will now play these videos correctly.`);
    console.log(`\n📱 Next Steps:`);
    console.log(`   1. Run encryption: bun run encrypt-videos --creator ${tiktokHandle}`);
    console.log(`   2. Upload to Grove: bun run upload-grove --creator ${tiktokHandle}\n`);
  }
}

async function main() {
  try {
    const creator = values.creator;

    if (!creator) {
      console.error('\n❌ Error: --creator argument required\n');
      console.log('Usage: bun run convert-videos --creator @charlidamelio\n');
      console.log('Options:');
      console.log('  --skip-backup    Skip backing up original HEVC files\n');
      process.exit(1);
    }

    await convertVideos(creator, values.skipBackup || false);
    console.log('✨ Done!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
