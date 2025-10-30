/**
 * Step 1: Create GRC-20 Space for Karaoke School
 *
 * Run once to create the space where all music entities will live.
 * Saves space ID to .env file.
 */

import { Graph, getWalletClient } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import { config, validateConfig } from '../config';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🎵 Creating GRC-20 Space for Karaoke School...\n');

  // Only validate PRIVATE_KEY for setup (DATABASE_URL not needed yet)
  if (!config.privateKey) {
    throw new Error('Missing required config: privateKey');
  }

  if (config.spaceId) {
    console.log(`✅ Space already exists: ${config.spaceId}`);
    const browserUrl = config.network === 'MAINNET'
      ? 'https://www.geobrowser.io'
      : 'https://testnet.geobrowser.io';
    console.log(`   View at: ${browserUrl}/space/${config.spaceId}`);
    return;
  }

  // Get wallet client (add 0x prefix if missing)
  const privateKey = config.privateKey.startsWith('0x')
    ? config.privateKey
    : `0x${config.privateKey}`;
  const { address } = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(`📝 Editor address: ${address}`);

  // Create space
  console.log(`🌐 Network: ${config.network}`);
  console.log('⏳ Creating space...');

  const space = await Graph.createSpace({
    editorAddress: address,
    name: 'Songverse',
    network: config.network,
  });

  console.log(`\n✅ Space created: ${space.id}`);
  const browserUrl = config.network === 'MAINNET'
    ? 'https://www.geobrowser.io'
    : 'https://testnet.geobrowser.io';
  console.log(`   View at: ${browserUrl}/space/${space.id}`);

  // Save to .env
  const envPath = path.join(__dirname, '../.env');
  const envContent = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, 'utf-8')
    : fs.readFileSync(path.join(__dirname, '../.env.example'), 'utf-8');

  const updatedEnv = envContent.includes('GRC20_SPACE_ID=')
    ? envContent.replace(/GRC20_SPACE_ID=.*/, `GRC20_SPACE_ID=${space.id}`)
    : envContent + `\nGRC20_SPACE_ID=${space.id}\n`;

  fs.writeFileSync(envPath, updatedEnv);
  console.log(`   Saved to .env`);

  console.log('\n📋 Next steps:');
  console.log('   1. Run: bun run define-types');
  console.log('   2. Run: bun run import-works');
}

main().catch(console.error);
