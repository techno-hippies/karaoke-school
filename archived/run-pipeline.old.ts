#!/usr/bin/env bun
/**
 * Karaoke Pipeline Runner
 * Simple CLI to run all pipeline steps sequentially
 *
 * Usage:
 *   bun run-pipeline.ts [--step=N] [--limit=N]
 *   bun run-pipeline.ts --step=1 --limit=10   # Run only step 1, process 10 items
 *   bun run-pipeline.ts --all                 # Run all steps (default)
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const STEPS = [
  {
    number: 1,
    name: 'Scrape TikTok',
    script: 'src/processors/01-scrape-tiktok.ts',
    requiresCreator: true, // Needs @username argument
    status: 'n/a → tiktok_scraped'
  },
  {
    number: 2,
    name: 'Resolve Spotify',
    script: 'src/processors/02-resolve-spotify.ts',
    status: 'tiktok_scraped → spotify_resolved'
  },
  {
    number: 3,
    name: 'Resolve ISWC',
    script: 'src/processors/03-resolve-iswc.ts',
    status: 'spotify_resolved → iswc_found'
  },
  {
    number: 4,
    name: 'Enrich MusicBrainz',
    script: 'src/processors/04-enrich-musicbrainz.ts',
    status: 'iswc_found → metadata_enriched'
  },
  {
    number: 5,
    name: 'Discover Lyrics',
    script: 'src/processors/05-discover-lyrics.ts',
    status: 'metadata_enriched → lyrics_ready'
  },
  {
    number: 6,
    name: 'Download Audio',
    script: 'src/processors/06-download-audio.ts',
    status: 'lyrics_ready → audio_downloaded'
  },
  {
    number: 7,
    name: 'Genius Enrichment',
    script: 'src/processors/07-genius-enrichment.ts',
    status: 'lyrics_ready+ → (parallel enrichment)'
  }
];

interface RunOptions {
  step?: number;
  limit?: number;
  creator?: string; // For step 1
}

async function runStep(stepNumber: number, limit: number, creator?: string): Promise<void> {
  const step = STEPS.find(s => s.number === stepNumber);
  if (!step) {
    throw new Error(`Step ${stepNumber} not found`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Step ${step.number}: ${step.name}`);
  console.log(`Status: ${step.status}`);
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    let command = `dotenvx run -f .env -- bun ${step.script}`;

    // Add arguments
    if (step.requiresCreator) {
      if (!creator) {
        console.log('⚠️  Step 1 requires --creator=@username argument, skipping');
        return;
      }
      command += ` ${creator} ${limit}`;
    } else {
      command += ` ${limit}`;
    }

    console.log(`Running: ${command}\n`);

    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Step ${step.number} completed in ${duration}s`);
  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`❌ Step ${step.number} failed after ${duration}s:`);
    console.error(error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const options: RunOptions = {
    limit: 10 // default
  };

  for (const arg of args) {
    if (arg.startsWith('--step=')) {
      options.step = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--creator=')) {
      options.creator = arg.split('=')[1];
    } else if (arg === '--all') {
      options.step = undefined; // Run all steps
    }
  }

  console.log('🚀 Karaoke Pipeline Runner');
  console.log(`📊 Limit: ${options.limit} items per step`);
  if (options.step) {
    console.log(`🎯 Running step ${options.step} only`);
  } else {
    console.log('🎯 Running all steps (2-7, skip step 1 without --creator)');
  }

  const pipelineStart = Date.now();
  const results: Array<{ step: number; success: boolean; error?: string }> = [];

  try {
    if (options.step) {
      // Run single step
      await runStep(options.step, options.limit, options.creator);
      results.push({ step: options.step, success: true });
    } else {
      // Run all steps (skip step 1 if no creator specified)
      for (const step of STEPS) {
        if (step.number === 1 && !options.creator) {
          console.log('\n⏭️  Skipping Step 1 (requires --creator=@username)');
          continue;
        }

        try {
          await runStep(step.number, options.limit, options.creator);
          results.push({ step: step.number, success: true });
        } catch (error: any) {
          results.push({
            step: step.number,
            success: false,
            error: error.message
          });
          // Continue to next step
        }
      }
    }
  } catch (error: any) {
    console.error('\n❌ Pipeline failed:', error.message);
    process.exit(1);
  }

  // Summary
  const totalDuration = ((Date.now() - pipelineStart) / 1000).toFixed(1);
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n' + '='.repeat(60));
  console.log(`🏁 Pipeline Complete (${totalDuration}s)`);
  console.log(`   ✅ Succeeded: ${succeeded} / ${results.length}`);
  console.log(`   ❌ Failed: ${failed} / ${results.length}`);

  if (failed > 0) {
    console.log('\n   Failed steps:');
    results.filter(r => !r.success).forEach(r => {
      const step = STEPS.find(s => s.number === r.step);
      console.log(`   - Step ${r.step}: ${step?.name} - ${r.error}`);
    });
  }

  console.log('='.repeat(60) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
