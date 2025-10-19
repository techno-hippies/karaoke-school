#!/usr/bin/env bun
/**
 * Video Addition Pipeline
 *
 * Selective video processing with automatic karaoke song preparation.
 * Run this for each video you want to add to an artist's profile.
 *
 * Usage:
 *   bun run scripts/pipeline-video.ts --artist beyonce --post-id 7420654552413687071
 *   bun run scripts/pipeline-video.ts --artist taylorswift --post-id 7159048978569497902
 *
 * Prerequisites:
 *   - Artist created via pipeline-artist.ts
 *   - Video downloaded in data/videos/{artist}/video_{n}_{postId}.mp4
 *   - Manifest entry exists for video
 *
 * Steps:
 *   9.  Transcribe audio
 *   10. Translate transcription
 *   12. Upload video to Grove
 *   13. Fetch ISRC (Spotify metadata)
 *   14. Map Spotify→Genius song ID
 *   15. Fetch MLC licensing metadata
 *   16. Reupload metadata to Grove
 *   17. Mint Story IP asset
 *   18. Create Lens post (video appears in feed)
 *   20. Process karaoke song (match-segment + demucs + alignment + contract)
 *
 * Output:
 *   - Video appears in artist's Lens feed
 *   - Song ready for karaoke in KaraokeCatalogV2
 *   - Clickable in TikTok-like feed → karaoke mode
 */

import { parseArgs } from 'util';
import { spawn } from 'child_process';
import path from 'path';
import { readFile } from 'fs/promises';

// Color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

interface VideoOptions {
  artist: string;
  postId: string;
}

interface StepDefinition {
  num: number;
  name: string;
  script: string;
  requiresEnv?: boolean;
  args?: (opts: VideoOptions) => string[];
}

const STEPS: StepDefinition[] = [
  {
    num: 9,
    name: 'Transcribe Audio',
    script: 'local/09-transcribe-audio.ts',
    requiresEnv: true,
    args: (opts) => ['--creator', `@${opts.artist}`, '--post-id', opts.postId],
  },
  {
    num: 10,
    name: 'Translate Transcription',
    script: 'local/10-translate-transcriptions.ts',
    requiresEnv: true,
    args: (opts) => ['--creator', `@${opts.artist}`, '--post-id', opts.postId],
  },
  {
    num: 12,
    name: 'Upload to Grove',
    script: 'local/12-upload-grove.ts',
    requiresEnv: false,
    args: (opts) => ['--creator', `@${opts.artist}`, '--post-id', opts.postId],
  },
  {
    num: 13,
    name: 'Fetch ISRC',
    script: 'local/13-fetch-isrc.ts',
    requiresEnv: true,
    args: (opts) => ['--creator', `@${opts.artist}`, '--post-id', opts.postId],
  },
  {
    num: 14,
    name: 'Map Spotify→Genius',
    script: 'local/14-map-spotify-genius.ts',
    requiresEnv: false,
    args: (opts) => ['--creator', `@${opts.artist}`, '--post-id', opts.postId],
  },
  {
    num: 15,
    name: 'Fetch MLC',
    script: 'local/15-fetch-mlc.ts',
    requiresEnv: false,
    args: (opts) => ['--creator', `@${opts.artist}`, '--post-id', opts.postId],
  },
  {
    num: 16,
    name: 'Reupload Metadata',
    script: 'local/16-reupload-metadata.ts',
    requiresEnv: false,
    args: (opts) => ['--creator', `@${opts.artist}`, '--post-id', opts.postId],
  },
  {
    num: 17,
    name: 'Mint Story IP',
    script: 'local/17-mint-story-ip-assets.ts',
    requiresEnv: true,
    args: (opts) => ['--creator', `@${opts.artist}`, '--post-id', opts.postId],
  },
  {
    num: 18,
    name: 'Create Lens Post',
    script: 'local/18-create-lens-posts.ts',
    requiresEnv: true,
    args: (opts) => ['--creator', `@${opts.artist}`, '--post-id', opts.postId],
  },
  {
    num: 20,
    name: 'Process Karaoke Song',
    script: 'local/20-process-karaoke-song.ts',
    requiresEnv: true,
    args: (opts) => ['--creator', `@${opts.artist}`, '--post-id', opts.postId],
  },
];

async function runStep(step: StepDefinition, options: VideoOptions): Promise<void> {
  const scriptPath = path.join(process.cwd(), step.script);
  const stepArgs = step.args ? step.args(options) : ['--creator', `@${options.artist}`, '--post-id', options.postId];

  const command = 'bun';
  const args = step.requiresEnv
    ? ['dotenvx', 'run', '--', 'bun', 'run', scriptPath, ...stepArgs]
    : ['run', scriptPath, ...stepArgs];

  console.log(`${colors.cyan}▶  Step ${step.num}: ${step.name}${colors.reset}`);

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    proc.on('exit', (code) => {
      if (code === 0) {
        console.log(`${colors.green}✓  Step ${step.num}: ${step.name} - Complete${colors.reset}\n`);
        resolve();
      } else {
        reject(new Error(`Step ${step.num} (${step.name}) failed with code ${code}`));
      }
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}

async function validateVideo(options: VideoOptions): Promise<void> {
  const manifestPath = path.join(
    process.cwd(),
    'data',
    'videos',
    options.artist,
    'manifest.json'
  );

  try {
    const manifestData = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestData);

    const video = manifest.videos?.find((v: any) => v.postId === options.postId);
    if (!video) {
      throw new Error(`Video ${options.postId} not found in manifest for @${options.artist}`);
    }

    console.log(`${colors.green}✓ Found video: ${video.music?.title || 'Unknown'}${colors.reset}`);
    if (video.music?.genius?.id) {
      console.log(`${colors.green}✓ Genius ID: ${video.music.genius.id}${colors.reset}`);
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Artist @${options.artist} not found. Run pipeline-artist.ts first.`);
    }
    throw error;
  }
}

async function runVideoPipeline(options: VideoOptions): Promise<void> {
  const startTime = Date.now();

  console.log(`\n${colors.bright}${colors.blue}╔═══════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}║     Video Addition Pipeline               ║${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}╚═══════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`${colors.bright}Artist: @${options.artist}${colors.reset}`);
  console.log(`${colors.bright}Post ID: ${options.postId}${colors.reset}\n`);

  // Validate video exists
  await validateVideo(options);
  console.log();

  // Run all steps sequentially
  for (const step of STEPS) {
    await runStep(step, options);
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  console.log(`${colors.bright}${colors.green}✨ Video processing complete! (${duration} minutes)${colors.reset}`);
  console.log(`${colors.bright}${colors.green}Video now appears in feed and karaoke is ready!${colors.reset}\n`);
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      artist: { type: 'string' },
      'post-id': { type: 'string' },
    },
  });

  if (!values.artist || !values['post-id']) {
    console.error(`\n${colors.red}❌ Error: Missing required parameters${colors.reset}\n`);
    console.log('Usage:');
    console.log('  bun run scripts/pipeline-video.ts --artist beyonce --post-id 7420654552413687071');
    console.log('  bun run scripts/pipeline-video.ts --artist taylorswift --post-id 7159048978569497902\n');
    process.exit(1);
  }

  const options: VideoOptions = {
    artist: values.artist,
    postId: values['post-id'],
  };

  try {
    await runVideoPipeline(options);
  } catch (error: any) {
    console.error(`\n${colors.red}❌ Pipeline failed: ${error.message}${colors.reset}\n`);
    process.exit(1);
  }
}

main();
