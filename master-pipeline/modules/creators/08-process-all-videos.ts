#!/usr/bin/env bun
/**
 * Creator Module 08: Process All Videos (Batch)
 *
 * Processes all identified videos for a creator in batch:
 * - Downloads videos
 * - Uploads to Grove
 * - Creates manifests with translations
 * - Optionally mints on Story Protocol
 * - Optionally posts to Lens
 *
 * Features:
 * - Progress tracking with resume capability
 * - Automatic retry on failure (configurable)
 * - Parallel processing (configurable concurrency)
 * - Detailed error logging
 * - Summary report generation
 *
 * Usage:
 *   bun modules/creators/08-process-all-videos.ts --tiktok-handle swiftysavvy
 *   bun modules/creators/08-process-all-videos.ts --tiktok-handle swiftysavvy --max 10
 *   bun modules/creators/08-process-all-videos.ts --tiktok-handle swiftysavvy --resume
 *   bun modules/creators/08-process-all-videos.ts --tiktok-handle swiftysavvy --parallel 3
 *   bun modules/creators/08-process-all-videos.ts --tiktok-handle swiftysavvy --retry-failed
 */

import { parseArgs } from 'util';
import { exec } from 'child_process';
import { promisify } from 'util';
import { paths } from '../../lib/config.js';
import { readJson } from '../../lib/fs.js';
import { logger } from '../../lib/logger.js';
import { ProgressTracker } from '../../lib/progress-tracker.js';

const execAsync = promisify(exec);

interface IdentifiedVideo {
  id: string;
  identification?: {
    title: string;
    artist: string;
    spotifyId?: string;
  };
}

interface IdentifiedVideosData {
  copyrighted: IdentifiedVideo[];
  copyright_free: IdentifiedVideo[];
}

interface ProcessingOptions {
  tiktokHandle: string;
  maxVideos?: number;
  copyrightedOnly: boolean;
  skipStory: boolean;
  skipLens: boolean;
  resume: boolean;
  retryFailed: boolean;
  parallel: number;
  maxRetries: number;
  rateLimit: number;
}

/**
 * Process a single video with retry logic
 */
async function processVideo(
  tiktokHandle: string,
  videoId: string,
  videoTitle: string,
  videoArtist: string,
  tracker: ProgressTracker,
  options: ProcessingOptions
): Promise<boolean> {
  const { skipStory, skipLens } = options;

  try {
    tracker.markStarted(videoId);

    // Use the complete video upload flow workflow orchestrator
    // This handles: process video → register song → process segment → post to Lens
    const skipFlags = [
      skipStory ? '--skip-segment' : '', // Story minting handled separately
      skipLens ? '--skip-lens' : '',
    ].filter(Boolean).join(' ');

    const flowCmd = `bun modules/creators/09-video-upload-flow.ts --tiktok-handle ${tiktokHandle} --video-id ${videoId} ${skipFlags}`;
    const { stdout } = await execAsync(flowCmd);

    // Check for errors
    if (stdout.includes('❌') || stdout.includes('failed')) {
      throw new Error('Video upload flow failed - check logs');
    }

    tracker.updateStep(videoId, 'download', true);
    tracker.updateStep(videoId, 'grove', true);

    // Extract video hash from stdout
    const videoHashMatch = stdout.match(/Video Hash: ([a-f0-9]+)/);
    const videoHash = videoHashMatch ? videoHashMatch[1] : null;

    if (!videoHash) {
      throw new Error('Could not extract video hash from output');
    }

    // Mark lens as complete if not skipped (handled by upload flow)
    if (!skipLens) {
      tracker.updateStep(videoId, 'lens', true);
    }

    // Optional: Story Protocol minting (separate from segment processing)
    if (!skipStory) {
      try {
        const mintCmd = `bun modules/creators/06-mint-derivative.ts --tiktok-handle ${tiktokHandle} --video-hash ${videoHash}`;
        const { stdout: mintOutput } = await execAsync(mintCmd);

        if (mintOutput.includes('Error') || mintOutput.includes('Failed')) {
          console.log(`  ⚠️  Story Protocol minting failed (non-fatal)`);
        } else {
          tracker.updateStep(videoId, 'story', true);
        }
      } catch (error: any) {
        console.log(`  ⚠️  Story Protocol minting failed: ${error.message} (non-fatal)`);
      }
    }

    tracker.markCompleted(videoId, videoHash);
    return true;
  } catch (error: any) {
    tracker.markFailed(videoId, error, options.maxRetries);
    throw error;
  }
}

