#!/usr/bin/env bun
/**
 * Test: Fetch existing Lens account to verify it's indexed
 */

import { PublicClient } from '@lens-protocol/client';
import { fetchAccount } from '@lens-protocol/client/actions';
import { testnet } from '@lens-protocol/env';

const publicClient = PublicClient.create({
  environment: testnet,
  origin: 'https://test.local',
});

console.log('Fetching account @le_sserafim...\n');

const result = await fetchAccount(publicClient, {
  username: {
    localName: 'le_sserafim',
  },
});

if (result.isErr()) {
  console.error('❌ Error:', result.error);
  process.exit(1);
}

if (!result.value) {
  console.error('❌ Account not found');
  process.exit(1);
}

const account = result.value;
console.log('✅ Account found!');
console.log(`   Address: ${account.address}`);
console.log(`   ID: ${account.id}`);
console.log(`   Owner: ${account.owner}`);
console.log('\nFull data:', JSON.stringify(account, null, 2));

process.exit(0);
