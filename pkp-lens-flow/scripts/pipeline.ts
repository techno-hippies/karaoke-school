#!/usr/bin/env bun
/**
 * Full Pipeline Orchestrator
 *
 * Runs the complete pipeline for one or more creators with smart parallelization
 *
 * Usage:
 *   bun run pipeline --creator @billieeilish
 *   bun run pipeline --creators @billieeilish,@taylorswift,@selenagomez
 *   bun run pipeline --creator @billieeilish --start-at 9 --stop-at 12
 *   bun run pipeline --creators @a,@b --concurrency 2
 */

import { parseArgs } from 'util';
import { spawn } from 'child_process';
import path from 'path';

// Color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

interface PipelineOptions {
  creators: string[];
  geniusIds?: Record<string, number>;
  handles?: Record<string, string>;
  startAt?: number;
  stopAt?: number;
  concurrency?: number;
}

interface StepDefinition {
  num: number;
  name: string;
  script: string;
  requiresEnv?: boolean;
  manual?: boolean;
}

// Pipeline steps
const STEPS: StepDefinition[] = [
  { num: 1, name: 'Mint PKP', script: 'local/01-mint-pkp.ts', requiresEnv: true },
  { num: 2, name: 'Crawl TikTok', script: 'services/crawler/tiktok_crawler.py', requiresEnv: false },
  { num: 3, name: 'Convert Videos', script: 'local/03-convert-videos.ts', requiresEnv: false },
  { num: 4, name: 'Upload Avatar', script: 'local/04-upload-profile-avatar.ts', requiresEnv: true },
  { num: 5, name: 'Add Genius ID', script: 'local/05-add-genius-id.ts', requiresEnv: false },
  { num: 6, name: 'Create Lens Account', script: 'local/06-create-lens-account.ts', requiresEnv: true },
  { num: 7, name: 'Create Username', script: 'local/07-create-username.ts', requiresEnv: true },
  { num: 8, name: 'Deploy Lock', script: 'local/08-deploy-lock.ts', requiresEnv: true },
  { num: 9, name: 'Transcribe Audio', script: 'local/09-transcribe-audio.ts', requiresEnv: true },
  { num: 10, name: 'Translate', script: 'local/10-translate-transcriptions.ts', requiresEnv: true },
  { num: 11, name: 'Encrypt Videos', script: 'local/11-encrypt-videos.ts', requiresEnv: false },
  { num: 12, name: 'Upload Grove', script: 'local/12-upload-grove.ts', requiresEnv: false },
  { num: 13, name: 'Fetch ISRC', script: 'local/13-fetch-isrc.ts', requiresEnv: true },
  { num: 14, name: 'Map Spotify→Genius', script: 'local/14-map-spotify-genius.ts', requiresEnv: false },
  { num: 15, name: 'Fetch MLC', script: 'local/15-fetch-mlc.ts', requiresEnv: false },
  { num: 16, name: 'Reupload Metadata', script: 'local/16-reupload-metadata.ts', requiresEnv: false },
  { num: 17, name: 'Mint Story IP', script: 'local/17-mint-story-ip-assets.ts', requiresEnv: true },
  { num: 18, name: 'Create Lens Posts', script: 'local/18-create-lens-posts.ts', requiresEnv: true },
  { num: 19, name: 'Generate Artist Mapping', script: 'scripts/19-generate-artist-mapping.ts', requiresEnv: false },
];

