#!/usr/bin/env bun
/**
 * Creator Module 00: Unified Creator Onboarding
 *
 * Complete onboarding workflow for a new TikTok creator:
 * 1. Mint PKP (Lit Protocol wallet)
 * 2. Create Lens account with translated bio
 * 3. Scrape TikTok videos
 * 4. Identify songs via Spotify/Genius
 *
 * With checkpoint-based resume capability on failure
 *
 * Usage:
 *   bun modules/creators/00-onboard-creator.ts --tiktok-handle @idazeile
 *   bun modules/creators/00-onboard-creator.ts --tiktok-handle @idazeile --lens-handle idazeile
 *   bun modules/creators/00-onboard-creator.ts --tiktok-handle @idazeile --resume
 *   bun modules/creators/00-onboard-creator.ts --tiktok-handle @idazeile --video-limit 50
 */

import { parseArgs } from 'util';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CheckpointManager } from '../../lib/progress-tracker.js';
import { logger } from '../../lib/logger.js';

const execAsync = promisify(exec);

interface OnboardingOptions {
  tiktokHandle: string;
  lensHandle?: string;
  videoLimit?: number;
  resume: boolean;
  skipScrape?: boolean;
  skipIdentify?: boolean;
}

/**
 * Execute a shell command and handle errors
 */
async function runCommand(command: string, stepName: string): Promise<string> {
  try {
    console.log(`\n→ ${stepName}...`);
    const { stdout, stderr } = await execAsync(command);

    // Check for errors in output
    if (stdout.includes('Error:') || stderr.includes('Error:')) {
      throw new Error(`Command failed: ${stderr || stdout}`);
    }

    console.log(`✅ ${stepName} completed`);
    return stdout;
  } catch (error: any) {
    console.error(`❌ ${stepName} failed: ${error.message}`);
    throw error;
  }
}

/**
 * Main onboarding workflow
 */
async function onboardCreator(options: OnboardingOptions) {
  const { tiktokHandle, lensHandle, videoLimit, resume, skipScrape, skipIdentify } = options;

  logger.header(`Onboard Creator: @${tiktokHandle}`);

  const checkpoints = new CheckpointManager(tiktokHandle);

  try {
    // If resume flag is set, show last checkpoint
    if (resume) {
      const lastCompleted = checkpoints.getLastCompleted();
      if (lastCompleted) {
        console.log(`\n📍 Resuming from last checkpoint: '${lastCompleted}'`);
      } else {
        console.log('\n📍 No previous checkpoints found, starting from beginning');
      }
    } else {
      // Reset checkpoints if not resuming
      checkpoints.reset();
    }

    // Step 1: Mint PKP
    await checkpoints.run('pkp', async () => {
      const cmd = `bun modules/creators/01-mint-pkp.ts --tiktok-handle ${tiktokHandle}`;
      await runCommand(cmd, 'Mint PKP');
    });

    // Step 2: Scrape Videos (needed for display name and avatar)
    if (!skipScrape) {
      await checkpoints.run('scrape', async () => {
        const limitArg = videoLimit ? `--limit ${videoLimit}` : '';
        const cmd = `bun modules/creators/03-scrape-videos.ts --tiktok-handle ${tiktokHandle} ${limitArg}`;
        await runCommand(cmd, 'Scrape TikTok Videos');
      });
    } else {
      console.log('\n⊘ Skipping video scraping (--skip-scrape)');
    }

    // Step 3: Create Lens Account (uses display name from scrape)
    await checkpoints.run('lens', async () => {
      const lensArg = lensHandle ? `--lens-handle ${lensHandle}` : '';
      const cmd = `bun modules/creators/02-create-lens.ts --tiktok-handle ${tiktokHandle} ${lensArg}`;
      await runCommand(cmd, 'Create Lens Account');
    });

    // Step 4: Identify Songs (optional)
    if (!skipIdentify && !skipScrape) {
      await checkpoints.run('identify', async () => {
        const cmd = `bun modules/creators/04-identify-songs.ts --tiktok-handle ${tiktokHandle}`;
        await runCommand(cmd, 'Identify Songs');
      });
    } else if (skipScrape) {
      console.log('\n⊘ Skipping song identification (no videos scraped)');
    } else {
      console.log('\n⊘ Skipping song identification (--skip-identify)');
    }

    // Success!
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('✨ Creator Onboarding Complete!\n');
    console.log(`Creator: @${tiktokHandle}`);
    console.log(`Lens Handle: @${lensHandle || tiktokHandle.replace(/_/g, '')}`);
    console.log('\n✅ Next steps:');
    console.log(`   1. Process videos: bun modules/creators/08-process-all-videos.ts --tiktok-handle ${tiktokHandle}`);
    console.log(`   2. Or process single video: bun modules/creators/05-process-video.ts --tiktok-handle ${tiktokHandle} --video-id <ID>`);
    console.log('════════════════════════════════════════════════════════════\n');
  } catch (error: any) {
    const lastCompleted = checkpoints.getLastCompleted();

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('❌ Onboarding Failed\n');
    console.log(`Error: ${error.message}\n`);

    if (lastCompleted) {
      console.log(`Last successful checkpoint: '${lastCompleted}'`);
      console.log('\n💡 To resume from last checkpoint:');
      console.log(`   bun modules/creators/00-onboard-creator.ts --tiktok-handle ${tiktokHandle} --resume`);
    } else {
      console.log('No checkpoints completed. Please check error and try again.');
    }

    console.log('════════════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'tiktok-handle': { type: 'string' },
      'lens-handle': { type: 'string' },
      'video-limit': { type: 'string' },
      resume: { type: 'boolean', default: false },
      'skip-scrape': { type: 'boolean', default: false },
      'skip-identify': { type: 'boolean', default: false },
    },
  });

  if (!values['tiktok-handle']) {
    logger.error('Missing required parameter: --tiktok-handle');
    console.log('\nUsage:');
    console.log('  bun modules/creators/00-onboard-creator.ts --tiktok-handle @idazeile');
    console.log('  bun modules/creators/00-onboard-creator.ts --tiktok-handle @idazeile --lens-handle idazeile');
    console.log('  bun modules/creators/00-onboard-creator.ts --tiktok-handle @idazeile --resume');
    console.log('  bun modules/creators/00-onboard-creator.ts --tiktok-handle @idazeile --video-limit 50\n');
    console.log('Options:');
    console.log('  --tiktok-handle   TikTok username (with or without @)');
    console.log('  --lens-handle     Custom Lens handle (defaults to TikTok handle)');
    console.log('  --video-limit     Limit number of videos to scrape');
    console.log('  --resume          Resume from last checkpoint on failure');
    console.log('  --skip-scrape     Skip video scraping step');
    console.log('  --skip-identify   Skip song identification step\n');
    process.exit(1);
  }

  const tiktokHandle = values['tiktok-handle']!.replace('@', '');
  const lensHandle = values['lens-handle'];
  const videoLimit = values['video-limit'] ? parseInt(values['video-limit']) : undefined;
  const resume = values.resume || false;
  const skipScrape = values['skip-scrape'] || false;
  const skipIdentify = values['skip-identify'] || false;

  await onboardCreator({
    tiktokHandle,
    lensHandle,
    videoLimit,
    resume,
    skipScrape,
    skipIdentify,
  });
}

main();
