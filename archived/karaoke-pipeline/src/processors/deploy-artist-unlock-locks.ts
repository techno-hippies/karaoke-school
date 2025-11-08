#!/usr/bin/env bun
/**
 * Deploy Unlock Protocol Subscription Locks
 *
 * Deploys Unlock Protocol subscription locks on Base Sepolia for artists with PKP+Lens accounts.
 * 
 * IMPORTANT: This is ARTISTS ONLY (spotify_artist_id required). TikTok creators do NOT get locks.
 * 
 * Prerequisites:
 *   - Artist exists in spotify_artists
 *   - Artist has PKP account (pkp_accounts.spotify_artist_id IS NOT NULL)
 *   - Artist has Lens account (lens_accounts.spotify_artist_id IS NOT NULL)
 *   - Artist has no lock deployed yet (lens_accounts.subscription_lock_address IS NULL)
 *   - PRIVATE_KEY env var set (master EOA that manages locks and receives payments)
 *
 * Process:
 *   1. Query artists with PKP+Lens but no lock
 *   2. Deploy Unlock Protocol lock on Base Sepolia
 *   3. Update Lens metadata to include lock address
 *   4. Store lock info in lens_accounts table
 *
 * Lock Configuration:
 *   - Price: $1.99 ETH/month (fixed)
 *   - Duration: 30 days
 *   - Payment: Native ETH
 *   - Chain: Base Sepolia (testnet)
 *   - Beneficiary: Artist's PKP address (receives payments directly)
 *
 * Usage:
 *   bun src/processors/deploy-artist-unlock-locks.ts --limit=5
 *   bun src/processors/deploy-artist-unlock-locks.ts --artist=3TVXtAsR1Inumwj472S9r4  # Specific artist
 */

import { parseArgs } from 'util';
import { query } from '../db/neon';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  encodeFunctionData,
  type Address,
  type Hash,
} from 'viem';
import { baseSepolia } from 'viem/chains';

// Unlock Protocol contract on Base Sepolia
const UNLOCK_ADDRESS = '0x259813B665C8f6074391028ef782e27B65840d89' as const;

// Unlock Protocol ABI (minimal interface)
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

interface ArtistWithAccounts {
  spotify_artist_id: string;
  artist_name: string;
  pkp_address: string;
  pkp_id: number;
  lens_id: number;
  lens_handle: string;
  lens_account_address: string;
  lens_metadata_uri: string;
}

interface DeployedLock {
  lockAddress: Address;
  transactionHash: Hash;
  blockNumber: bigint;
}

