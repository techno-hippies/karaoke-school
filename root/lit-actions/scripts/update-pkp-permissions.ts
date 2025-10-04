#!/usr/bin/env bun

/**
 * Update PKP Permissions for Karaoke Scorer
 *
 * This script adds or updates the permitted IPFS CID for the PKP
 *
 * Usage:
 *   bun run update-pkp-permissions <IPFS_CID>
 *
 * Example:
 *   bun run update-pkp-permissions Qmd5dkQ1WGTBos2Gs66qB6JMLFKsiK7jfqjbkKX7aFhPMd
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createWalletClient, http, type Account, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile } from 'fs/promises';
import * as dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Chronicle Yellowstone chain config (for PKP permissions)
const chronicleYellowstone = defineChain({
  id: 175188,
  name: 'Chronicle Yellowstone',
  nativeCurrency: { name: 'tstLPX', symbol: 'tstLPX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://yellowstone-rpc.litprotocol.com'] },
  },
  blockExplorers: {
    default: { name: 'Chronicle Explorer', url: 'https://yellowstone-explorer.litprotocol.com' },
  },
});

async function main() {
  console.log('🔐 Update PKP Permissions for Karaoke Scorer');
  console.log('============================================\n');

  // Get IPFS CID from command line
  const newCid = process.argv[2];
  if (!newCid) {
    console.error('❌ Missing IPFS CID argument');
    console.log('\nUsage: bun run update-pkp-permissions <IPFS_CID>');
    console.log('Example: bun run update-pkp-permissions Qmd5dkQ1WGTBos2Gs66qB6JMLFKsiK7jfqjbkKX7aFhPMd');
    process.exit(1);
  }

  console.log('📦 New IPFS CID:', newCid);

  // 1. Check for private key
  let privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not found in .env file');
    process.exit(1);
  }

  // Add 0x prefix if missing
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }

  // 2. Load PKP credentials
  console.log('\n📂 Loading PKP credentials...');
  const pkpCredsPath = dirname(__dirname) + '/output/pkp-credentials.json';
  const pkpCreds = JSON.parse(await readFile(pkpCredsPath, 'utf-8'));
  console.log('✅ PKP loaded:', pkpCreds.ethAddress);
  console.log('   Token ID:', pkpCreds.tokenId);

  // 3. Create account
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log('✅ Account:', account.address);

  // 4. Create wallet client for Chronicle Yellowstone
  const walletClient = createWalletClient({
    account,
    chain: chronicleYellowstone,
    transport: http(),
  });

  // 5. Connect to Lit Protocol
  console.log('\n🔌 Connecting to Lit Protocol (nagaDev network)...');
  const litClient = await createLitClient({
    network: nagaDev
  });
  console.log('✅ Connected to Lit Network');

  // 6. Get PKP Permissions Manager
  console.log('\n🔧 Getting PKP permissions manager...');
  const pkpPermissionsManager = await litClient.getPKPPermissionsManager({
    pkpIdentifier: {
      tokenId: pkpCreds.tokenId,
    },
    account: walletClient.account as Account,
  });
  console.log('✅ PKP Permissions Manager ready');

  // 7. View current permissions
  console.log('\n🔍 Current PKP permissions:');
  const currentPermissions = await litClient.viewPKPPermissions({
    tokenId: pkpCreds.tokenId,
  });
  console.log(currentPermissions);

  // 8. Add new permitted action
  console.log(`\n🔑 Adding permission for IPFS CID: ${newCid}`);
  console.log('   Scope: sign-anything');

  const addPermissionsTx = await pkpPermissionsManager.addPermittedAction({
    ipfsId: newCid,
    scopes: ["sign-anything"],
  });

  console.log('✅ Permission added successfully!');
  console.log('   Transaction:', addPermissionsTx);

  // 9. Verify updated permissions
  console.log('\n🔍 Verifying updated permissions...');
  const updatedPermissions = await litClient.viewPKPPermissions({
    tokenId: pkpCreds.tokenId,
  });
  console.log('✅ Updated permissions:', updatedPermissions);

  await litClient.disconnect();

  console.log('\n✨ PKP Permissions Updated!');
  console.log('\n📋 Next Steps:');
  console.log('1. Test the Lit Action with the new CID');
  console.log('2. Verify that decryption works with the new permissions');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  console.error(error);
  process.exit(1);
});
