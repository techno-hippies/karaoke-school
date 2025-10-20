#!/usr/bin/env bun
/**
 * Full Artist Pipeline
 *
 * Automated pipeline to create artist with PKP, Lens account, and on-chain registration
 *
 * Usage:
 *   bun run scripts/pipeline-artist.ts --name beyonce --genius-id 498 --handle beyonce
 *
 * Or using npm script:
 *   bun run pipeline-artist --name beyonce --genius-id 498 --handle beyonce
 */

import { parseArgs } from 'util';
import { spawn } from 'child_process';
import { logger } from '../lib/logger';

interface ArtistOptions {
  name: string;
  geniusId: number;
  handle: string;
  luminateId: string;
  musicbrainzId?: string;
  spotifyId?: string;
}

interface StepDefinition {
  num: number;
  name: string;
  script: string;
  args: (opts: ArtistOptions) => string[];
}

const STEPS: StepDefinition[] = [
  {
    num: 1,
    name: 'Mint PKP',
    script: 'artists/01-mint-pkp.ts',
    args: (opts) => ['--name', opts.name, '--genius-id', opts.geniusId.toString()],
  },
  {
    num: 2,
    name: 'Create Lens Account',
    script: 'artists/02-create-lens.ts',
    args: (opts) => {
      const args = [
        '--name', opts.name,
        '--handle', opts.handle,
        '--genius-id', opts.geniusId.toString(),
        '--luminate-id', opts.luminateId,
      ];
      if (opts.musicbrainzId) {
        args.push('--musicbrainz-id', opts.musicbrainzId);
      }
      if (opts.spotifyId) {
        args.push('--spotify-id', opts.spotifyId);
      }
      return args;
    },
  },
  {
    num: 3,
    name: 'Register in Contract',
    script: 'artists/03-register-artist.ts',
    args: (opts) => ['--name', opts.name, '--genius-id', opts.geniusId.toString()],
  },
];

async function runStep(step: StepDefinition, options: ArtistOptions): Promise<void> {
  const args = ['run', step.script, ...step.args(options)];

  logger.step(step.num, step.name);

  return new Promise((resolve, reject) => {
    const proc = spawn('bun', args, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    proc.on('exit', (code) => {
      if (code === 0) {
        logger.success(`Step ${step.num}: ${step.name} - Complete\n`);
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

  logger.header('Artist Creation Pipeline');

  logger.detail('Name', options.name);
  logger.detail('Genius ID', options.geniusId.toString());
  logger.detail('Luminate ID', options.luminateId);
  logger.detail('Lens Handle', options.handle);

  for (const step of STEPS) {
    await runStep(step, options);
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  logger.success(`\n✨ Artist creation complete! (${duration} minutes)`);
  logger.success(`Artist profile ready at: /a/${options.handle}\n`);
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      name: { type: 'string' },
      'genius-id': { type: 'string' },
      handle: { type: 'string' },
      'luminate-id': { type: 'string' },
      'musicbrainz-id': { type: 'string' },
      'spotify-id': { type: 'string' },
    },
  });

  if (!values.name || !values['genius-id'] || !values.handle || !values['luminate-id']) {
    logger.error('Missing required parameters');
    console.log('\nUsage:');
    console.log(
      '  bun run scripts/pipeline-artist.ts --name beyonce --genius-id 498 --handle beyonce --luminate-id AR90077C7E103143BBAD5F062BA5AEDE49'
    );
    console.log('\nOptional:');
    console.log('  --musicbrainz-id 859d0860-d480-4efd-970c-c05d5f1776b8');
    console.log('  --spotify-id 6vWDO969PvNqNYHIOW5v0m\n');
    process.exit(1);
  }

  const options: ArtistOptions = {
    name: values.name,
    geniusId: parseInt(values['genius-id']),
    handle: values.handle,
    luminateId: values['luminate-id']!,
    musicbrainzId: values['musicbrainz-id'],
    spotifyId: values['spotify-id'],
  };

  try {
    await runArtistPipeline(options);
  } catch (error: any) {
    logger.error(`\nPipeline failed: ${error.message}\n`);
    process.exit(1);
  }
}

main();
