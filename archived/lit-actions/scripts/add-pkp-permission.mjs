#!/usr/bin/env node

/**
 * Add permitted action to PKP
 *
 * Usage:
 *   bun run scripts/add-pkp-permission.mjs <IPFS_CID>
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

// Chronicle Yellowstone chain config
const chronicleYellowstone = {
  id: 175188,
  name: 'Chronicle Yellowstone',
  nativeCurrency: { name: 'tstLPX', symbol: 'tstLPX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://yellowstone-rpc.litprotocol.com'] },
  },
  blockExplorers: {
    default: { name: 'Chronicle Explorer', url: 'https://yellowstone-explorer.litprotocol.com' },
  },
};

async function main() {
  const ipfsId = process.argv[2];

  if (!ipfsId) {
    console.error('❌ Usage: bun run scripts/add-pkp-permission.mjs <IPFS_CID>');
    process.exit(1);
  }

  console.log('🔐 Adding Lit Action Permission to PKP');
  console.log('=====================================\n');
  console.log('IPFS CID:', ipfsId);

  // Load PKP credentials
  const PKP_CREDS_PATH = join(__dirname, '../output/pkp-credentials.json');
  const pkpCreds = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log('PKP Address:', pkpCreds.ethAddress);
  console.log('Token ID:', pkpCreds.tokenId);

  // Get private key
  let privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not found in .env');
    process.exit(1);
  }

  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }

  const account = privateKeyToAccount(privateKey);
  console.log('Owner Address:', account.address);

  // Create wallet client
  const walletClient = createWalletClient({
    account,
    chain: chronicleYellowstone,
    transport: http(),
  });

  // Connect to Lit Protocol
  console.log('\n🔌 Connecting to Lit Protocol (nagaDev)...');
  const litClient = await createLitClient({ network: nagaDev });
  console.log('✅ Connected');

  // Get PKP Permissions Manager
  console.log('\n🔧 Getting PKP Permissions Manager...');
  const pkpPermissionsManager = await litClient.getPKPPermissionsManager({
    pkpIdentifier: {
      tokenId: pkpCreds.tokenId,
    },
    account: walletClient.account,
  });
  console.log('✅ PKP Permissions Manager ready');

  // Add permission
  console.log('\n🔑 Adding permission for IPFS CID:', ipfsId);
  const addPermissionsTx = await pkpPermissionsManager.addPermittedAction({
    ipfsId: ipfsId,
    scopes: ["sign-anything"],
  });
  console.log('✅ Permission added');
  console.log('   Transaction:', addPermissionsTx);

  // Update credentials file
  console.log('\n💾 Updating pkp-credentials.json...');
  if (!pkpCreds.permittedActions) {
    pkpCreds.permittedActions = [];
  }

  // Add new permission if not already present
  const existingPermission = pkpCreds.permittedActions.find(p => p.ipfsId === ipfsId);
  if (!existingPermission) {
    pkpCreds.permittedActions.push({
      ipfsId: ipfsId,
      scopes: ["sign-anything"]
    });
    await writeFile(PKP_CREDS_PATH, JSON.stringify(pkpCreds, null, 2));
    console.log('✅ Updated pkp-credentials.json');
  } else {
    console.log('✅ Permission already in pkp-credentials.json');
  }

  // Verify permissions
  console.log('\n🔍 Verifying PKP permissions...');
  const permissions = await litClient.viewPKPPermissions({
    tokenId: pkpCreds.tokenId,
  });
  console.log('✅ Current permitted actions:', permissions.actions);

  await litClient.disconnect();
  console.log('\n✨ Done!');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
