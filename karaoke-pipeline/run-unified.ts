#!/usr/bin/env bun
/**
 * Unified Karaoke Pipeline Runner
 *
 * Orchestrates all steps (2-12) for karaoke segment processing.
 * Uses the unified orchestrator with embedded services.
 *
 * Usage:
 *   bun run-unified.ts [--step=N] [--limit=N] [--continuous] [--all]
 *   bun run-unified.ts --all --limit=50       # All steps, max 50 tracks each
 *   bun run-unified.ts --step=6 --limit=10    # Only step 6, max 10 tracks
 *   bun run-unified.ts --continuous --all     # Run all steps in continuous loop
 */

import { runUnifiedPipeline } from './src/processors/orchestrator';

interface RunOptions {
  step?: number;           // Run specific step only
  limit?: number;          // Items per step (default: 50)
  continuous?: boolean;    // Run continuously with delays
  delay?: number;          // Delay between cycles (default: 90s)
  all?: boolean;           // Run all steps (default if no step specified)
}

/**
 * Parse command line arguments into options
 */
function parseArgs(): RunOptions {
  const args = process.argv.slice(2);
  const options: RunOptions = {
    limit: 50,
    continuous: false,
    delay: 90,
    all: true
  };

  for (const arg of args) {
    if (arg.startsWith('--step=')) {
      options.step = parseInt(arg.split('=')[1]);
      options.all = false;  // Specific step disables all-steps mode
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--delay=')) {
      options.delay = parseInt(arg.split('=')[1]);
    } else if (arg === '--continuous') {
      options.continuous = true;
    } else if (arg === '--all') {
      options.all = true;
      options.step = undefined;
    }
  }

  return options;
}

/**
 * Build environment from process.env
 */
function buildEnv(): any {
  return process.env;
}

/**
 * Run a single pipeline cycle
 */
async function runPipeline(options: RunOptions, cycleNumber: number = 1): Promise<void> {
  const env = buildEnv();

  console.log(`\n${'='.repeat(70)}`);
  console.log(`🎵 Pipeline Cycle: ${new Date().toLocaleTimeString()} (Cycle #${cycleNumber})`);
  console.log(`${'='.repeat(70)}`);

  try {
    await runUnifiedPipeline(env, {
      step: options.step,
      limit: options.limit
    });
  } catch (error: any) {
    console.error(`\n❌ Pipeline failed: ${error.message}`);
    if (!options.continuous) {
      process.exit(1);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const options = parseArgs();

  console.log('🚀 Unified Karaoke Pipeline (Bun Edition)');
  console.log(`📊 Options:`);
  console.log(`   Limit: ${options.limit} items per step`);
  console.log(`   Continuous: ${options.continuous}`);
  if (options.step) {
    console.log(`   Mode: Single step (${options.step})`);
  } else {
    console.log(`   Mode: All steps`);
  }

  if (options.continuous) {
    // Continuous mode - run cycles indefinitely
    let cycleCount = 0;
    while (true) {
      cycleCount++;
      await runPipeline(options, cycleCount);

      if (options.delay > 0) {
        console.log(`\n⏸️  Sleeping ${options.delay}s before next cycle...`);
        await new Promise(resolve => setTimeout(resolve, options.delay * 1000));
      }
    }
  } else {
    // Single run mode
    await runPipeline(options, 1);
    console.log('\n✅ Pipeline execution complete');
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
