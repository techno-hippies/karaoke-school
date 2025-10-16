#!/usr/bin/env bun
/**
 * Step 9: Create Additional Username
 *
 * Creates an additional username for an existing Lens account
 *
 * Prerequisites:
 * - Existing Lens account
 * - Account owner authentication
 *
 * Usage:
 *   bun run create-username --creator @brookemonk_ --username brookmonk
 *
 * Output:
 *   New username created and assigned to account
 */

import { PublicClient, SessionClient, evmAddress } from '@lens-protocol/client';
import { canCreateUsername, createUsername, fetchAccount } from '@lens-protocol/client/actions';
import { testnet } from '@lens-protocol/env';
import { signMessageWith } from '@lens-protocol/client/viem';
import { handleOperationWith } from '@lens-protocol/client/viem';
import { readFile } from 'fs/promises';
import { parseArgs } from 'util';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { chains } from '@lens-chain/sdk/viem';
import path from 'path';

// Parse CLI args
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    creator: { type: 'string', short: 'c' },
    username: { type: 'string', short: 'u' },
  },
});

interface LensAccountData {
  tiktokHandle: string;
  pkpEthAddress: string;
  lensHandle: string;
  lensAccountAddress: string;
  network: string;
}

// App address
const APP_ADDRESS = '0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0';

async function createNewUsername(tiktokHandle: string, localName: string): Promise<void> {
  console.log('\n📝 Step 9: Creating Additional Username');
  console.log('═══════════════════════════════════════════\n');

  const cleanHandle = tiktokHandle.replace('@', '');

  // 1. Load Lens account data
  const lensDataPath = path.join(process.cwd(), 'data', 'lens', `${cleanHandle}.json`);
  const lensDataRaw = await readFile(lensDataPath, 'utf-8');
  const lensData: LensAccountData = JSON.parse(lensDataRaw);

  console.log(`🔑 Lens Account:`);
  console.log(`   Current Handle: ${lensData.lensHandle}`);
  console.log(`   New Username: @${localName}\n`);

  // 2. Setup clients
  console.log('🔗 Setting up Lens client...');

  // Get private key from environment
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable not set');
  }

  // Create account and wallet client
  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);
  const walletClient = createWalletClient({
    account,
    chain: chains.testnet,
    transport: http(),
  });

  // Create public client
  const publicClient = PublicClient.create({
    environment: testnet,
    origin: 'https://pkp-lens-flow.local',
  });

  // Fetch account details
  console.log(`   Fetching Lens account details for: ${lensData.lensHandle}`);

  const accountResult = await fetchAccount(publicClient, {
    username: {
      localName: lensData.lensHandle.replace('@', ''),
    },
  });

  if (accountResult.isErr()) {
    throw new Error(`Could not find Lens account: ${lensData.lensHandle}`);
  }

  const lensAccountAddress = accountResult.value.address;
  console.log(`   Found account address: ${lensAccountAddress}`);

  console.log(`   Authenticating as account owner: ${account.address}`);

  // Authenticate as account owner
  const authenticated = await publicClient.login({
    accountOwner: {
      account: evmAddress(lensAccountAddress),
      owner: evmAddress(account.address),
      app: evmAddress(APP_ADDRESS),
    },
    signMessage: signMessageWith(walletClient),
  });

  if (!authenticated.isOk()) {
    throw new Error(`Authentication failed: ${authenticated.error.message}`);
  }

  const sessionClient = authenticated.value;
  console.log('✅ Authenticated with Lens\n');

  // 3. Check username availability
  console.log(`🔍 Checking username availability...`);

  const availabilityResult = await canCreateUsername(sessionClient, {
    localName: localName,
  });

  if (availabilityResult.isErr()) {
    throw new Error(`Failed to check username availability: ${availabilityResult.error}`);
  }

  const availability = availabilityResult.value;
  console.log(`   Result: ${availability.__typename}\n`);

  switch (availability.__typename) {
    case 'NamespaceOperationValidationPassed':
      console.log('✅ Username is available!\n');
      break;

    case 'NamespaceOperationValidationFailed':
      console.log(`❌ Username creation not allowed: ${availability.reason}`);
      if (availability.unsatisfiedRules) {
        console.log('   Unsatisfied rules:', JSON.stringify(availability.unsatisfiedRules, null, 2));
      }
      process.exit(1);

    case 'NamespaceOperationValidationUnknown':
      console.log('⚠️  Validation outcome unknown - extra checks required');
      console.log('   Extra checks:', JSON.stringify(availability.extraChecksRequired, null, 2));
      process.exit(1);

    case 'UsernameTaken':
      console.log('❌ Username is already taken');
      process.exit(1);

    default:
      console.log('❌ Unknown result:', availability);
      process.exit(1);
  }

  // 4. Create username
  console.log(`📝 Creating username @${localName}...`);

  const createResult = await createUsername(sessionClient, {
    username: {
      localName: localName,
    },
  })
    .andThen(handleOperationWith(walletClient))
    .andThen(sessionClient.waitForTransaction);

  if (createResult.isErr()) {
    throw new Error(`Username creation failed: ${createResult.error}`);
  }

  const txHash = createResult.value;
  console.log(`   ✅ Username created! Tx: ${txHash}\n`);

  // 5. Summary
  console.log('═══════════════════════════════════════════');
  console.log('✨ Username Created!\n');

  console.log(`📊 Details:`);
  console.log(`   Account: ${lensAccountAddress}`);
  console.log(`   Original Handle: ${lensData.lensHandle}`);
  console.log(`   New Username: @${localName}`);
  console.log(`   Full Username: lens/${localName}`);
  console.log(`   Transaction: ${txHash}\n`);
}

async function main() {
  try {
    const creator = values.creator;
    const username = values.username;

    if (!creator || !username) {
      console.error('\n❌ Error: --creator and --username arguments required\n');
      console.log('Usage: bun run create-username --creator @brookemonk_ --username brookmonk\n');
      process.exit(1);
    }

    await createNewUsername(creator, username);
    console.log('✨ Done!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
