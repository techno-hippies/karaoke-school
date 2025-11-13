#!/usr/bin/env bun
/**
 * Test PKP-signed Lens account creation with kschool2 namespace
 *
 * This script:
 * 1. Fetches a real PKP from the database
 * 2. Creates a PKP wallet client via Lit Protocol
 * 3. Uses the PKP to sign Lens account creation
 * 4. Verifies the transaction is sponsored (PKP has no gas)
 *
 * Usage:
 *   bun src/scripts/test-pkp-lens-account.ts
 */

import { createLitService } from '../services/lit-protocol';
import { createLensService } from '../services/lens-protocol';
import { query } from '../db/connection';

async function main() {
  console.log('🧪 Testing PKP-signed Lens account creation with kschool2 namespace...\n');

  // 1. Fetch a real PKP from database
  console.log('📊 Fetching PKP from database...');
  const pkpRows = await query(
    `SELECT pkp_address, pkp_public_key, pkp_token_id, spotify_artist_id
     FROM pkp_accounts
     WHERE account_type = 'artist'
       AND spotify_artist_id IS NOT NULL
     LIMIT 1`
  );

  if (pkpRows.length === 0) {
    console.error('❌ No PKPs found in database');
    process.exit(1);
  }

  const pkp = pkpRows[0];
  console.log(`✓ Found PKP for artist: ${pkp.spotify_artist_id}`);
  console.log(`  PKP Address: ${pkp.pkp_address}`);
  console.log(`  PKP Public Key: ${pkp.pkp_public_key.substring(0, 20)}...`);

  // 2. Check PKP balance (should be zero for true sponsorship test)
  console.log('\n💰 Checking PKP balance on Lens testnet...');
  const { createPublicClient, http } = await import('viem');
  const publicClient = createPublicClient({
    chain: {
      id: 37111,
      name: 'Lens Testnet',
      nativeCurrency: { name: 'GRASS', symbol: 'GRASS', decimals: 18 },
      rpcUrls: {
        default: { http: ['https://rpc.testnet.lens.xyz'] },
      },
    },
    transport: http('https://rpc.testnet.lens.xyz'),
  });

  const balance = await publicClient.getBalance({ address: pkp.pkp_address as `0x${string}` });
  console.log(`  Balance: ${balance} wei (${Number(balance) / 1e18} GRASS)`);

  if (balance > 0n) {
    console.warn(`  ⚠️  PKP has gas! This won't prove sponsorship works`);
    console.warn(`  ⚠️  For a true test, PKP should have 0 balance`);
  } else {
    console.log(`  ✓ PKP has zero balance - perfect for sponsorship test!`);
  }

  // 3. Create PKP wallet client via Lit
  console.log('\n🔐 Creating PKP wallet client via Lit Protocol...');
  const litService = createLitService();

  const { chains } = await import('@lens-chain/sdk/viem');
  const pkpWalletClient = await litService.createPKPWalletClient(
    pkp.pkp_public_key,
    pkp.pkp_token_id,
    chains.testnet
  );

  console.log(`  ✓ PKP wallet client created`);
  console.log(`  ✓ Wallet address: ${pkpWalletClient.account.address}`);

  // 4. Create Lens account with PKP signing
  console.log('\n📝 Creating Lens account with PKP signature...');
  const lensService = createLensService();

  const testHandle = `pkp-test-${Date.now().toString(36)}`;
  console.log(`  Handle: ${testHandle}`);

  try {
    const result = await lensService.createAccount({
      handle: testHandle,
      name: `PKP Test ${Date.now()}`,
      bio: 'Testing PKP-signed Lens account with kschool2 namespace',
      pkpAddress: pkp.pkp_address as `0x${string}`,
      walletClient: pkpWalletClient,  // Use PKP wallet, not EOA!
    });

    console.log('\n✅ SUCCESS! PKP-signed account created!');
    console.log(`  Lens Handle: ${result.lensHandle}`);
    console.log(`  Account Address: ${result.lensAccountAddress}`);
    console.log(`  Transaction Hash: ${result.transactionHash}`);
    console.log(`  Metadata URI: ${result.metadataUri}`);

    // 5. Verify transaction details
    console.log('\n🔍 Verifying transaction...');
    const tx = await publicClient.getTransaction({ hash: result.transactionHash });

    console.log(`  From: ${tx.from}`);
    console.log(`  Expected PKP: ${pkp.pkp_address}`);

    if (tx.from.toLowerCase() === pkp.pkp_address.toLowerCase()) {
      console.log(`  ✅ Transaction FROM matches PKP address!`);
    } else {
      console.log(`  ❌ Transaction FROM does NOT match PKP!`);
      console.log(`  This means the EOA signed, not the PKP`);
    }

    // Check for sponsorship indicators
    const txReceipt = await publicClient.getTransactionReceipt({ hash: result.transactionHash });
    console.log(`\n  Gas used: ${txReceipt.gasUsed}`);
    console.log(`  Effective gas price: ${txReceipt.effectiveGasPrice}`);

    // Check PKP balance after (should still be zero if sponsored)
    const balanceAfter = await publicClient.getBalance({ address: pkp.pkp_address as `0x${string}` });
    console.log(`\n  PKP balance after: ${balanceAfter} wei`);

    if (balanceAfter === balance) {
      console.log(`  ✅ PKP balance unchanged - TRANSACTION WAS SPONSORED!`);
    } else {
      console.log(`  ❌ PKP balance changed - transaction was NOT sponsored`);
    }

    console.log('\n💡 View on Lens Explorer:');
    console.log(`  https://explorer.testnet.lens.xyz/tx/${result.transactionHash}`);

  } catch (error) {
    console.error('\n❌ Failed to create account:');
    console.error(error);
    process.exit(1);
  }
}

main();
