#!/usr/bin/env bun
/**
 * Register Artist on Blockchain
 *
 * Fetches artist data from Genius API and registers in ArtistRegistryV1
 *
 * Usage:
 *   bun artists/01-register-artist.ts --genius-id 498
 */

import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { parseArgs } from 'util';

// Parse CLI arguments
const { values } = parseArgs({
  options: {
    'genius-id': { type: 'string' },
    'pkp-address': { type: 'string' },
    'lens-handle': { type: 'string' },
    'lens-account': { type: 'string' },
  },
});

// Validate required args
if (!values['genius-id'] || !values['pkp-address'] || !values['lens-handle'] || !values['lens-account']) {
  console.error('❌ Missing required arguments');
  console.error('Usage: bun artists/01-register-artist.ts \\');
  console.error('  --genius-id 498 \\');
  console.error('  --pkp-address 0x... \\');
  console.error('  --lens-handle beyonce \\');
  console.error('  --lens-account 0x...');
  process.exit(1);
}

const geniusId = parseInt(values['genius-id']!);
const pkpAddress = values['pkp-address']!;
const lensHandle = values['lens-handle']!;
const lensAccount = values['lens-account']!;

console.log('🎤 Artist Registration\n');
console.log('════════════════════════════════════════════════════════════\n');
console.log(`Genius Artist ID: ${geniusId}\n`);

// Load environment variables
const ARTIST_REGISTRY = process.env.ARTIST_REGISTRY_ADDRESS;
const GENIUS_API_KEY = process.env.GENIUS_API_KEY;
const privateKey = process.env.PRIVATE_KEY;

if (!ARTIST_REGISTRY) {
  throw new Error('ARTIST_REGISTRY_ADDRESS not set in .env');
}
if (!GENIUS_API_KEY) {
  throw new Error('GENIUS_API_KEY not set in .env');
}
if (!privateKey) {
  throw new Error('PRIVATE_KEY not set in .env');
}

// Setup wallet
const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
const account = privateKeyToAccount(formattedKey as `0x${string}`);

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
});

// Contract ABI
const artistRegistryAbi = [
  {
    name: 'registerArtist',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'geniusArtistId', type: 'uint32' },
      { name: 'pkpAddress', type: 'address' },
      { name: 'lensHandle', type: 'string' },
      { name: 'lensAccountAddress', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'artistExists',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'geniusId', type: 'uint32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getArtist',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'geniusId', type: 'uint32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'geniusArtistId', type: 'uint32' },
          { name: 'pkpAddress', type: 'address' },
          { name: 'lensHandle', type: 'string' },
          { name: 'lensAccountAddress', type: 'address' },
          { name: 'enabled', type: 'bool' },
          { name: 'createdAt', type: 'uint64' },
        ],
      },
    ],
  },
] as const;

async function fetchGeniusArtist(geniusId: number): Promise<any> {
  const response = await fetch(
    `https://api.genius.com/artists/${geniusId}?access_token=${GENIUS_API_KEY}`
  );

  if (!response.ok) {
    throw new Error(`Genius API error: ${response.status}`);
  }

  const data: any = await response.json();
  return data.response.artist;
}

async function main() {
  try {
    // Step 1: Check if artist already registered
    console.log('Step 1: Checking if artist exists...');
    const exists = await publicClient.readContract({
      address: ARTIST_REGISTRY as `0x${string}`,
      abi: artistRegistryAbi,
      functionName: 'artistExists',
      args: [geniusId],
    });

    if (exists) {
      console.log('⚠️  Artist already registered!\n');

      const artist = await publicClient.readContract({
        address: ARTIST_REGISTRY as `0x${string}`,
        abi: artistRegistryAbi,
        functionName: 'getArtist',
        args: [geniusId],
      });

      console.log('Existing artist details:');
      console.log(`  Genius ID: ${artist[0]}`);
      console.log(`  PKP Address: ${artist[1]}`);
      console.log(`  Lens Handle: ${artist[2]}`);
      console.log(`  Lens Account: ${artist[3]}`);
      console.log(`  Enabled: ${artist[4]}`);
      console.log();
      console.log(`🔗 Base Sepolia: https://sepolia.basescan.org/address/${ARTIST_REGISTRY}`);
      process.exit(0);
    }

    // Step 2: Fetch from Genius
    console.log('\nStep 2: Fetching artist data from Genius...');
    const geniusArtist = await fetchGeniusArtist(geniusId);

    const name = geniusArtist.name;
    const imageUrl = geniusArtist.image_url || geniusArtist.header_image_url;

    console.log(`  Name: ${name}`);
    console.log(`  Image: ${imageUrl}`);

    // Step 3: Register on blockchain
    console.log('\nStep 3: Registering artist on blockchain...');
    console.log(`  Calling registerArtist(${geniusId}, "${lensHandle}", ...)`);

    const hash = await walletClient.writeContract({
      address: ARTIST_REGISTRY as `0x${string}`,
      abi: artistRegistryAbi,
      functionName: 'registerArtist',
      args: [geniusId, pkpAddress as `0x${string}`, lensHandle, lensAccount as `0x${string}`],
    });

    console.log(`  Transaction: ${hash}`);
    console.log('  Waiting for confirmation...');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  ✓ Confirmed in block ${receipt.blockNumber}`);

    // Step 4: Verify registration
    console.log('\nStep 4: Verifying registration...');
    const artist = await publicClient.readContract({
      address: ARTIST_REGISTRY as `0x${string}`,
      abi: artistRegistryAbi,
      functionName: 'getArtist',
      args: [geniusId],
    });

    console.log('\n✅ Artist registered successfully!\n');
    console.log('Artist details:');
    console.log(`  Genius ID: ${artist[0]}`);
    console.log(`  PKP Address: ${artist[1]}`);
    console.log(`  Lens Handle: ${artist[2]}`);
    console.log(`  Lens Account: ${artist[3]}`);
    console.log(`  Enabled: ${artist[4]}`);
    console.log();
    console.log(`🔗 Base Sepolia: https://sepolia.basescan.org/address/${ARTIST_REGISTRY}`);
    console.log(`🔗 Transaction: https://sepolia.basescan.org/tx/${hash}`);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

main();
