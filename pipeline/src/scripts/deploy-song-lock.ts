#!/usr/bin/env bun
/**
 * Deploy Unlock Protocol Lock for a Song (per-track purchase)
 *
 * Deploys a one-time purchase lock on Base Sepolia (testnet) or Base (mainnet).
 * Lock owner is the app wallet (PRIVATE_KEY), not the artist.
 *
 * Usage:
 *   bun src/scripts/deploy-song-lock.ts --iswc=T0123456789
 *   bun src/scripts/deploy-song-lock.ts --spotify-id=717TY4sfgKQm4kFbYQIzgo
 *   bun src/scripts/deploy-song-lock.ts --iswc=T0123456789 --env=mainnet
 */

import { parseArgs } from 'util';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, createWalletClient, http, parseEther, encodeFunctionData } from 'viem';
import { baseSepolia, base } from 'viem/chains';
import { getArtistById, getSongByISWC, getSongBySpotifyTrackId, updateSongLock } from '../db/queries';
import { getEnvironment, getNetworkConfig, type Environment } from '../config/networks';

// Unlock Protocol addresses
const UNLOCK_ADDRESSES: Record<Environment, `0x${string}`> = {
  testnet: '0x259813B665C8f6074391028ef782e27B65840d89', // Base Sepolia
  mainnet: '0xd8c88be5e8eb88e38e6ff5ce186d764676012b0b', // Base Mainnet
};

// Lock configuration (per-song purchase)
// ~0.15 USD at $3k/ETH; adjust here if pricing changes
const LOCK_PRICE = '0.00005';
// Long-lived keys (10 years) to approximate lifetime unlock
const LOCK_DURATION_DAYS = 3650;
const LOCK_VERSION = 14;

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

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    'spotify-id': { type: 'string' },
    env: { type: 'string', default: 'testnet' },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
});

async function main() {
  const env = (values.env as Environment) || getEnvironment();
  const dryRun = values['dry-run'];
  const networkConfig = getNetworkConfig(env);

  console.log('\n🔒 Deploy Song Unlock Lock');
  console.log(`   Environment: ${env}`);
  console.log(`   Chain: ${networkConfig.unlock.chainName} (${networkConfig.unlock.chainId})`);
  console.log(`   Price: ${LOCK_PRICE} ETH (one-time)`);
  if (dryRun) console.log('   Mode: DRY RUN');

  // Find song
  let song;
  if (values.iswc) {
    song = await getSongByISWC(values.iswc);
  } else if (values['spotify-id']) {
    song = await getSongBySpotifyTrackId(values['spotify-id']);
  } else {
    console.error('\n❌ Must specify --iswc or --spotify-id');
    process.exit(1);
  }

  if (!song) {
    console.error('\n❌ Song not found');
    process.exit(1);
  }

  if (!song.artist_id) {
    console.error('\n❌ Song is missing artist_id');
    process.exit(1);
  }

  const artist = await getArtistById(song.artist_id);
  if (!artist) {
    console.error('\n❌ Artist not found for song');
    process.exit(1);
  }

  console.log(`\n🎵 Song: ${song.title}`);
  console.log(`   ISWC: ${song.iswc}`);
  console.log(`   Spotify: ${song.spotify_track_id || 'n/a'}`);
  console.log(`   Artist: ${artist.name}`);

  // Check if lock already exists
  const lockColumn = env === 'testnet' ? 'unlock_lock_address_testnet' : 'unlock_lock_address_mainnet';
  const existingLock = (song as any)[lockColumn];
  if (existingLock) {
    console.log(`\n⚠️  Lock already exists: ${existingLock}`);
    console.log('   Use a different environment or clear the lock address if redeploying');
    process.exit(0);
  }

  // Setup wallet
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey) {
    console.error('\n❌ PRIVATE_KEY not found in environment');
    process.exit(1);
  }

  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);

  console.log(`\n🔑 Deploying as: ${account.address}`);

  // Setup clients
  const chain = env === 'testnet' ? baseSepolia : base;
  const publicClient = createPublicClient({
    chain,
    transport: http(networkConfig.unlock.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(networkConfig.unlock.rpcUrl),
  });

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`   Balance: ${(Number(balance) / 1e18).toFixed(6)} ETH`);

  if (balance === 0n) {
    console.error('\n❌ Account has 0 ETH');
    if (env === 'testnet') {
      console.log('   Get Base Sepolia ETH: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet');
    }
    process.exit(1);
  }

  if (dryRun) {
    console.log('\n✅ Dry run complete - would deploy lock');
    process.exit(0);
  }

  // Prepare lock parameters
  const lockName = `${song.title} – ${artist.name}`;
  const expirationDuration = BigInt(60 * 60 * 24 * LOCK_DURATION_DAYS);
  const tokenAddress = '0x0000000000000000000000000000000000000000'; // Native ETH
  const keyPrice = parseEther(LOCK_PRICE);
  const maxNumberOfKeys = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

  console.log(`\n💰 Deploying lock...`);
  console.log(`   Name: ${lockName}`);
  console.log(`   Beneficiary: ${account.address}`);

  // Encode initialize calldata
  const initializeCalldata = encodeFunctionData({
    abi: PUBLIC_LOCK_ABI,
    functionName: 'initialize',
    args: [
      account.address,
      expirationDuration,
      tokenAddress,
      keyPrice,
      maxNumberOfKeys,
      lockName,
    ],
  });

  // Deploy lock via Unlock factory
  const unlockAddress = UNLOCK_ADDRESSES[env];
  const hash = await walletClient.writeContract({
    address: unlockAddress,
    abi: UNLOCK_ABI,
    functionName: 'createUpgradeableLockAtVersion',
    args: [initializeCalldata, LOCK_VERSION],
  });

  console.log(`   TX: ${hash}`);
  console.log(`   Waiting for confirmation...`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    console.error('\n❌ Transaction failed');
    process.exit(1);
  }

  // Extract lock address from NewLock event
  // Event signature: NewLock(address indexed lockOwner, address indexed newLockAddress)
  const newLockLog = receipt.logs.find(
    (log) => log.topics[0] === '0x01017ed19df0c7f8acc436147b234b09664a9fb4797b4fa3fb9e599c2eb67be7'
  );

  if (!newLockLog || !newLockLog.topics[2]) {
    console.error('\n❌ Could not find lock address in logs');
    process.exit(1);
  }

  const lockAddress = `0x${newLockLog.topics[2].slice(26)}`;

  console.log(`\n✅ Lock deployed: ${lockAddress}`);

  const explorerBase = env === 'testnet' ? 'https://sepolia.basescan.org' : 'https://basescan.org';
  console.log(`   Explorer: ${explorerBase}/address/${lockAddress}`);

  // Update database
  console.log(`\n💾 Updating database...`);
  await updateSongLock(song.iswc, env, lockAddress);

  console.log(`\n✅ Done!`);
  console.log(`   Song: ${song.title}`);
  console.log(`   Lock: ${lockAddress}`);
  console.log(`   Environment: ${env}`);
  console.log('\nNext: run bun src/scripts/sync-lock-config.ts to refresh frontend config.');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