/**
 * Process videos with concurrency control
 */
async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  processor: (item: T, index: number) => Promise<void>
): Promise<void> {
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const promise = processor(items[i], i).then(() => {
      executing.splice(executing.indexOf(promise), 1);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'tiktok-handle': { type: 'string' },
      max: { type: 'string' },
      'copyrighted-only': { type: 'boolean', default: false },
      'skip-story': { type: 'boolean', default: false },
      'skip-lens': { type: 'boolean', default: false },
      resume: { type: 'boolean', default: false },
      'retry-failed': { type: 'boolean', default: false },
      parallel: { type: 'string', default: '1' },
      'max-retries': { type: 'string', default: '3' },
      'rate-limit': { type: 'string', default: '2000' },
    },
  });

  if (!values['tiktok-handle']) {
    logger.error('Missing required parameter: --tiktok-handle');
    console.log('\nUsage:');
    console.log('  bun modules/creators/08-process-all-videos.ts --tiktok-handle swiftysavvy');
    console.log('  bun modules/creators/08-process-all-videos.ts --tiktok-handle swiftysavvy --max 10');
    console.log('  bun modules/creators/08-process-all-videos.ts --tiktok-handle swiftysavvy --resume');
    console.log('  bun modules/creators/08-process-all-videos.ts --tiktok-handle swiftysavvy --parallel 3\n');
    console.log('Options:');
    console.log('  --tiktok-handle      TikTok username (with or without @)');
    console.log('  --max                Maximum number of videos to process');
    console.log('  --copyrighted-only   Only process copyrighted videos (safety flag)');
    console.log('  --resume             Resume from last successful video');
    console.log('  --retry-failed       Retry previously failed videos');
    console.log('  --parallel N         Process N videos concurrently (default: 1)');
    console.log('  --max-retries N      Maximum retry attempts per video (default: 3)');
    console.log('  --rate-limit MS      Delay between videos in ms (default: 2000)');
    console.log('  --skip-story         Skip Story Protocol minting');
    console.log('  --skip-lens          Skip Lens posting\n');
    process.exit(1);
  }

  const tiktokHandle = values['tiktok-handle']!.replace('@', '');
  const maxVideos = values.max ? parseInt(values.max) : undefined;
  const copyrightedOnly = values['copyrighted-only'] || false;
  const skipStory = values['skip-story'] || false;
  const skipLens = values['skip-lens'] || false;
  const resume = values.resume || false;
  const retryFailed = values['retry-failed'] || false;
  const parallel = parseInt(values.parallel as string);
  const maxRetries = parseInt(values['max-retries'] as string);
  const rateLimit = parseInt(values['rate-limit'] as string);

  const options: ProcessingOptions = {
    tiktokHandle,
    maxVideos,
    copyrightedOnly,
    skipStory,
    skipLens,
    resume,
    retryFailed,
    parallel,
    maxRetries,
    rateLimit,
  };

  logger.header(`Process All Videos: @${tiktokHandle}`);

  try {
    // Initialize progress tracker
    const tracker = new ProgressTracker(tiktokHandle);

    // Load identified videos
    const videosDir = paths.creator(tiktokHandle);
    const identifiedPath = `${videosDir}/identified_videos.json`;
    const identifiedData = readJson<IdentifiedVideosData>(identifiedPath);

    const allVideos = copyrightedOnly
      ? identifiedData.copyrighted
      : [
          ...identifiedData.copyrighted,
          ...identifiedData.copyright_free,
        ];

    // Initialize progress tracking for all videos
    const allVideoIds = allVideos.map((v) => v.id);
    tracker.initializeVideos(allVideoIds);

    // Determine which videos to process
    let toProcess: IdentifiedVideo[] = [];

    if (retryFailed) {
      // Retry only failed videos
      const failedVideoIds = tracker.getFailedVideos().map((v) => v.videoId);
      toProcess = allVideos.filter((v) => failedVideoIds.includes(v.id));
      console.log(`\n📍 Retrying ${toProcess.length} failed videos`);
    } else if (resume) {
      // Resume from pending/failed videos
      const resumableVideoIds = tracker.getResumableVideos(maxRetries).map((v) => v.videoId);
      toProcess = allVideos.filter((v) => resumableVideoIds.includes(v.id));
      console.log(`\n📍 Resuming: ${toProcess.length} videos remaining`);
    } else {
      // Process all or limited number
      toProcess = maxVideos ? allVideos.slice(0, maxVideos) : allVideos;
    }

    logger.info(`Total videos: ${allVideos.length}`);
    logger.info(`To process: ${toProcess.length}`);
    logger.info(`Parallel: ${parallel}`);
    logger.info(`Max retries: ${maxRetries}`);
    logger.info(`Rate limit: ${rateLimit}ms`);

    const stats = tracker.getStats();
    console.log(`\n📊 Current progress: ${stats.completed} completed, ${stats.failed} failed, ${stats.skipped} skipped\n`);

    // Auto-create artists before processing videos
    console.log('🎨 Checking and auto-creating artists...\n');

    // Extract unique artists from videos to be processed
    interface UniqueArtist {
      geniusId: number;
      name: string;
    }

    const uniqueArtists = new Map<number, UniqueArtist>();

    for (const video of toProcess) {
      const geniusId = video.identification?.geniusId;
      const artistName = video.identification?.artist;

      if (geniusId && artistName) {
        if (!uniqueArtists.has(geniusId)) {
          uniqueArtists.set(geniusId, { geniusId, name: artistName });
        }
      }
    }

    console.log(`Found ${uniqueArtists.size} unique artists to verify`);

    // Auto-create each artist if needed
    for (const [geniusId, artist] of uniqueArtists) {
      console.log(`\n→ Checking artist: ${artist.name} (Genius ID: ${geniusId})`);

      try {
        const autoCreateCmd = `bun modules/creators/10-auto-create-artist.ts --genius-id ${geniusId} --genius-artist-name "${artist.name}"`;
        const { stdout } = await execAsync(autoCreateCmd);

        if (stdout.includes('already exists')) {
          console.log(`  ✓ Artist already registered`);
        } else if (stdout.includes('auto-creation complete')) {
          console.log(`  ✓ Artist created successfully`);
        } else {
          console.log(`  ✓ Artist check complete`);
        }
      } catch (error: any) {
        console.log(`  ⚠️  Artist auto-creation warning: ${error.message}`);
        console.log(`  ℹ️  Will continue with video processing anyway`);
      }
    }

    console.log('\n✅ Artist verification complete\n');

    console.log('🎬 Processing videos...\n');

    // Process videos with concurrency control
    await processWithConcurrency(
      toProcess,
      parallel,
      async (video, index) => {
        const title = video.identification?.title || 'Unknown';
        const artist = video.identification?.artist || 'Unknown';

        console.log(`\n[${index + 1}/${toProcess.length}] Video ${video.id}`);
        console.log(`  Song: ${title} by ${artist}`);

        try {
          await processVideo(tiktokHandle, video.id, title, artist, tracker, options);
          console.log(`  ✅ Completed successfully`);
        } catch (error: any) {
          console.log(`  ❌ Failed: ${error.message}`);
        }

        // Rate limiting between videos
        if (index < toProcess.length - 1 && rateLimit > 0) {
          await new Promise((resolve) => setTimeout(resolve, rateLimit));
        }
      }
    );

    // Generate and display final report
    const report = tracker.generateReport();
    console.log(report);

    const finalStats = tracker.getStats();
    if (parseInt(finalStats.successRate) < 100) {
      console.log('💡 To retry failed videos:');
      console.log(`   bun modules/creators/08-process-all-videos.ts --tiktok-handle ${tiktokHandle} --retry-failed\n`);
    }
  } catch (error: any) {
    logger.error(`Failed to process videos: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
