#!/usr/bin/env bun

/**
 * Add permitted action to PKP
 *
 * Usage:
 *   bun scripts/add-permission.ts <IPFS_CID>
 *   bun scripts/add-permission.ts <IPFS_CID> --env=naga-test
 *
 * Examples:
 *   bun scripts/add-permission.ts QmRzS...
 *   LIT_NETWORK=naga-test bun scripts/add-permission.ts QmRzS...
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Env } from '../tests/shared/env';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '../');

// Chronicle Yellowstone chain config
const chronicleYellowstone = {
  id: 175188,
  name: 'Chronicle Yellowstone',
  nativeCurrency: { name: 'tstLPX', symbol: 'tstLPX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://yellowstone-rpc.litprotocol.com'] },
  },
};

// Parse CLI args
const args = process.argv.slice(2);
const ipfsId = args.find(a => !a.startsWith('--'));

if (!ipfsId) {
  console.error('❌ Usage: bun scripts/add-permission.ts <IPFS_CID>');
  console.error('Example: bun scripts/add-permission.ts QmRzS...');
  process.exit(1);
}

async function main() {
  // Load PKP credentials
  const pkpPath = join(ROOT_DIR, `output/pkp-${Env.name}.json`);

  if (!existsSync(pkpPath)) {
    console.error(`❌ PKP file not found: output/pkp-${Env.name}.json`);
    process.exit(1);
  }

  const pkpCreds = JSON.parse(readFileSync(pkpPath, 'utf-8'));

  // Check if CID is in our cids file
  const cidPath = join(ROOT_DIR, `cids/${Env.keyEnv}.json`);
  let cidInConfig = false;
  if (existsSync(cidPath)) {
    const cids = JSON.parse(readFileSync(cidPath, 'utf-8'));
    cidInConfig = Object.values(cids).includes(ipfsId);
  }

  console.log('🔐 Add PKP Permission');
  console.log('─'.repeat(40));
  console.log(`   Env: ${Env.name}`);
  console.log(`   CID: ${ipfsId}`);
  if (!cidInConfig) {
    console.log(`   ⚠️  CID not in cids/${Env.keyEnv}.json`);
  }
  console.log(`   PKP: ${pkpCreds.ethAddress}`);
  console.log(`   Token ID: ${pkpCreds.tokenId}`);

  // Get private key
  let privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('\n❌ PRIVATE_KEY not found in environment');
    process.exit(1);
  }

  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(`   Owner: ${account.address}`);

  // Create wallet client
  const walletClient = createWalletClient({
    account,
    chain: chronicleYellowstone,
    transport: http(),
  });

  // Connect to Lit Protocol
  console.log(`\n🔌 Connecting to Lit Protocol (${Env.name})...`);
  const litClient = await createLitClient({ network: Env.litNetwork });
  console.log('✅ Connected');

  // Get PKP Permissions Manager
  console.log('\n🔧 Getting PKP Permissions Manager...');
  const pkpPermissionsManager = await litClient.getPKPPermissionsManager({
    pkpIdentifier: {
      tokenId: pkpCreds.tokenId,
    },
    account: walletClient.account,
  });

  // Add permission
  console.log('\n🔑 Adding permission...');
  const tx = await pkpPermissionsManager.addPermittedAction({
    ipfsId,
    scopes: ['sign-anything'],
  });
  console.log('✅ Permission added');
  console.log(`   Tx: ${tx}`);

  // Update PKP credentials file
  if (!pkpCreds.permittedActions) {
    pkpCreds.permittedActions = [];
  }

  const existing = pkpCreds.permittedActions.find((p: any) => p.ipfsId === ipfsId);
  if (!existing) {
    pkpCreds.permittedActions.push({
      ipfsId,
      scopes: ['sign-anything'],
      addedAt: new Date().toISOString()
    });
    writeFileSync(pkpPath, JSON.stringify(pkpCreds, null, 2) + '\n');
    console.log('\n💾 Updated PKP credentials file');
  }

  // Verify permissions
  console.log('\n🔍 Verifying permissions...');
  const permissions = await litClient.viewPKPPermissions({
    tokenId: pkpCreds.tokenId,
  });

  const actionsList = permissions.actions?.map((a: any) => a.ipfsId || a) || [];
  console.log(`✅ Permitted actions (${actionsList.length}):`);
  actionsList.forEach((a: string) => {
    const marker = a === ipfsId ? '→' : ' ';
    console.log(`   ${marker} ${a}`);
  });

  await litClient.disconnect();
  console.log('\n✨ Done!');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
