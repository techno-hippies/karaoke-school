#!/usr/bin/env bun
/**
 * Deploy Unlock Protocol Locks
 *
 * Deploys subscription locks on Base Sepolia for artists with PKPs.
 * Payments flow to master EOA (PRIVATE_KEY).
 *
 * Usage:
 *   bun src/tasks/identity/deploy-unlock-locks.ts --type=artist --limit=1
 *   bun src/tasks/identity/deploy-unlock-locks.ts --artist=7dGJo4pcD2V6oG8kP0tJRR
 */

import { parseArgs } from 'util';
import { query } from '../../db/connection';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, createWalletClient, http, parseEther, encodeFunctionData } from 'viem';
import { baseSepolia } from 'viem/chains';

// Unlock Protocol v13 on Base Sepolia
const UNLOCK_ADDRESS = '0x259813B665C8f6074391028ef782e27B65840d89';

// Lock configuration
const LOCK_PRICE = '0.0006'; // 0.0006 ETH ≈ $1.80 at $3k ETH
const LOCK_DURATION_DAYS = 30;
const LOCK_VERSION = 14; // Latest Unlock v14

// Unlock ABI - createUpgradeableLockAtVersion
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

// PublicLock initialize function
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

interface ArtistWithPKP {
  spotify_artist_id: string;
  name: string;
  image_url: string | null;
  pkp_address: string;
  pkp_token_id: string;
}

/**
 * Find artists with PKPs but no unlock locks
 */
async function findArtistsNeedingLocks(limit: number = 20): Promise<ArtistWithPKP[]> {
  return await query<ArtistWithPKP>(
    `SELECT
      sa.spotify_artist_id,
      sa.name,
      sa.images->0->>'url' as image_url,
      pkp.pkp_address,
      pkp.pkp_token_id
    FROM spotify_artists sa
    JOIN pkp_accounts pkp ON pkp.spotify_artist_id = sa.spotify_artist_id
      AND pkp.account_type = 'artist'
    LEFT JOIN lens_accounts lens ON lens.spotify_artist_id = sa.spotify_artist_id
      AND lens.account_type = 'artist'
    WHERE lens.subscription_lock_address IS NULL
    ORDER BY sa.name
    LIMIT $1`,
    [limit]
  );
}

/**
 * Find specific artist by Spotify ID
 */
async function findArtistBySpotifyId(spotifyArtistId: string): Promise<ArtistWithPKP | null> {
  const results = await query<ArtistWithPKP>(
    `SELECT
      sa.spotify_artist_id,
      sa.name,
      sa.images->0->>'url' as image_url,
      pkp.pkp_address,
      pkp.pkp_token_id
    FROM spotify_artists sa
    JOIN pkp_accounts pkp ON pkp.spotify_artist_id = sa.spotify_artist_id
      AND pkp.account_type = 'artist'
    LEFT JOIN lens_accounts lens ON lens.spotify_artist_id = sa.spotify_artist_id
      AND lens.account_type = 'artist'
    WHERE sa.spotify_artist_id = $1
      AND lens.subscription_lock_address IS NULL`,
    [spotifyArtistId]
  );

  return results[0] || null;
}

/**
 * Deploy unlock lock for an artist
 */
