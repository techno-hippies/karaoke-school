#!/usr/bin/env bun
/**
 * Test script to create a Lens account with kschool2 namespace
 *
 * This script creates a test account to verify:
 * 1. Custom namespace (kschool2) is working
 * 2. Gas sponsorship is enabled (no gas fees)
 * 3. CLI account creation works end-to-end
 *
 * Usage:
 *   bun src/scripts/test-kschool2-namespace.ts
 */

import { createLensService } from '../services/lens-protocol';

async function main() {
  console.log('🧪 Testing kschool2 namespace account creation...\n');

  // Create a test PKP address (using a dummy address for testing)
  // In production, this would come from the pkp_accounts table
  const testPkpAddress = '0x0000000000000000000000000000000000000001' as `0x${string}`;

  const lensService = createLensService();

  try {
    // Create test account with kschool2 namespace
    const testHandle = `test-artist-${Date.now().toString(36)}`;

    console.log(`📝 Creating account with handle: ${testHandle}`);
    console.log(`   PKP Address: ${testPkpAddress}`);
    console.log(`   Expected namespace: kschool2\n`);

    const result = await lensService.createAccount({
      handle: testHandle,
      name: 'Test Artist for kschool2',
      bio: 'Testing custom namespace with sponsorship',
      pkpAddress: testPkpAddress,
    });

    console.log('\n✅ Account created successfully!');
    console.log(`   Lens Handle: ${result.lensHandle}`);
    console.log(`   Account Address: ${result.lensAccountAddress}`);
    console.log(`   Transaction Hash: ${result.transactionHash}`);
    console.log(`   Metadata URI: ${result.metadataUri}`);

    // Verify namespace
    if (result.lensHandle.includes('/')) {
      const [namespace, localName] = result.lensHandle.split('/');
      console.log(`\n🎯 Namespace verification:`);
      console.log(`   Namespace: ${namespace}`);
      console.log(`   Local name: ${localName}`);

      if (namespace === 'kschool2') {
        console.log(`   ✅ Correct namespace (kschool2)`);
      } else {
        console.log(`   ❌ Wrong namespace (expected kschool2, got ${namespace})`);
      }
    } else {
      console.log(`\n⚠️  No namespace in handle: ${result.lensHandle}`);
      console.log(`   Expected format: kschool2/${testHandle}`);
    }

    console.log('\n💡 Check transaction on Lens explorer:');
    console.log(`   https://explorer.testnet.lens.xyz/tx/${result.transactionHash}`);
    console.log('\n   Look for "paymasterParams" in transaction data to verify sponsorship');

  } catch (error) {
    console.error('\n❌ Failed to create account:');
    console.error(error);
    process.exit(1);
  }
}

main();
