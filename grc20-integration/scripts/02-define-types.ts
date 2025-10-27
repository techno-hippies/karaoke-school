/**
 * Step 2: Define Music Types in GRC-20 Space
 *
 * Creates all type definitions (Musical Work, Recording, Segment, Artist, Performance)
 * and their properties. Run once per space.
 */

import { Ipfs, Graph, getWalletClient } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import { config, validateConfig } from '../config';
import { defineAllMusicTypes } from '../types/music-types';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🎵 Defining Music Types in GRC-20...\n');

  // Only validate PRIVATE_KEY for define-types (DATABASE_URL not needed yet)
  if (!config.privateKey) {
    throw new Error('Missing required config: privateKey');
  }

  if (!config.spaceId) {
    throw new Error('No GRC20_SPACE_ID found. Run: bun run setup');
  }

  // Get wallet client (add 0x prefix if missing)
  const privateKey = config.privateKey.startsWith('0x')
    ? config.privateKey
    : `0x${config.privateKey}`;
  const { address } = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = await getWalletClient({
    privateKey: privateKey as `0x${string}`,
  });

  console.log(`📝 Wallet: ${address}`);
  console.log(`🌐 Space: ${config.spaceId}`);
  console.log(`🌍 Network: ${config.network}\n`);

  // Generate all type definitions
  console.log('⏳ Generating type definitions...');
  const { ops, properties, types } = await defineAllMusicTypes();

  console.log(`   Created ${Object.keys(properties).length} properties`);
  console.log(`   Created ${Object.keys(types).length} types`);

  // Upload to IPFS
  console.log('\n⏳ Publishing to IPFS...');
  const { cid } = await Ipfs.publishEdit({
    name: 'Define Music Types',
    ops,
    author: address,
    network: config.network,
  });

  console.log(`   CID: ${cid}`);

  // Get calldata for space
  console.log('\n⏳ Getting transaction calldata...');
  const response = await fetch(`${config.graphApiOrigin}/space/${config.spaceId}/edit/calldata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cid }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get calldata: ${response.statusText}`);
  }

  const { to, data } = await response.json();

  // Submit transaction
  console.log('\n⏳ Submitting transaction...');
  const txHash = await walletClient.sendTransaction({
    account: walletClient.account,
    to: to as `0x${string}`,
    value: 0n,
    data: data as `0x${string}`,
  });

  console.log(`   Transaction: ${txHash}`);
  console.log('   Waiting for confirmation...');

  // Save type IDs to file
  const typeIds = {
    properties,
    types,
    spaceId: config.spaceId,
    network: config.network,
    timestamp: new Date().toISOString(),
  };

  const typeIdsPath = path.join(__dirname, '../type-ids.json');
  fs.writeFileSync(typeIdsPath, JSON.stringify(typeIds, null, 2));

  console.log(`\n✅ Types defined successfully!`);
  console.log(`   Saved to: type-ids.json`);
  const browserUrl = config.network === 'MAINNET'
    ? 'https://www.geobrowser.io'
    : 'https://testnet.geobrowser.io';
  console.log(`   View at: ${browserUrl}/space/${config.spaceId}`);

  console.log('\n📋 Next steps:');
  console.log('   1. Run: bun run import-works');
  console.log('   2. Run: bun run import-segments');
}

main().catch(console.error);