async function runStep(step: StepDefinition, creator: string, options: PipelineOptions): Promise<void> {
  if (step.manual) {
    console.log(`${colors.yellow}⚠️  Step ${step.num}: ${step.name} - MANUAL STEP (skipped)${colors.reset}`);
    return;
  }

  const isPython = step.script.endsWith('.py');
  const command = isPython ? 'python3' : 'bun';
  const scriptPath = path.join(process.cwd(), step.script);

  let args: string[];
  if (isPython) {
    // TikTok crawler
    args = [scriptPath, '--creator', creator, '--copyrighted', '3', '--copyright-free', '3'];
  } else if (step.num === 5) {
    // Add Genius ID - requires genius-id parameter
    const geniusId = options.geniusIds?.[creator];
    if (!geniusId) {
      console.log(`${colors.yellow}⚠️  Step ${step.num}: ${step.name} - No Genius ID provided (skipped)${colors.reset}`);
      return;
    }
    args = ['run', scriptPath, '--creator', creator, '--genius-id', geniusId.toString()];
  } else if (step.num === 7) {
    // Create Username - requires both creator and username
    const username = options.handles?.[creator] || creator.replace('@', '');
    args = step.requiresEnv
      ? ['dotenvx', 'run', '--', 'bun', 'run', scriptPath, '--creator', creator, '--username', username]
      : ['run', scriptPath, '--creator', creator, '--username', username];
  } else {
    args = step.requiresEnv
      ? ['dotenvx', 'run', '--', 'bun', 'run', scriptPath, '--creator', creator]
      : ['run', scriptPath, '--creator', creator];
  }

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

async function runCreatorPipeline(creator: string, options: PipelineOptions): Promise<void> {
  const startStep = options.startAt || 1;
  const stopStep = options.stopAt || 19;

  console.log(`\n${colors.bright}${colors.blue}═══════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  Creator: ${creator}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  Steps: ${startStep}-${stopStep}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════${colors.reset}\n`);

  const steps = STEPS.filter(s => s.num >= startStep && s.num <= stopStep);

  // CHECKPOINT 1: Steps 1-2 (sequential)
  for (const step of steps.filter(s => s.num <= 2)) {
    await runStep(step, creator, options);
  }

  // CHECKPOINT 2: Steps 3-8 (sequential - they all modify manifest)
  const checkpoint2Steps = steps.filter(s => s.num >= 3 && s.num <= 8);
  if (checkpoint2Steps.length > 0) {
    // All steps must run sequentially to avoid manifest write race conditions
    for (const step of checkpoint2Steps) {
      await runStep(step, creator, options);
    }
  }

  // CHECKPOINT 3: Steps 9-16 (two parallel chains)
  const checkpoint3Steps = steps.filter(s => s.num >= 9 && s.num <= 16);
  if (checkpoint3Steps.length > 0) {
    await Promise.all([
      // Chain A: Video processing (9 → 10 → 11 → 12)
      (async () => {
        for (const step of checkpoint3Steps.filter(s => s.num >= 9 && s.num <= 12)) {
          await runStep(step, creator, options);
        }
      })(),

      // Chain B: Metadata enrichment (13 → 14 → 15 → 16)
      (async () => {
        const chainBSteps = checkpoint3Steps.filter(s => s.num >= 13);
        if (chainBSteps.length === 0) return;

        // Steps 13-16 sequential (all modify manifest)
        for (const step of chainBSteps) {
          await runStep(step, creator, options);
        }
      })()
    ]);
  }

  // CHECKPOINT 4: Steps 17-19 (sequential)
  for (const step of steps.filter(s => s.num >= 17)) {
    await runStep(step, creator, options);
  }

  console.log(`${colors.bright}${colors.green}✨ Creator ${creator} - Pipeline Complete!${colors.reset}\n`);
}

async function runPipeline(options: PipelineOptions): Promise<void> {
  const startTime = Date.now();

  console.log(`\n${colors.bright}${colors.blue}╔═══════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}║     PKP-Lens Pipeline Orchestrator       ║${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}╚═══════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`${colors.bright}Creators: ${options.creators.join(', ')}${colors.reset}`);
  console.log(`${colors.bright}Concurrency: ${options.concurrency || 'unlimited'}${colors.reset}\n`);

  // Run creators in parallel (with optional concurrency limit)
  if (options.concurrency) {
    // Run with concurrency limit
    const results: Promise<void>[] = [];
    for (let i = 0; i < options.creators.length; i += options.concurrency) {
      const batch = options.creators.slice(i, i + options.concurrency);
      await Promise.all(batch.map(creator => runCreatorPipeline(creator, options)));
    }
  } else {
    // Run all in parallel
    await Promise.all(
      options.creators.map(creator => runCreatorPipeline(creator, options))
    );
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  console.log(`${colors.bright}${colors.green}🎉 All creators complete! (${duration} minutes)${colors.reset}\n`);
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      creator: { type: 'string' },
      creators: { type: 'string' },
      'genius-id': { type: 'string' },
      'genius-ids': { type: 'string' },
      handle: { type: 'string' },
      handles: { type: 'string' },
      'start-at': { type: 'string' },
      'stop-at': { type: 'string' },
      concurrency: { type: 'string' },
    },
  });

  // Parse creators
  let creators: string[] = [];
  if (values.creator) {
    creators = [values.creator];
  } else if (values.creators) {
    creators = values.creators.split(',').map(c => c.trim());
  } else {
    console.error(`\n${colors.red}❌ Error: --creator or --creators required${colors.reset}\n`);
    console.log('Usage:');
    console.log('  bun run pipeline --creator @madisonbeer --genius-id 154127 --handle madison');
    console.log('  bun run pipeline --creators @a,@b --genius-ids "a:123,b:456" --handles "@a:handlea,@b:handleb"');
    console.log('  bun run pipeline --creator @handle --start-at 9 --stop-at 12');
    console.log('  bun run pipeline --creators @a,@b --concurrency 1\n');
    process.exit(1);
  }

  // Parse genius IDs
  let geniusIds: Record<string, number> = {};
  if (values['genius-id'] && values.creator) {
    geniusIds[values.creator] = parseInt(values['genius-id']);
  } else if (values['genius-ids']) {
    // Format: "creator1:id1,creator2:id2"
    const pairs = values['genius-ids'].split(',');
    for (const pair of pairs) {
      const [creator, id] = pair.split(':');
      geniusIds[creator.trim()] = parseInt(id.trim());
    }
  }

  // Parse handles
  let handles: Record<string, string> = {};
  if (values.handle && values.creator) {
    handles[values.creator] = values.handle;
  } else if (values.handles) {
    // Format: "creator1:handle1,creator2:handle2"
    const pairs = values.handles.split(',');
    for (const pair of pairs) {
      const [creator, handle] = pair.split(':');
      handles[creator.trim()] = handle.trim();
    }
  }

  const options: PipelineOptions = {
    creators,
    geniusIds,
    handles,
    startAt: values['start-at'] ? parseInt(values['start-at']) : undefined,
    stopAt: values['stop-at'] ? parseInt(values['stop-at']) : undefined,
    concurrency: values.concurrency ? parseInt(values.concurrency) : 1, // Default to 1 to avoid nonce conflicts
  };

  try {
    await runPipeline(options);
  } catch (error: any) {
    console.error(`\n${colors.red}❌ Pipeline failed: ${error.message}${colors.reset}\n`);
    process.exit(1);
  }
}

main();
