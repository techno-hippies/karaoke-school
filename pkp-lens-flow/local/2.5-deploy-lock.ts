#!/usr/bin/env bun
/**
 * Step 2.5: Deploy Unlock Lock and Update Lens Metadata
 *
 * Deploys an Unlock Protocol subscription lock on Base Sepolia and
 * updates the Lens account metadata to include the lock address.
 *
 * Prerequisites:
 * - PKP data in data/pkps/{handle}.json
 * - Lens account data in data/lens/{handle}.json
 * - PRIVATE_KEY in .env (master EOA, will manage the lock)
 *
 * Usage:
 *   bun run local/2.5-deploy-lock.ts --creator @charlidamelio
 *
 * Output:
 *   - Deploys Unlock lock on Base Sepolia
 *   - Updates Lens account metadata with lock address
 *   - Updates data/lens/{handle}.json with lock info
 */

import { readFile, writeFile } from 'fs/promises';
import { parseArgs } from 'util';
import path from 'path';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, createWalletClient, http, parseEther, encodeFunctionData } from 'viem';
import { baseSepolia } from 'viem/chains';
import { PublicClient, evmAddress } from '@lens-protocol/client';
import { testnet } from '@lens-protocol/env';
import { chains } from '@lens-chain/sdk/viem';
import { signMessageWith } from '@lens-protocol/client/viem';
import { StorageClient, immutable } from '@lens-chain/storage-client';
import { account as accountMetadata, MetadataAttributeType } from '@lens-protocol/metadata';

// Unlock Protocol contract addresses on Base Sepolia
const UNLOCK_ADDRESS = '0x259813B665C8f6074391028ef782e27B65840d89'; // Unlock v13 on Base Sepolia

