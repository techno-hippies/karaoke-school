#!/usr/bin/env bun
/**
 * Generate a test account for subscription testing
 * This creates a new wallet that's NOT the master EOA
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { writeFile } from 'fs/promises';
import path from 'path';

async function generateTestAccount() {
  console.log('\n🔑 Generating Test Account');
  console.log('═══════════════════════════════════════════════\n');

  // Generate new private key
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  console.log('✅ Test account generated!\n');
  console.log('📍 Address:');
  console.log(`   ${account.address}\n`);
  console.log('🔐 Private Key:');
  console.log(`   ${privateKey}\n`);

  // Save to file
  const testAccountPath = path.join(process.cwd(), 'test', 'test-account.json');
  const accountData = {
    address: account.address,
    privateKey: privateKey,
    createdAt: new Date().toISOString(),
    purpose: 'Testing subscription purchase and content decryption',
  };

  await writeFile(testAccountPath, JSON.stringify(accountData, null, 2));
  console.log('💾 Saved to: test/test-account.json\n');

  console.log('⚠️  IMPORTANT: Add to .gitignore!\n');

  console.log('📱 Next Steps:');
  console.log('   1. Send Base Sepolia ETH to this address:');
  console.log(`      ${account.address}`);
  console.log('   2. Get testnet ETH: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet');
  console.log('   3. Purchase key: bun run test:purchase-key @charlidamelio');
  console.log('   4. Decrypt video: bun run test:decrypt-video @charlidamelio\n');
}

generateTestAccount().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
