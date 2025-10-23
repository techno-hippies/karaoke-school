#!/usr/bin/env bun
/**
 * Deploy SPG NFT Contract for Story Protocol
 *
 * Creates a reusable NFT collection on Story Protocol Aeneid testnet
 * that will be used for all IP Asset mints (creators + segments).
 *
 * Prerequisites:
 * - PRIVATE_KEY in .env (wallet with testnet $IP for gas)
 *
 * Usage:
 *   bun setup/01-deploy-spg-nft-contract.ts
 *   bun setup/01-deploy-spg-nft-contract.ts --name "Karaoke School V2" --symbol "KSCHOOL"
 */

import { parseArgs } from 'util';
import { requireEnv } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { StoryProtocolService } from '../services/story-protocol.js';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      name: { type: 'string', default: 'Karaoke School Creator Videos' },
      symbol: { type: 'string', default: 'KSCHOOL' },
      'max-supply': { type: 'string', default: '100000' },
    },
  });

  const collectionName = values.name!;
  const collectionSymbol = values.symbol!;
  const maxSupply = parseInt(values['max-supply']!);

  logger.header('Deploy SPG NFT Contract');

  try {
    // Initialize Story Protocol service
    const privateKey = requireEnv('PRIVATE_KEY');

    console.log('\n📋 Configuration:');
    console.log(`   Collection Name: ${collectionName}`);
    console.log(`   Symbol: ${collectionSymbol}`);
    console.log(`   Max Supply: ${maxSupply.toLocaleString()}`);
    console.log(`   Network: Story Protocol Aeneid Testnet (Chain ID: 1315)`);

    const storyService = new StoryProtocolService({
      privateKey,
      // Don't pass spgNftContract yet - we're creating it
    });

    // Create NFT collection
    console.log('\n⛓️  Deploying SPG NFT Collection...');
    console.log('   (This may take a few seconds)\n');

    const spgNftContract = await storyService.createNFTCollection(
      collectionName,
      collectionSymbol,
      maxSupply
    );

    console.log('\n✅ SPG NFT Contract Deployed!');
    console.log(`   Address: ${spgNftContract}`);
    console.log(`   Name: ${collectionName}`);
    console.log(`   Symbol: ${collectionSymbol}`);
    console.log(`   Max Supply: ${maxSupply.toLocaleString()}`);

    // Show how to add to .env
    console.log('\n📝 Add to your .env file:');
    console.log(`\n   SPG_NFT_CONTRACT=${spgNftContract}\n`);

    // Show dotenvx command
    console.log('💡 Using dotenvx? Run this command:\n');
    console.log(`   dotenvx set SPG_NFT_CONTRACT="${spgNftContract}" --\n`);

    console.log('✅ Setup complete! You can now mint IP Assets for creator videos.\n');

  } catch (error: any) {
    logger.error(`Failed to deploy SPG NFT contract: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