// PublicLock ABI (v14) - minimal interface for createUpgradeableLockAtVersion
const UNLOCK_ABI = [
  {
    inputs: [
      { internalType: 'bytes', name: 'data', type: 'bytes' },
      { internalType: 'uint16', name: 'version', type: 'uint16' },
    ],
    name: 'createUpgradeableLockAtVersion',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// PublicLock initialize function signature
const PUBLIC_LOCK_ABI = [
  {
    inputs: [
      { internalType: 'address payable', name: '_lockCreator', type: 'address' },
      { internalType: 'uint256', name: '_expirationDuration', type: 'uint256' },
      { internalType: 'address', name: '_tokenAddress', type: 'address' },
      { internalType: 'uint256', name: '_keyPrice', type: 'uint256' },
      { internalType: 'uint256', name: '_maxNumberOfKeys', type: 'uint256' },
      { internalType: 'string', name: '_lockName', type: 'string' },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

interface PKPData {
  tiktokHandle: string;
  pkpPublicKey: string;
  pkpEthAddress: string;
  pkpTokenId: string;
  ownerEOA: string;
  network: string;
  mintedAt: string;
  transactionHash?: string;
}

interface LensAccountData {
  tiktokHandle: string;
  pkpEthAddress: string;
  lensHandle: string;
  lensAccountAddress: string;
  lensAccountId: string;
  network: string;
  createdAt: string;
  transactionHash?: string;
  metadataUri?: string;
  subscriptionLock?: {
    address: string;
    chain: string;
    deployedAt: string;
    transactionHash: string;
  };
}

// Parse CLI args
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    creator: { type: 'string', short: 'c' },
  },
});

async function deployLockAndUpdateMetadata(tiktokHandle: string): Promise<void> {
  console.log('\n🔒 Step 2.5: Deploy Unlock Lock & Update Lens Metadata');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Load PKP and Lens account data
  const cleanHandle = tiktokHandle.replace('@', '');
  const pkpPath = path.join(process.cwd(), 'data', 'pkps', `${cleanHandle}.json`);
  const lensPath = path.join(process.cwd(), 'data', 'lens', `${cleanHandle}.json`);

  console.log(`📂 Loading data...`);
  const pkpData: PKPData = JSON.parse(await readFile(pkpPath, 'utf-8'));
  const lensData: LensAccountData = JSON.parse(await readFile(lensPath, 'utf-8'));

  console.log(`✅ Loaded data for ${tiktokHandle}`);
  console.log(`   PKP Address: ${pkpData.pkpEthAddress}`);
  console.log(`   Lens Handle: ${lensData.lensHandle}`);
  console.log(`   Lens Account: ${lensData.lensAccountAddress}\n`);

  // 2. Setup master EOA wallet
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not found in .env');
  }

  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const masterAccount = privateKeyToAccount(formattedKey);

  console.log(`🔑 Master EOA: ${masterAccount.address}`);
  console.log(`   (This wallet will manage the lock and receive payments)\n`);

  // 3. Setup Base Sepolia clients
  console.log('🔗 Connecting to Base Sepolia...');
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account: masterAccount,
    chain: baseSepolia,
    transport: http(),
  });

  // Check balance
  const balance = await publicClient.getBalance({ address: masterAccount.address });
  console.log(`✅ Connected to Base Sepolia`);
  console.log(`   Balance: ${(Number(balance) / 1e18).toFixed(6)} ETH\n`);

  if (balance === 0n) {
    console.log('⚠️  Warning: Account has 0 ETH. You may need Base Sepolia testnet ETH.');
    console.log('   Get testnet ETH from: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet\n');
  }

  // 4. Prepare lock deployment parameters
  console.log('📝 Preparing lock parameters...');
  const lockName = `${cleanHandle} TikTok Subscription`;
  const expirationDuration = 60n * 60n * 24n * 30n; // 30 days in seconds

  // Use USDC on Base Sepolia instead of native ETH
  const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC
  const tokenAddress = USDC_ADDRESS;

  // USDC has 6 decimals, so 1.99 USDC = 1,990,000
  const keyPrice = 1_990_000n; // 1.99 USDC per month
  const maxNumberOfKeys = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'); // Unlimited

  console.log(`   Lock Name: ${lockName}`);
  console.log(`   Duration: 30 days`);
  console.log(`   Price: 1.99 USDC/month`);
  console.log(`   Payment Token: USDC (${USDC_ADDRESS})`);
  console.log(`   Max Keys: Unlimited`);
  console.log(`   Beneficiary: ${masterAccount.address}\n`);

  // 5. Encode initialize calldata
  const initializeCalldata = encodeFunctionData({
    abi: PUBLIC_LOCK_ABI,
    functionName: 'initialize',
    args: [
      masterAccount.address, // _lockCreator (beneficiary)
      expirationDuration,
      tokenAddress,
      keyPrice,
      maxNumberOfKeys,
      lockName,
    ],
  });

  // 6. Deploy lock
  console.log('🚀 Deploying Unlock lock...');
  console.log(`   This will deploy a new ERC721 subscription lock on Base Sepolia\n`);

  try {
    const hash = await walletClient.writeContract({
      address: UNLOCK_ADDRESS,
      abi: UNLOCK_ABI,
      functionName: 'createUpgradeableLockAtVersion',
      args: [initializeCalldata, 14], // Version 14 (latest)
    });

    console.log(`📝 Transaction submitted: ${hash}`);
    console.log('   Waiting for confirmation...\n');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
      throw new Error('Transaction failed');
    }

    // Extract lock address from logs
    // The Unlock contract emits NewLock(address indexed lockOwner, address indexed newLockAddress)
    // topics[0] = event signature
    // topics[1] = lockOwner (indexed)
    // topics[2] = newLockAddress (indexed) <- This is what we want!
    const newLockLog = receipt.logs.find((log) => log.topics[0] === '0x01017ed19df0c7f8acc436147b234b09664a9fb4797b4fa3fb9e599c2eb67be7');

    if (!newLockLog || !newLockLog.topics[2]) {
      throw new Error('Could not find lock address in transaction logs');
    }

    // The lock address is in the third topic (second indexed parameter)
    const lockAddress = `0x${newLockLog.topics[2].slice(26)}` as `0x${string}`;

    console.log('✅ Lock deployed successfully!');
    console.log(`   Lock Address: ${lockAddress}`);
    console.log(`   Transaction: ${hash}`);
    console.log(`   Block: ${receipt.blockNumber}\n`);

    // 7. Update Lens account metadata
    console.log('📝 Updating Lens account metadata with lock address...\n');

    // 7a. Login to Lens
    const lensClient = PublicClient.create({
      environment: testnet,
      origin: 'http://localhost:3000',
    });

    const lensWalletClient = createWalletClient({
      account: masterAccount,
      chain: chains.testnet,
      transport: http(),
    });

    const appAddress = '0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0';

    console.log('🔐 Authenticating with Lens Protocol...');
    const authenticated = await lensClient.login({
      onboardingUser: {
        app: evmAddress(appAddress),
        wallet: evmAddress(masterAccount.address),
      },
      signMessage: signMessageWith(lensWalletClient),
    });

    if (authenticated.isErr()) {
      throw new Error(`Lens login failed: ${authenticated.error.message}`);
    }

    console.log('✅ Authenticated with Lens\n');
    const sessionClient = authenticated.value;

    // 7b. Fetch current metadata (if it exists)
    console.log('📥 Fetching current account metadata from Grove...');

    // For now, we'll create new metadata with the lock info
    // In a real scenario, you'd fetch the existing metadata and merge it
    const updatedMetadata = accountMetadata({
      name: `${cleanHandle} (TikTok)`,
      bio: `TikTok creator ${tiktokHandle} on Lens. PKP-controlled account with subscription access.`,
      attributes: [
        {
          type: MetadataAttributeType.STRING,
          key: 'tiktok_handle',
          value: tiktokHandle,
        },
        {
          type: MetadataAttributeType.STRING,
          key: 'pkp_address',
          value: pkpData.pkpEthAddress,
        },
        {
          type: MetadataAttributeType.STRING,
          key: 'subscription_lock',
          value: lockAddress,
        },
        {
          type: MetadataAttributeType.STRING,
          key: 'subscription_chain',
          value: 'base-sepolia',
        },
        {
          type: MetadataAttributeType.STRING,
          key: 'subscription_price',
          value: '1.99',
        },
        {
          type: MetadataAttributeType.STRING,
          key: 'subscription_currency',
          value: 'ETH',
        },
        {
          type: MetadataAttributeType.STRING,
          key: 'subscription_duration',
          value: '30',
        },
      ],
    });

    // 7c. Upload new metadata to Grove
    console.log('☁️  Uploading updated metadata to Grove...');
    const storageClient = StorageClient.create();

    const uploadResult = await storageClient.uploadAsJson(updatedMetadata, {
      name: `${cleanHandle}-account-metadata-with-lock.json`,
      acl: immutable(chains.testnet.id),
    });

    console.log(`✅ Updated metadata uploaded: ${uploadResult.uri}\n`);

    // 7d. Update account metadata URI
    // Note: This requires calling setMetadataURI on the account contract
    // For now, we'll save it locally and log instructions
    console.log('⚠️  Manual Step Required:');
    console.log('   To complete the metadata update, you need to call setMetadataURI on the Lens account.');
    console.log(`   Account Address: ${lensData.lensAccountAddress}`);
    console.log(`   New Metadata URI: ${uploadResult.uri}`);
    console.log('   This will be automated in a future version.\n');

    // 8. Save updated Lens data
    const updatedLensData: LensAccountData = {
      ...lensData,
      metadataUri: uploadResult.uri,
      subscriptionLock: {
        address: lockAddress,
        chain: 'base-sepolia',
        deployedAt: new Date().toISOString(),
        transactionHash: hash,
      },
    };

    await writeFile(lensPath, JSON.stringify(updatedLensData, null, 2));
    console.log('💾 Updated Lens data saved to:', lensPath);

    // 9. Success summary
    console.log('\n✅ Deployment Complete!\n');
    console.log('📊 Summary:');
    console.log(`   TikTok: ${tiktokHandle}`);
    console.log(`   Lens Handle: ${lensData.lensHandle}`);
    console.log(`   Lock Address: ${lockAddress}`);
    console.log(`   Lock Chain: Base Sepolia`);
    console.log(`   Subscription Price: 1.99 ETH/month`);
    console.log(`   Lock Manager: ${masterAccount.address}`);
    console.log(`   Metadata URI: ${uploadResult.uri}\n`);

    console.log('🔗 View lock on block explorer:');
    console.log(`   https://sepolia.basescan.org/address/${lockAddress}\n`);

    console.log('📱 Next Steps:');
    console.log('   1. Fund the lock with some ETH if needed');
    console.log('   2. Test purchasing a key (subscription)');
    console.log('   3. Integrate with frontend for subscription flow');
    console.log('   4. Complete metadata update on Lens account\n');

  } catch (error: any) {
    console.error('\n❌ Deployment failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    const creator = values.creator;

    if (!creator) {
      console.error('\n❌ Error: --creator argument required\n');
      console.log('Usage: bun run local/2.5-deploy-lock.ts --creator @charlidamelio\n');
      process.exit(1);
    }

    await deployLockAndUpdateMetadata(creator);
    console.log('✨ Done!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
