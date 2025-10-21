#!/usr/bin/env bun
/**
 * Step 2: Create Lens Account for Artist
 *
 * Creates a Lens Protocol account with artist metadata
 *
 * Usage:
 *   bun run artists/02-create-lens.ts --name beyonce --handle beyonce
 */

import { parseArgs } from 'util';
import { createLensAccount, createLensUsername } from '../../lib/lens.js';
import { paths } from '../../lib/config.js';
import { readJson, writeJson } from '../../lib/fs.js';
import { logger } from '../../lib/logger.js';
import type { ArtistPKP, ArtistManifest } from '../../lib/types.js';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      name: { type: 'string' },
      handle: { type: 'string' },
      'genius-id': { type: 'string' },
      'luminate-id': { type: 'string' },
      'musicbrainz-id': { type: 'string' },
      'spotify-id': { type: 'string' },
    },
  });

  if (!values.name || !values.handle || !values['genius-id']) {
    logger.error('Missing required parameters');
    console.log('\nUsage:');
    console.log('  bun run artists/02-create-lens.ts --name beyonce --handle beyonce --genius-id 498 [--luminate-id AR...] [--musicbrainz-id ...] [--spotify-id ...]\n');
    process.exit(1);
  }

  const artistName = values.name;
  const handle = values.handle;
  const geniusArtistId = parseInt(values['genius-id']);
  const luminateId = values['luminate-id'] || '';
  const musicbrainzId = values['musicbrainz-id'];
  const spotifyArtistId = values['spotify-id'];

  logger.header(`Create Lens Account: ${artistName}`);

  try {
    // Load PKP data
    const pkpPath = paths.artistPkp(artistName);
    const pkpData = readJson<ArtistPKP>(pkpPath);

    logger.info(`Loaded PKP: ${pkpData.pkpEthAddress}`);

    // Create Lens account with identifiers
    const lensData = await createLensAccount({
      pkpAddress: pkpData.pkpEthAddress,
      handle,
      artistName,
      geniusArtistId,
      luminateId,
      musicbrainzId,
      spotifyArtistId,
    });

    // Create username
    await createLensUsername({
      accountAddress: lensData.lensAccountAddress,
      username: handle,
    });

    // Save to file
    const lensPath = paths.artistLens(artistName);
    writeJson(lensPath, lensData);

    logger.success(`Lens data saved to: ${lensPath}`);
    logger.detail('Lens Handle', lensData.lensHandle);
    logger.detail('Account Address', lensData.lensAccountAddress);
  } catch (error: any) {
    logger.error(`Failed to create Lens account: ${error.message}`);
    process.exit(1);
  }
}

main();
