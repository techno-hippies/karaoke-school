#!/usr/bin/env bun
/**
 * Creator Module 08: Process All Videos (Batch)
 *
 * Processes all identified videos for a creator in batch:
 * - Downloads videos
 * - Uploads to Grove
 * - Creates manifests
 * - Optionally mints on Story Protocol
 * - Optionally posts to Lens
 *
 * Usage:
 *   bun modules/creators/08-process-all-videos.ts --tiktok-handle swiftysavvy
 *   bun modules/creators/08-process-all-videos.ts --tiktok-handle swiftysavvy --max 10
 */

import { parseArgs } from 'util';
import { exec } from 'child_process';
import { promisify } from 'util';
import { paths } from '../../lib/config.js';
import { readJson } from '../../lib/fs.js';
import { logger } from '../../lib/logger.js';

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

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'tiktok-handle': { type: 'string' },
      max: { type: 'string' },
      'skip-story': { type: 'boolean', default: false },
      'skip-lens': { type: 'boolean', default: false },
    },
  });

  if (!values['tiktok-handle']) {
    logger.error('Missing required parameter: --tiktok-handle');
    console.log('\nUsage:');
    console.log('  bun modules/creators/08-process-all-videos.ts --tiktok-handle swiftysavvy');
    console.log('  bun modules/creators/08-process-all-videos.ts --tiktok-handle swiftysavvy --max 10\n');
    process.exit(1);
  }

  const tiktokHandle = values['tiktok-handle']!.replace('@', '');
  const maxVideos = values.max ? parseInt(values.max) : undefined;
  const skipStory = values['skip-story'];
  const skipLens = values['skip-lens'];

  logger.header(`Process All Videos: @${tiktokHandle}`);

  try {
    // Load identified videos
    const videosDir = paths.creator(tiktokHandle);
    const identifiedPath = `${videosDir}/identified_videos.json`;
    const identifiedData = readJson<IdentifiedVideosData>(identifiedPath);

    const allVideos = [
      ...identifiedData.copyrighted,
      ...identifiedData.copyright_free,
    ];

    const toProcess = maxVideos ? allVideos.slice(0, maxVideos) : allVideos;

    logger.info(`Total videos: ${allVideos.length}`);
    logger.info(`Processing: ${toProcess.length}`);

    console.log('\n🎬 Processing videos...\n');

    let processed = 0;
    let failed = 0;

    for (let i = 0; i < toProcess.length; i++) {
      const video = toProcess[i];
      const title = video.identification?.title || 'Unknown';
      const artist = video.identification?.artist || 'Unknown';

      console.log(`\n[${i + 1}/${toProcess.length}] Video ${video.id}`);
      console.log(`  Song: ${title} by ${artist}`);

      try {
        // Step 1: Process video (download, Grove upload, manifest)
        const processCmd = `bun modules/creators/05-process-video.ts --tiktok-handle ${tiktokHandle} --video-id ${video.id}`;
        console.log(`  → Processing...`);
        const { stdout } = await execAsync(processCmd);

        // Check for errors in output
        if (stdout.includes('Error') || stdout.includes('Failed')) {
          throw new Error('Processing failed - check logs');
        }

        processed++;
        console.log(`  ✓ Processed successfully`);

        // Extract video hash from stdout
        const videoHashMatch = stdout.match(/Video Hash: ([a-f0-9]+)/);
        const videoHash = videoHashMatch ? videoHashMatch[1] : null;

        // Optional: Story Protocol minting
        if (!skipStory && videoHash) {
          console.log(`  → Minting on Story Protocol...`);
          try {
            const mintCmd = `bun modules/creators/06-mint-derivative.ts --tiktok-handle ${tiktokHandle} --video-hash ${videoHash}`;
            const { stdout: mintOutput } = await execAsync(mintCmd);

            if (mintOutput.includes('Error') || mintOutput.includes('Failed')) {
              throw new Error('Story Protocol minting failed');
            }

            console.log(`  ✓ Minted as IP Asset`);
          } catch (error: any) {
            console.log(`  ⊘ Story Protocol minting failed: ${error.message}`);
          }
        }

        // Optional: Lens posting
        if (!skipLens && videoHash) {
          console.log(`  → Posting to Lens...`);
          try {
            const lensCmd = `bun modules/creators/07-post-lens.ts --tiktok-handle ${tiktokHandle} --video-hash ${videoHash}`;
            const { stdout: lensOutput } = await execAsync(lensCmd);

            if (lensOutput.includes('Error') || lensOutput.includes('Failed')) {
              throw new Error('Lens posting failed');
            }

            console.log(`  ✓ Posted to Lens`);
          } catch (error: any) {
            console.log(`  ⊘ Lens posting failed: ${error.message}`);
          }
        }

      } catch (error: any) {
        failed++;
        console.log(`  ✗ Failed: ${error.message}`);
      }

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('✨ Batch Processing Complete!\n');
    console.log('Summary:');
    console.log(`  • Total videos: ${toProcess.length}`);
    console.log(`  • Processed: ${processed}`);
    console.log(`  • Failed: ${failed}`);
    console.log(`  • Success rate: ${((processed / toProcess.length) * 100).toFixed(1)}%\n`);

  } catch (error: any) {
    logger.error(`Failed to process videos: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
