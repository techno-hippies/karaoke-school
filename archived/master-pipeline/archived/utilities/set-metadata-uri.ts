#!/usr/bin/env bun
/**
 * Set Lens Account Metadata URI
 */

import { parseArgs } from 'util';
import { PublicClient, evmAddress } from '@lens-protocol/client';
import { setAccountMetadata } from '@lens-protocol/client/actions';
import { testnet } from '@lens-protocol/env';
import { chains } from '@lens-chain/sdk/viem';
import { signMessageWith, handleOperationWith } from '@lens-protocol/client/viem';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { requireEnv } from '../lib/config.js';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      username: { type: 'string' },
      'metadata-uri': { type: 'string' },
    },
  });

  if (!values.username || !values['metadata-uri']) {
    console.log('Usage: bun run scripts/set-metadata-uri.ts --username franzferdinand --metadata-uri lens://...\n');
    process.exit(1);
  }

  const username = values.username;
  const metadataUri = values['metadata-uri']!;

  console.log(`\n📝 Setting metadata URI for @${username}...`);
  console.log(`   URI: ${metadataUri}\n`);

  // Initialize clients
  const privateKey = requireEnv('PRIVATE_KEY');
  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);

  const walletClient = createWalletClient({
    account,
    chain: chains.testnet,
    transport: http(),
  });

  const lensClient = PublicClient.create({
    environment: testnet,
    origin: 'http://localhost:3000',
  });

  // Login to Lens
  console.log('🔐 Authenticating with Lens...');
  const appAddress = '0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0';
  const authenticated = await lensClient.login({
    onboardingUser: {
      app: evmAddress(appAddress),
      wallet: evmAddress(walletClient.account.address),
    },
    signMessage: signMessageWith(walletClient),
  });

  if (authenticated.isErr()) {
    throw new Error(`Lens login failed: ${authenticated.error.message}`);
  }

  const sessionClient = authenticated.value;
  console.log('✅ Authenticated\n');

  // Set metadata URI
  console.log('📝 Updating account metadata...');
  const result = await setAccountMetadata(sessionClient, {
    metadataUri,
  })
    .andThen(handleOperationWith(walletClient))
    .andThen(sessionClient.waitForTransaction);

  if (result.isErr()) {
    throw new Error(`Failed to set metadata: ${result.error.message}`);
  }

  console.log(`✅ Metadata updated for @${username}`);
  console.log(`   Tx: ${result.value}\n`);
}

main();
