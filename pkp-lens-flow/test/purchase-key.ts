#!/usr/bin/env bun
/**
 * Test: Purchase Unlock Subscription Key
 *
 * Purchases a test subscription key to verify the full flow
 */

import { readFile } from 'fs/promises';
import path from 'path';
import { createPublicClient, createWalletClient, http, formatEther, parseEther } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// PublicLock ABI (minimal for purchasing)
const PUBLIC_LOCK_ABI = [
  {
    inputs: [],
    name: 'keyPrice',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { type: 'uint256[]', name: '_values' },
      { type: 'address[]', name: '_recipients' },
      { type: 'address[]', name: '_referrers' },
      { type: 'address[]', name: '_keyManagers' },
      { type: 'bytes[]', name: '_data' },
    ],
    name: 'purchase',
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ type: 'address' }],
    name: 'getHasValidKey',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

interface LensData {
  subscriptionLock?: {
    address: string;
    chain: string;
  };
}

async function purchaseKey(creator: string) {
  console.log('\n💳 Purchase Unlock Subscription Key');
  console.log('═══════════════════════════════════════════════\n');

  // 1. Load lock address
  const cleanHandle = creator.replace('@', '');
  const lensPath = path.join(process.cwd(), 'data', 'lens', `${cleanHandle}.json`);
  const lensData: LensData = JSON.parse(await readFile(lensPath, 'utf-8'));

  if (!lensData.subscriptionLock?.address) {
    throw new Error('Lock not found. Run step 2.5 first (bun run deploy-lock)');
  }

  const lockAddress = lensData.subscriptionLock.address as `0x${string}`;
  console.log(`📍 Lock Address: ${lockAddress}\n`);

  // 2. Setup buyer account (use test account, NOT master EOA)
  const testAccountPath = path.join(process.cwd(), 'test', 'test-account.json');
  let buyerAccount;

  try {
    const testAccountData = JSON.parse(await readFile(testAccountPath, 'utf-8'));
    const privateKey = testAccountData.privateKey as `0x${string}`;
    buyerAccount = privateKeyToAccount(privateKey);
    console.log(`👤 Test Buyer: ${buyerAccount.address}`);
    console.log(`   (Using test account, NOT master EOA)\n`);
  } catch (error) {
    console.error('❌ Test account not found!\n');
    console.log('Generate test account first:');
    console.log('   bun run test/generate-test-account.ts\n');
    throw new Error('Test account required');
  }

  // 3. Connect to Base Sepolia
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account: buyerAccount,
    chain: baseSepolia,
    transport: http(),
  });

  // 4. Check balance
  const balance = await publicClient.getBalance({ address: buyerAccount.address });
  console.log(`💰 Buyer Balance: ${formatEther(balance)} ETH\n`);

  // 5. Get key price
  const keyPrice = await publicClient.readContract({
    address: lockAddress,
    abi: PUBLIC_LOCK_ABI,
    functionName: 'keyPrice',
  });

  console.log(`💵 Key Price: ${formatEther(keyPrice)} ETH\n`);

  if (balance < keyPrice) {
    console.log('❌ Insufficient balance!\n');
    console.log('Get Base Sepolia testnet ETH from:');
    console.log('   https://www.coinbase.com/faucets/base-ethereum-goerli-faucet\n');
    process.exit(1);
  }

  // 6. Check if already has valid key
  const hasValidKey = await publicClient.readContract({
    address: lockAddress,
    abi: PUBLIC_LOCK_ABI,
    functionName: 'getHasValidKey',
    args: [buyerAccount.address],
  });

  if (hasValidKey) {
    console.log('✅ You already have a valid key!\n');
    return;
  }

  console.log('🛒 Purchasing subscription key...\n');

  // 7. Purchase key
  // purchase(uint256[] _values, address[] _recipients, address[] _referrers, address[] _keyManagers, bytes[] _data)
  try {
    const hash = await walletClient.writeContract({
      address: lockAddress,
      abi: PUBLIC_LOCK_ABI,
      functionName: 'purchase',
      args: [
        [keyPrice], // _values (array of prices)
        [buyerAccount.address], // _recipients (who receives the key)
        [buyerAccount.address], // _referrers (no referrer)
        [buyerAccount.address], // _keyManagers (who can manage the key)
        ['0x'], // _data (no extra data)
      ],
      value: keyPrice, // Payment amount
    });

    console.log(`📝 Transaction submitted: ${hash}`);
    console.log('   Waiting for confirmation...\n');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
      throw new Error('Transaction failed');
    }

    console.log('✅ Key purchased successfully!\n');
    console.log(`   Transaction: ${hash}`);
    console.log(`   Block: ${receipt.blockNumber}\n`);

    // 8. Verify key ownership
    const hasKeyNow = await publicClient.readContract({
      address: lockAddress,
      abi: PUBLIC_LOCK_ABI,
      functionName: 'getHasValidKey',
      args: [buyerAccount.address],
    });

    console.log('🔍 Verification:');
    console.log(`   Has Valid Key: ${hasKeyNow ? '✅ Yes' : '❌ No'}\n`);

    if (!hasKeyNow) {
      throw new Error('Key purchase succeeded but verification failed!');
    }

    console.log('🎉 Success! You now have access to encrypted content.\n');
    console.log('📱 Next Steps:');
    console.log('   • Test decryption: bun run test/decrypt-video.ts --creator @handle');
    console.log(`   • View on BaseScan: https://sepolia.basescan.org/tx/${hash}\n`);

  } catch (error: any) {
    console.error('❌ Purchase failed:', error.message);
    throw error;
  }
}

async function main() {
  const creator = process.argv[2];

  if (!creator) {
    console.error('\n❌ Error: Creator argument required\n');
    console.log('Usage: bun run test/purchase-key.ts @charlidamelio\n');
    process.exit(1);
  }

  await purchaseKey(creator);
  console.log('✨ Done!\n');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  console.error(error);
  process.exit(1);
});