async function deployLock(
  artistName: string,
  artistPkpAddress: string,
  masterAccount: ReturnType<typeof privateKeyToAccount>,
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>
): Promise<DeployedLock> {
  // Lock configuration
  const lockName = `${artistName} Subscription`;
  const expirationDuration = 60n * 60n * 24n * 30n; // 30 days in seconds
  const tokenAddress = '0x0000000000000000000000000000000000000000'; // Native ETH
  const keyPrice = parseEther('1.99'); // $1.99 ETH per month
  const maxNumberOfKeys = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'); // Unlimited

  console.log(`      📝 Lock: "${lockName}"`);
  console.log(`      💰 Price: 1.99 ETH/month`);
  console.log(`      ⏱️  Duration: 30 days`);
  console.log(`      🔑 Max Keys: Unlimited`);
  console.log(`      💸 Beneficiary: ${artistPkpAddress} (Artist PKP)`);

  // Encode initialize calldata
  const initializeCalldata = encodeFunctionData({
    abi: PUBLIC_LOCK_ABI,
    functionName: 'initialize',
    args: [
      artistPkpAddress as Address, // Artist's PKP receives payments
      expirationDuration,
      tokenAddress,
      keyPrice,
      maxNumberOfKeys,
      lockName,
    ],
  });

  // Deploy lock
  console.log('      🚀 Deploying lock...');
  const hash = await walletClient.writeContract({
    address: UNLOCK_ADDRESS,
    abi: UNLOCK_ABI,
    functionName: 'createUpgradeableLockAtVersion',
    args: [initializeCalldata, 14], // Version 14 (latest)
  });

  console.log(`      📝 TX: ${hash}`);
  console.log('      ⏳ Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error('Transaction failed');
  }

  // Extract lock address from NewLock event logs
  // NewLock(address indexed lockOwner, address indexed newLockAddress)
  const newLockLog = receipt.logs.find(
    (log) => log.topics[0] === '0x01017ed19df0c7f8acc436147b234b09664a9fb4797b4fa3fb9e599c2eb67be7'
  );

  if (!newLockLog || !newLockLog.topics[2]) {
    throw new Error('Could not find lock address in transaction logs');
  }

  // Lock address is in the third topic (second indexed parameter)
  const lockAddress = `0x${newLockLog.topics[2].slice(26)}` as Address;

  return {
    lockAddress,
    transactionHash: hash,
    blockNumber: receipt.blockNumber,
  };
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      limit: { type: 'string', default: '5' },
      artist: { type: 'string' }, // Specific Spotify artist ID
    },
  });

  const limit = parseInt(values.limit || '5');
  const targetArtistId = values.artist;

  console.log(`\n🔒 Deploying Unlock Protocol Locks (Base Sepolia)`);
  console.log(`   Artists only (Spotify ID required) - TikTok creators excluded\n`);

  // Check for master EOA private key
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not found in .env (required for lock deployment)');
  }

  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const masterAccount = privateKeyToAccount(formattedKey);

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
  console.log(`💼 Master EOA: ${masterAccount.address}`);
  console.log(`💰 Balance: ${(Number(balance) / 1e18).toFixed(6)} ETH`);

  if (balance === 0n) {
    console.log('\n⚠️  Warning: Account has 0 ETH. You need Base Sepolia testnet ETH.');
    console.log('   Get testnet ETH from: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet\n');
    throw new Error('Insufficient ETH balance');
  }

  console.log('\n🔍 Finding artists ready for lock deployment...\n');

  // Query artists with PKP+Lens but no lock
  const artists = await query<ArtistWithAccounts>(
    `
    SELECT
      sa.spotify_artist_id,
      sa.name as artist_name,
      pkp.pkp_address,
      pkp.id as pkp_id,
      lens.id as lens_id,
      lens.lens_handle,
      lens.lens_account_address,
      lens.lens_metadata_uri
    FROM spotify_artists sa
    -- Must have PKP
    INNER JOIN pkp_accounts pkp ON pkp.spotify_artist_id = sa.spotify_artist_id
      AND pkp.account_type = 'artist'
    -- Must have Lens
    INNER JOIN lens_accounts lens ON lens.spotify_artist_id = sa.spotify_artist_id
      AND lens.account_type = 'artist'
      AND lens.pkp_address = pkp.pkp_address
    -- Only artists in our pipeline (have processed tracks)
    WHERE EXISTS (
      SELECT 1 FROM karaoke_segments ks
      JOIN spotify_tracks st ON st.spotify_track_id = ks.spotify_track_id
      WHERE st.artists @> jsonb_build_array(jsonb_build_object('id', sa.spotify_artist_id))
    )
    -- No lock deployed yet
    AND lens.subscription_lock_address IS NULL
    ${targetArtistId ? 'AND sa.spotify_artist_id = $2' : ''}
    ORDER BY sa.name ASC
    LIMIT $1
  `,
    targetArtistId ? [limit, targetArtistId] : [limit]
  );

  if (artists.length === 0) {
    console.log('✅ No artists need lock deployment\n');
    return;
  }

  console.log(`Found ${artists.length} artists ready for locks\n`);

  let totalSuccess = 0;
  let totalErrors = 0;

  for (const artist of artists) {
    console.log(`📍 ${artist.artist_name} (${artist.spotify_artist_id})`);
    console.log(`   🔑 PKP: ${artist.pkp_address}`);
    console.log(`   🌿 Lens: @${artist.lens_handle}`);

    try {
      // Deploy lock
      const lockData = await deployLock(
        artist.artist_name,
        artist.pkp_address,
        masterAccount,
        publicClient,
        walletClient
      );

      console.log(`      ✅ Lock deployed: ${lockData.lockAddress}`);
      console.log(`      📦 Block: ${lockData.blockNumber}`);
      console.log(`      💰 Payments will flow to PKP: ${artist.pkp_address}`);

      // Update lens_accounts with lock info
      await query(
        `
        UPDATE lens_accounts
        SET
          subscription_lock_address = $1,
          subscription_lock_chain = 'base-sepolia',
          subscription_lock_price = '1.99',
          subscription_lock_currency = 'ETH',
          subscription_lock_duration_days = 30,
          subscription_lock_deployed_at = NOW(),
          subscription_lock_tx_hash = $2,
          updated_at = NOW()
        WHERE id = $3
      `,
        [lockData.lockAddress, lockData.transactionHash, artist.lens_id]
      );

      console.log(`      ✅ Database updated\n`);

      totalSuccess++;

      // TODO: Update Lens metadata to include lock address
      // This requires calling setMetadataURI on the Lens account contract
      // For now, we store the lock info in the database

    } catch (error: any) {
      console.error(`      ❌ Failed: ${error.message}\n`);
      totalErrors++;
    }
  }

  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Total Success: ${totalSuccess}`);
  console.log(`❌ Total Errors: ${totalErrors}`);
  console.log(`${'='.repeat(60)}\n`);

  if (totalSuccess > 0) {
    console.log('💡 Next steps:');
    console.log('   1. Verify locks on Base Sepolia block explorer');
    console.log('   2. Update Lens metadata to include lock addresses (manual step)');
    console.log('   3. Continue with GRC-20 population: bun scripts:migration:populate-grc20-artists');
    console.log('   4. Test subscription purchase flow in frontend\n');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  });
