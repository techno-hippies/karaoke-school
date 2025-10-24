#!/usr/bin/env bun
/**
 * Step 1: Mint PKP for Artist
 *
 * Creates a Programmable Key Pair (PKP) on Lit Protocol Chronicle Yellowstone
 *
 * Usage:
 *   bun run artists/01-mint-pkp.ts --name beyonce --genius-id 498
 */

import { parseArgs } from 'util';
import { mintPKP } from '../../lib/pkp.js';
import { paths } from '../../lib/config.js';
import { writeJson } from '../../lib/fs.js';
import { logger } from '../../lib/logger.js';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      name: { type: 'string' },
      'genius-id': { type: 'string' },
    },
  });

  if (!values.name || !values['genius-id']) {
    logger.error('Missing required parameters');
    console.log('\nUsage:');
    console.log('  bun run artists/01-mint-pkp.ts --name beyonce --genius-id 498\n');
    process.exit(1);
  }

  const artistName = values.name;
  const geniusArtistId = parseInt(values['genius-id']);

  logger.header(`Mint PKP: ${artistName}`);

  try {
    // Mint PKP
    const pkpData = await mintPKP({ artistName, geniusArtistId });

    // Save to file
    const pkpPath = paths.artistPkp(artistName);
    writeJson(pkpPath, pkpData);

    logger.success(`PKP data saved to: ${pkpPath}`);
    logger.detail('PKP Address', pkpData.pkpEthAddress);
    logger.detail('Token ID', pkpData.pkpTokenId);

    process.exit(0);
  } catch (error: any) {
    logger.error(`Failed to mint PKP: ${error.message}`);
    process.exit(1);
  }
}

main();
