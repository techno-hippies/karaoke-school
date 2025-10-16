#!/usr/bin/env bun
/**
 * Test: Check Unlock Lock Configuration
 *
 * Verifies the deployed lock's pricing and parameters
 */

import { readFile } from 'fs/promises';
import path from 'path';
import { createPublicClient, http, formatEther } from 'viem';
import { baseSepolia } from 'viem/chains';

// PublicLock ABI (minimal for reading)
const PUBLIC_LOCK_ABI = [
  {
    inputs: [],
    name: 'keyPrice',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'expirationDuration',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'maxNumberOfKeys',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ type: 'address' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ type: 'address' }],
    name: 'getHasValidKey',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'tokenAddress',
    outputs: [{ type: 'address' }],
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

async function checkLockInfo(creator: string) {
  console.log('\n🔐 Unlock Lock Configuration Test');
  console.log('═══════════════════════════════════════════════\n');

  // 1. Load lock address
  const cleanHandle = creator.replace('@', '');
  const lensPath = path.join(process.cwd(), 'data', 'lens', `${cleanHandle}.json`);
  const lensData: LensData = JSON.parse(await readFile(lensPath, 'utf-8'));

  if (!lensData.subscriptionLock?.address) {
    throw new Error('Lock not found. Run step 2.5 first (bun run deploy-lock)');
  }

  const lockAddress = lensData.subscriptionLock.address as `0x${string}`;
  console.log(`📍 Lock Address: ${lockAddress}`);
  console.log(`   Chain: ${lensData.subscriptionLock.chain}\n`);

  // 2. Connect to Base Sepolia
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  // 3. Read lock configuration
  console.log('📖 Reading lock configuration...\n');

  const [
    keyPrice,
    expirationDuration,
    maxNumberOfKeys,
    totalSupply,
    tokenAddress,
  ] = await Promise.all([
    publicClient.readContract({
      address: lockAddress,
      abi: PUBLIC_LOCK_ABI,
      functionName: 'keyPrice',
    }),
    publicClient.readContract({
      address: lockAddress,
      abi: PUBLIC_LOCK_ABI,
      functionName: 'expirationDuration',
    }),
    publicClient.readContract({
      address: lockAddress,
      abi: PUBLIC_LOCK_ABI,
      functionName: 'maxNumberOfKeys',
    }),
    publicClient.readContract({
      address: lockAddress,
      abi: PUBLIC_LOCK_ABI,
      functionName: 'totalSupply',
    }),
    publicClient.readContract({
      address: lockAddress,
      abi: PUBLIC_LOCK_ABI,
      functionName: 'tokenAddress',
    }),
  ]);

  // 4. Display configuration
  console.log('💰 Pricing:');
  console.log(`   Price: ${formatEther(keyPrice)} ETH`);
  console.log(`   Token: ${tokenAddress === '0x0000000000000000000000000000000000000000' ? 'Native ETH' : tokenAddress}\n`);

  console.log('⏱️  Duration:');
  const durationDays = Number(expirationDuration) / (60 * 60 * 24);
  console.log(`   ${Number(expirationDuration)} seconds (${durationDays} days)\n`);

  console.log('🔢 Supply:');
  console.log(`   Max Keys: ${maxNumberOfKeys === BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') ? 'Unlimited' : maxNumberOfKeys.toString()}`);
  console.log(`   Keys Sold: ${totalSupply.toString()}\n`);

  // 5. Calculate costs
  console.log('💵 Cost Breakdown:');
  const priceInEth = formatEther(keyPrice);
  console.log(`   1 month:  ${priceInEth} ETH`);
  console.log(`   3 months: ${(parseFloat(priceInEth) * 3).toFixed(4)} ETH`);
  console.log(`   1 year:   ${(parseFloat(priceInEth) * 12).toFixed(4)} ETH\n`);

  // 6. Check specific address (if provided)
  if (process.argv.includes('--check-address')) {
    const addressIndex = process.argv.indexOf('--check-address') + 1;
    const checkAddress = process.argv[addressIndex] as `0x${string}`;

    console.log(`🔍 Checking address: ${checkAddress}\n`);

    const [balance, hasValidKey] = await Promise.all([
      publicClient.readContract({
        address: lockAddress,
        abi: PUBLIC_LOCK_ABI,
        functionName: 'balanceOf',
        args: [checkAddress],
      }),
      publicClient.readContract({
        address: lockAddress,
        abi: PUBLIC_LOCK_ABI,
        functionName: 'getHasValidKey',
        args: [checkAddress],
      }),
    ]);

    console.log(`   Keys Owned: ${balance.toString()}`);
    console.log(`   Has Valid Key: ${hasValidKey ? '✅ Yes' : '❌ No'}\n`);
  }

  // 7. View on block explorer
  console.log('🔗 View on BaseScan:');
  console.log(`   https://sepolia.basescan.org/address/${lockAddress}\n`);

  console.log('📱 Next Steps:');
  console.log('   • Purchase a test key: bun run test/purchase-key.ts --creator @handle');
  console.log('   • Check if address has key: bun run test/unlock-lock-info.ts @handle --check-address 0x...\n');
}

async function main() {
  const creator = process.argv[2];

  if (!creator) {
    console.error('\n❌ Error: Creator argument required\n');
    console.log('Usage: bun run test/unlock-lock-info.ts @charlidamelio\n');
    console.log('Options:');
    console.log('  --check-address 0x... : Check if an address has a valid key\n');
    process.exit(1);
  }

  await checkLockInfo(creator);
  console.log('✨ Done!\n');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  console.error(error);
  process.exit(1);
});
