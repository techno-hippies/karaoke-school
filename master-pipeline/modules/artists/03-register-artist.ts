#!/usr/bin/env bun
/**
 * Step 3: Register Artist in Contract
 *
 * Registers artist in ArtistRegistryV1 smart contract
 *
 * Usage:
 *   bun run artists/03-register-artist.ts --name beyonce --genius-id 498
 */

import { parseArgs } from 'util';
import { registerArtist } from '../../lib/contracts.js';
import { paths } from '../../lib/config.js';
import { readJson, writeJson } from '../../lib/fs.js';
import { logger } from '../../lib/logger.js';
import type { ArtistPKP, ArtistLens, ArtistManifest } from '../../lib/types.js';

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
    console.log('  bun run artists/03-register-artist.ts --name beyonce --genius-id 498\n');
    process.exit(1);
  }

  const artistName = values.name;
  const geniusArtistId = parseInt(values['genius-id']);

  logger.header(`Register Artist: ${artistName}`);

  try {
    // Load PKP and Lens data
    const pkpPath = paths.artistPkp(artistName);
    const lensPath = paths.artistLens(artistName);

    const pkpData = readJson<ArtistPKP>(pkpPath);
    const lensData = readJson<ArtistLens>(lensPath);

    logger.info(`Loaded PKP: ${pkpData.pkpEthAddress}`);
    logger.info(`Loaded Lens: ${lensData.lensAccountAddress}`);

    // Register in contract
    const onchainData = await registerArtist({
      geniusArtistId,
      pkpAddress: pkpData.pkpEthAddress,
      lensHandle: lensData.lensHandle,
      lensAccountAddress: lensData.lensAccountAddress,
    });

    // Load identifiers from Lens metadata
    const identifiers = {
      geniusArtistId,
      luminateId: '', // Will be populated from Lens metadata
      musicbrainzId: undefined,
      spotifyArtistId: undefined,
    };

    // Create full manifest
    const manifest: ArtistManifest = {
      name: artistName,
      geniusArtistId,
      handle: artistName,
      identifiers,
      pkp: pkpData,
      lens: lensData,
      onchain: onchainData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save manifest
    const manifestPath = paths.artistManifest(artistName);
    writeJson(manifestPath, manifest);

    logger.success(`Artist manifest saved to: ${manifestPath}`);
    logger.detail('Genius ID', geniusArtistId.toString());
    logger.detail('PKP Address', pkpData.pkpEthAddress);
    logger.detail('Lens Handle', lensData.lensHandle);
    logger.detail('Tx Hash', onchainData.transactionHash);

    logger.success(`\nArtist profile ready at: /a/${lensData.lensHandle}`);
  } catch (error: any) {
    logger.error(`Failed to register artist: ${error.message}`);
    process.exit(1);
  }
}

main();
