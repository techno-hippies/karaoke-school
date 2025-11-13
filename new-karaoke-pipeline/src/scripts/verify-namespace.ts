#!/usr/bin/env bun
/**
 * Verify that an account was created with the correct namespace
 */

import { createLensService } from '../services/lens-protocol';

async function main() {
  const accountAddress = process.argv[2];

  if (!accountAddress) {
    console.error('Usage: bun src/scripts/verify-namespace.ts <account_address>');
    console.error('Example: bun src/scripts/verify-namespace.ts 0x2CCaD5D6dE4BEEBe896E49F037F0c2856E40f07A');
    process.exit(1);
  }

  console.log(`🔍 Verifying namespace for account: ${accountAddress}\n`);

  const lensService = createLensService();

  // We need to manually fetch from Lens API to see full account details
  const { PublicClient } = await import('@lens-protocol/client');
  const { staging } = await import('@lens-protocol/env');
  const { fetchAccount } = await import('@lens-protocol/client/actions');
  const { evmAddress } = await import('@lens-protocol/client');

  const client = PublicClient.create({
    environment: staging,
    origin: 'http://localhost:3000',
  });

  try {
    const result = await fetchAccount(client, {
      address: evmAddress(accountAddress as `0x${string}`),
    });

    if (result.isErr()) {
      console.error('Failed to fetch account:', result.error);
      process.exit(1);
    }

    const account = result.value;

    console.log('Account Details:');
    console.log(`  Address: ${account.address}`);
    console.log(`  Username:`, account.username);
    console.log(`  Metadata:`, account.metadata);

    // Check if username has namespace info
    if (account.username) {
      console.log('\n✅ Username found!');
      console.log(JSON.stringify(account.username, null, 2));
    } else {
      console.log('\n⚠️  No username found');
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
