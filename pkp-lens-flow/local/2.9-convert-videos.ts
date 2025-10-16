#!/usr/bin/env bun
/**
 * Step 2.9: Convert Videos to H.264 + Generate HLS Segments
 *
 * Converts downloaded TikTok videos from HEVC/H.265 to H.264 using ffmpeg,
 * then segments them into HLS format for streaming playback.
 *
 * Why this is needed:
 * - TikTok videos are often encoded in HEVC/H.265
 * - Chrome doesn't support HEVC (shows black screen)
 * - H.264 is universally supported across all browsers
 * - HLS segments enable streaming playback (better UX)
 *
 * Flow:
 * 1. Convert HEVC → H.264 (browser compatibility)
 * 2. Segment H.264 → HLS (.m3u8 + .ts segments) (streaming)
 *
 * Prerequisites:
 * - Videos downloaded from crawler (data/videos/{handle}/video_*.mp4)
 * - ffmpeg installed
 *
 * Usage:
 *   bun run convert-videos --creator @charlidamelio
 *
 * Output:
 *   - Videos converted to H.264 + HLS segments
 *   - Original HEVC videos backed up with .hevc extension
 *   - Segments stored in data/videos/{handle}/segments/{postId}/
 */

import { readFile, writeFile, rename, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
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
  hls?: {
    segmented: boolean;
    segmentedAt: string;
    segmentDuration: number;
    segmentCount: number;
    playlistFile: string;
    segmentsDir: string;
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

/**
 * Segment video into HLS format
 */
async function segmentToHLS(
  inputPath: string,
  outputDir: string,
  segmentDuration: number = 4
): Promise<number> {
  return new Promise((resolve, reject) => {
    const playlistPath = path.join(outputDir, 'playlist.m3u8');

    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-c:v', 'copy',             // Don't re-encode (already H.264)
      '-c:a', 'copy',             // Don't re-encode audio
      '-start_number', '0',
      '-hls_time', segmentDuration.toString(),
      '-hls_list_size', '0',      // Include all segments in playlist
      '-f', 'hls',
      playlistPath
    ]);

    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on('close', async (code) => {
      if (code === 0) {
        // Count generated segments
        try {
          const files = await readdir(outputDir);
          const segments = files.filter(f => f.endsWith('.ts'));
          resolve(segments.length);
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error(`ffmpeg HLS segmentation failed with code ${code}: ${errorOutput}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });
  });
}

async function convertVideos(tiktokHandle: string, skipBackup: boolean = false): Promise<void> {
  console.log('\n🎬 Step 2.9: Converting Videos to H.264 + HLS Segments');
  console.log('═══════════════════════════════════════════════════════════\n');

  const cleanHandle = tiktokHandle.replace('@', '');

  // Load manifest
  const manifestPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, 'manifest.json');
  console.log(`📂 Loading manifest: ${manifestPath}`);

  const manifest: Manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
  const manifestDir = path.dirname(manifestPath);

  const videosToCheck = manifest.videos.filter(v => v.localFiles.video);
  console.log(`📹 Found ${videosToCheck.length} videos to process\n`);

  if (videosToCheck.length === 0) {
    console.log('⚠️  No videos found. Run crawler first.\n');
    return;
  }

  let converted = 0;
  let segmented = 0;
  let skipped = 0;
  let failed = 0;

  const SEGMENT_DURATION = 4; // 4 seconds per segment

  for (let i = 0; i < videosToCheck.length; i++) {
    const video = videosToCheck[i];
    const videoFilename = path.basename(video.localFiles.video!);
    const videoPath = path.join(manifestDir, videoFilename);

    console.log(`\n🎥 Video ${i + 1}/${videosToCheck.length}: ${video.postId}`);
    console.log(`   File: ${videoFilename}`);

    try {
      // Step 1: Check current codec and convert if needed
      const codec = await getVideoCodec(videoPath);
      console.log(`   Current codec: ${codec || 'unknown'}`);

      if (!codec) {
        console.log('   ⚠️  Could not detect codec, skipping');
        failed++;
        continue;
      }

      let needsConversion = codec !== 'h264';

      if (needsConversion) {
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
      } else {
        console.log('   ✅ Already H.264');
        skipped++;
      }

      // Step 2: Create HLS segments (always do this, even if already H.264)
      if (!video.hls?.segmented) {
        console.log('   📦 Creating HLS segments...');

        // Create segments directory
        const segmentsDir = path.join(manifestDir, 'segments', video.postId);
        if (!existsSync(segmentsDir)) {
          await mkdir(segmentsDir, { recursive: true });
        }

        // Segment the video
        const segmentCount = await segmentToHLS(videoPath, segmentsDir, SEGMENT_DURATION);
        console.log(`   ✅ Created ${segmentCount} segments (${SEGMENT_DURATION}s each)`);

        // Update manifest
        video.hls = {
          segmented: true,
          segmentedAt: new Date().toISOString(),
          segmentDuration: SEGMENT_DURATION,
          segmentCount,
          playlistFile: 'playlist.m3u8',
          segmentsDir: `segments/${video.postId}`,
        };

        segmented++;
      } else {
        console.log('   ✅ Already segmented');
      }

    } catch (error: any) {
      console.error(`   ❌ Processing failed: ${error.message}`);
      failed++;
    }
  }

  // Save updated manifest
  if (converted > 0 || segmented > 0) {
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('\n💾 Updated manifest with conversion & segmentation metadata');
  }

  // Final summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Processing Summary:');
  console.log(`   🔄 Converted to H.264: ${converted}`);
  console.log(`   📦 Segmented to HLS: ${segmented}`);
  console.log(`   ⏭️  Skipped (already H.264): ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📄 Total: ${videosToCheck.length}`);
  console.log('═'.repeat(60));

  if (converted > 0 || segmented > 0) {
    console.log(`\n✅ Videos processed successfully!`);
    console.log(`   - H.264 encoding: browser-compatible ✓`);
    console.log(`   - HLS segments: streaming-ready ✓`);
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
