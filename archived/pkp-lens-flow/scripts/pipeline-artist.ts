#!/usr/bin/env bun
/**
 * Artist Creation Pipeline
 *
 * One-time setup to create an artist profile with PKP, Lens account, and on-chain registration.
 * Videos are added separately using pipeline-video.ts
 *
 * Usage:
 *   bun run scripts/pipeline-artist.ts --handle taylorswift --genius-id 1177 --username taylorswift
 *   bun run scripts/pipeline-artist.ts --handle beyonce --genius-id 498 --username beyonce
 *
 * Steps:
 *   1. Mint PKP
 *   4. Upload profile avatar
 *   5. Add Genius Artist ID to manifest
 *   6. Create Lens account
 *   7. Create Lens username
 *   8. Register in ArtistRegistryV2 contract
 *
 * Output:
 *   - Artist profile page ready at /u/{username}
 *   - PKP and Lens data in data/pkps/{handle}.json
 *   - Manifest in data/videos/{handle}/manifest.json
 */

import { parseArgs } from 'util';
import { spawn } from 'child_process';
import path from 'path';

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

interface ArtistOptions {
  handle: string;
  geniusId: number;
  username: string;
}

interface StepDefinition {
  num: number;
  name: string;
  script: string;
  requiresEnv?: boolean;
  args?: (opts: ArtistOptions) => string[];
}

const STEPS: StepDefinition[] = [
  {
    num: 1,
    name: 'Mint PKP',
    script: 'local/01-mint-pkp.ts',
    requiresEnv: true,
    args: (opts) => ['--creator', `@${opts.handle}`],
  },
  {
    num: 2,
    name: 'Initialize Manifest',
    script: 'local/02-init-artist-manifest.ts',
    requiresEnv: false,
    args: (opts) => ['--creator', `@${opts.handle}`, '--genius-id', opts.geniusId.toString()],
  },
  {
    num: 6,
    name: 'Create Lens Account',
    script: 'local/06-create-lens-account.ts',
    requiresEnv: true,
    args: (opts) => ['--creator', `@${opts.handle}`, '--username', opts.username],
  },
  {
    num: 7,
    name: 'Create Username',
    script: 'local/07-create-username.ts',
    requiresEnv: true,
    args: (opts) => ['--creator', `@${opts.handle}`, '--username', opts.username],
  },
  {
    num: 8,
    name: 'Register in Contract',
    script: 'local/08-register-in-contract.ts',
    requiresEnv: true,
    args: (opts) => ['--creator', `@${opts.handle}`],
  },
];

async function runStep(step: StepDefinition, options: ArtistOptions): Promise<void> {
  const scriptPath = path.join(process.cwd(), step.script);
  const stepArgs = step.args ? step.args(options) : ['--creator', `@${options.handle}`];

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

async function runArtistPipeline(options: ArtistOptions): Promise<void> {
  const startTime = Date.now();

  console.log(`\n${colors.bright}${colors.blue}╔═══════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}║     Artist Creation Pipeline              ║${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}╚═══════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`${colors.bright}Handle: @${options.handle}${colors.reset}`);
  console.log(`${colors.bright}Genius ID: ${options.geniusId}${colors.reset}`);
  console.log(`${colors.bright}Lens Username: ${options.username}${colors.reset}\n`);

  for (const step of STEPS) {
    await runStep(step, options);
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  console.log(`${colors.bright}${colors.green}✨ Artist creation complete! (${duration} minutes)${colors.reset}`);
  console.log(`${colors.bright}${colors.green}Artist profile ready at: /u/${options.username}${colors.reset}\n`);
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      handle: { type: 'string' },
      'genius-id': { type: 'string' },
      username: { type: 'string' },
    },
  });

  if (!values.handle || !values['genius-id'] || !values.username) {
    console.error(`\n${colors.red}❌ Error: Missing required parameters${colors.reset}\n`);
    console.log('Usage:');
    console.log('  bun run scripts/pipeline-artist.ts --handle beyonce --genius-id 498 --username beyonce');
    console.log('  bun run scripts/pipeline-artist.ts --handle taylorswift --genius-id 1177 --username taylorswift\n');
    process.exit(1);
  }

  const options: ArtistOptions = {
    handle: values.handle,
    geniusId: parseInt(values['genius-id']),
    username: values.username,
  };

  try {
    await runArtistPipeline(options);
  } catch (error: any) {
    console.error(`\n${colors.red}❌ Pipeline failed: ${error.message}${colors.reset}\n`);
    process.exit(1);
  }
}

main();
