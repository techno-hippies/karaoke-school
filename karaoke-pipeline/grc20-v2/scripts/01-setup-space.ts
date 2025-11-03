/**
 * Step 1: Create GRC-20 Space
 * Creates "Songverse v2" - complete music metadata knowledge graph
 */

import { Graph, getWalletClient } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import { config, validateConfig } from '../config';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🌐 Creating GRC-20 Space: Songverse v2\n');

  validateConfig();

  // Get wallet
  const privateKey = config.privateKey!.startsWith('0x')
    ? config.privateKey!
    : `0x${config.privateKey!}`;
  const { address } = privateKeyToAccount(privateKey as `0x${string}`);

  console.log(`📝 Editor Address: ${address}`);
  console.log(`🌍 Network: ${config.network}\n`);

  // Create space
  console.log('⏳ Creating space...');
  const space = await Graph.createSpace({
    editorAddress: address,
    name: 'songverse-v2',
    network: config.network,
  });

  console.log(`✅ Space created!`);
  console.log(`   ID: ${space.id}`);
  console.log(`   Name: ${space.name || 'songverse-v2'}\n`);

  // Save space ID
  const envPath = path.join(__dirname, '../../.env');
  let envContent = fs.readFileSync(envPath, 'utf-8');

  // Add or update GRC20_SPACE_ID_V2
  if (envContent.includes('GRC20_SPACE_ID_V2=')) {
    envContent = envContent.replace(
      /GRC20_SPACE_ID_V2=.*/,
      `GRC20_SPACE_ID_V2=${space.id}`
    );
  } else {
    envContent += `\nGRC20_SPACE_ID_V2=${space.id}\n`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log(`💾 Saved to .env: GRC20_SPACE_ID_V2=${space.id}\n`);

  const browserUrl = config.network === 'MAINNET'
    ? 'https://www.geobrowser.io'
    : 'https://testnet.geobrowser.io';

  console.log(`🔍 View at: ${browserUrl}/space/${space.id}\n`);

  console.log('📋 Next steps:');
  console.log('   1. Run: bun grc20-v2/scripts/02-define-types.ts');
  console.log('   2. Then: bun grc20-v2/scripts/03-mint-artists.ts');
}

main().catch(console.error);