async function deployLock(
  artist: ArtistWithPKP,
  masterAccount: any,
  publicClient: any,
  walletClient: any
): Promise<{
  lockAddress: string;
  transactionHash: string;
  blockNumber: bigint;
}> {
  console.log(`\n🎵 ${artist.name} (${artist.spotify_artist_id})`);
  console.log(`   PKP: ${artist.pkp_address}`);

  // Prepare lock parameters
  const lockName = `${artist.name} Subscription`;
  const expirationDuration = BigInt(60 * 60 * 24 * LOCK_DURATION_DAYS); // 30 days in seconds
  const tokenAddress = '0x0000000000000000000000000000000000000000'; // Native ETH
  const keyPrice = parseEther(LOCK_PRICE);
  const maxNumberOfKeys = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'); // Unlimited

  console.log(`   💰 Deploying lock...`);
  console.log(`      Price: ${LOCK_PRICE} ETH/month`);
  console.log(`      Duration: ${LOCK_DURATION_DAYS} days`);
  console.log(`      Beneficiary: ${masterAccount.address} (Master EOA)`);

  // Encode initialize calldata
  const initializeCalldata = encodeFunctionData({
    abi: PUBLIC_LOCK_ABI,
    functionName: 'initialize',
    args: [
      masterAccount.address, // Beneficiary (master EOA receives payments)
      expirationDuration,
      tokenAddress,
      keyPrice,
      maxNumberOfKeys,
      lockName,
    ],
  });

  // Deploy lock via Unlock factory
  const hash = await walletClient.writeContract({
    address: UNLOCK_ADDRESS,
    abi: UNLOCK_ABI,
    functionName: 'createUpgradeableLockAtVersion',
    args: [initializeCalldata, LOCK_VERSION],
  });

  console.log(`   📝 TX: ${hash}`);
  console.log(`   ⏳ Waiting for confirmation...`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(`Transaction failed for ${artist.name}`);
  }

  // Extract lock address from NewLock event
  // Event signature: NewLock(address indexed lockOwner, address indexed newLockAddress)
  const newLockLog = receipt.logs.find(
    (log) => log.topics[0] === '0x01017ed19df0c7f8acc436147b234b09664a9fb4797b4fa3fb9e599c2eb67be7'
  );

  if (!newLockLog || !newLockLog.topics[2]) {
    throw new Error(`Could not find lock address in logs for ${artist.name}`);
  }

  const lockAddress = `0x${newLockLog.topics[2].slice(26)}`;

  console.log(`   ✓ Lock deployed: ${lockAddress}`);
  console.log(`   🔗 https://sepolia.basescan.org/address/${lockAddress}`);

  return {
    lockAddress,
    transactionHash: hash,
    blockNumber: receipt.blockNumber,
  };
}

/**
 * Update database with lock info
 */
async function updateLockInfo(
  spotifyArtistId: string,
  lockAddress: string,
  transactionHash: string
): Promise<void> {
  await query(
    `UPDATE lens_accounts
    SET
      subscription_lock_address = $1,
      subscription_lock_chain = 'baseSepolia',
      subscription_lock_price = $2,
      subscription_lock_currency = 'ETH',
      subscription_lock_duration_days = $3,
      subscription_lock_deployed_at = NOW(),
      subscription_lock_tx_hash = $4,
      updated_at = NOW()
    WHERE spotify_artist_id = $5
      AND account_type = 'artist'`,
    [lockAddress, LOCK_PRICE, LOCK_DURATION_DAYS, transactionHash, spotifyArtistId]
  );
}

/**
 * Main execution
 */
async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      type: { type: 'string', default: 'artist' },
      limit: { type: 'string', default: '20' },
      artist: { type: 'string' },
    },
  });

  const limit = parseInt(values.limit || '20');
  const specificArtist = values.artist;

  console.log('\n🔒 Unlock Lock Deployment Task');
  console.log(`Mode: ${specificArtist ? `specific (${specificArtist})` : 'artist'}, Limit: ${limit}`);
  console.log(`Network: Base Sepolia`);
  console.log(`Lock Price: ${LOCK_PRICE} ETH/${LOCK_DURATION_DAYS} days\n`);

  // Setup master EOA
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not found in .env');
  }

  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const masterAccount = privateKeyToAccount(formattedKey);

  console.log(`🔑 Master EOA: ${masterAccount.address}`);
  console.log(`   (Receives subscription payments)\n`);

  // Setup Base Sepolia clients
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
  console.log(`💰 Balance: ${(Number(balance) / 1e18).toFixed(6)} ETH\n`);

  if (balance === 0n) {
    console.log('⚠️  Warning: Account has 0 ETH');
    console.log('   Get Base Sepolia ETH: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet\n');
    return;
  }

  // Find artists needing locks
  const artists = specificArtist
    ? [await findArtistBySpotifyId(specificArtist)].filter(Boolean) as ArtistWithPKP[]
    : await findArtistsNeedingLocks(limit);

  if (artists.length === 0) {
    console.log('✓ No artists need lock deployment\n');
    return;
  }

  console.log(`Found ${artists.length} artists ready for lock deployment\n`);

  // Deploy locks
  let successCount = 0;
  let failCount = 0;

  for (const artist of artists) {
    try {
      const { lockAddress, transactionHash } = await deployLock(
        artist,
        masterAccount,
        publicClient,
        walletClient
      );

      await updateLockInfo(artist.spotify_artist_id, lockAddress, transactionHash);
      successCount++;
    } catch (error: any) {
      console.log(`   ✗ Failed: ${error.message}`);
      failCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ Lock Deployment Complete');
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Total Locks: ${successCount}`);
  console.log('='.repeat(60) + '\n');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
