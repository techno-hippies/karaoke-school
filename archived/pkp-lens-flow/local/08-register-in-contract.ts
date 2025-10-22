#!/usr/bin/env bun
/**
 * Step 8: Register Artist in Registry Contract
 *
 * Registers artist in ArtistRegistryV1 contract on Base Sepolia
 * Maps: geniusArtistId -> PKP address -> Lens handle
 *
 * Prerequisites:
 * - PKP data in data/pkps/{handle}.json (from step 1)
 * - Lens account in data/lens/{handle}.json (from step 6)
 * - TikTok profile manifest with geniusArtistId
 * - PRIVATE_KEY in .env (contract owner/registrar)
 * - Deployed ArtistRegistryV1 contract
 *
 * Usage:
 *   bun run local/8-register-in-contract.ts --creator @taylorswift
 *
 * Output:
 *   Transaction hash for registration
 */

import { readFile } from 'fs/promises';
import { parseArgs } from 'util';
import path from 'path';
import { createPublicClient, createWalletClient, http, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Parse CLI args
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    creator: { type: 'string', short: 'c' },
  },
});

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
}

interface TikTokProfile {
  geniusArtistId?: number;
  nickname: string;
  bio?: string;
  groveUris?: {
    avatar?: string;
  };
}

interface Manifest {
  profile: TikTokProfile;
  lensHandle?: string;
}

// ArtistRegistryV2 contract address on Base Sepolia
const REGISTRY_CONTRACT_ADDRESS = (process.env.ARTIST_REGISTRY_ADDRESS || '0x81cE49c16D2Bf384017C2bCA7FDdACb8A15DECC7') as `0x${string}`;

// Minimal ABI for ArtistRegistryV2
const REGISTRY_ABI = [
  // registerArtist(uint32 geniusArtistId, address pkpAddress, string lensHandle, address lensAccountAddress, uint8 source)
  parseAbiItem('function registerArtist(uint32 geniusArtistId, address pkpAddress, string calldata lensHandle, address lensAccountAddress, uint8 source) external'),
  // artistExists(uint32 geniusArtistId) returns (bool)
  parseAbiItem('function artistExists(uint32 geniusArtistId) external view returns (bool)'),
  // getArtist(uint32 geniusArtistId) returns (Artist struct)
  {
    type: 'function',
    name: 'getArtist',
    stateMutability: 'view',
    inputs: [{ name: 'geniusArtistId', type: 'uint32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'geniusArtistId', type: 'uint32' },
          { name: 'pkpAddress', type: 'address' },
          { name: 'lensHandle', type: 'string' },
          { name: 'lensAccountAddress', type: 'address' },
          { name: 'source', type: 'uint8' },
          { name: 'verified', type: 'bool' },
          { name: 'hasContent', type: 'bool' },
          { name: 'createdAt', type: 'uint64' },
          { name: 'updatedAt', type: 'uint64' },
        ],
      },
    ],
  },
  // Custom errors
  parseAbiItem('error ArtistNotFound(uint32 geniusArtistId)'),
  parseAbiItem('error ArtistAlreadyExists(uint32 geniusArtistId)'),
] as const;

enum ProfileSource {
  MANUAL = 0,
  GENERATED = 1,
}

async function registerInContract(tiktokHandle: string): Promise<void> {
  console.log('\n📝 Step 8: Registering Artist in Contract');
  console.log('═══════════════════════════════════════════════════════\n');

  const cleanHandle = tiktokHandle.replace('@', '');

  // 1. Load PKP data
  const pkpPath = path.join(process.cwd(), 'data', 'pkps', `${cleanHandle}.json`);
  console.log(`📂 Loading PKP data from: ${pkpPath}`);
  const pkpDataRaw = await readFile(pkpPath, 'utf-8');
  const pkpData: PKPData = JSON.parse(pkpDataRaw);
  console.log(`   ✅ PKP Address: ${pkpData.pkpEthAddress}\n`);

  // 2. Load Lens account data
  const lensPath = path.join(process.cwd(), 'data', 'lens', `${cleanHandle}.json`);
  console.log(`📂 Loading Lens account from: ${lensPath}`);
  const lensDataRaw = await readFile(lensPath, 'utf-8');
  const lensData: LensAccountData = JSON.parse(lensDataRaw);
  console.log(`   ✅ Lens Handle: ${lensData.lensHandle}`);
  console.log(`   ✅ Lens Account: ${lensData.lensAccountAddress}\n`);

  // 3. Load manifest to get Genius Artist ID
  const manifestPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, 'manifest.json');
  console.log(`📂 Loading manifest from: ${manifestPath}`);
  const manifestRaw = await readFile(manifestPath, 'utf-8');
  const manifest: Manifest = JSON.parse(manifestRaw);

  if (!manifest.profile.geniusArtistId) {
    console.log('❌ Error: No Genius Artist ID found in manifest');
    console.log('   This artist cannot be registered in the contract.');
    console.log('   Only music artists with Genius profiles can be registered.\n');
    process.exit(1);
  }

  const geniusArtistId = manifest.profile.geniusArtistId;
  console.log(`   ✅ Genius Artist ID: ${geniusArtistId}\n`);

  // 4. Check contract address
  if (!REGISTRY_CONTRACT_ADDRESS) {
    console.log('❌ Error: ARTIST_REGISTRY_ADDRESS not set in .env');
    console.log('   Deploy ArtistRegistryV1 first and set the address.\n');
    process.exit(1);
  }

  // 5. Setup wallet
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not found in .env');
  }

  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);

  console.log(`🔑 Registrar: ${account.address}`);
  console.log(`📜 Contract: ${REGISTRY_CONTRACT_ADDRESS}\n`);

  // 6. Create clients
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http('https://sepolia.base.org'),
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http('https://sepolia.base.org'),
  });

  // 7. Check if artist already registered
  console.log('🔍 Checking if artist already registered...');
  const exists = await publicClient.readContract({
    address: REGISTRY_CONTRACT_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'artistExists',
    args: [geniusArtistId],
  });

  if (exists) {
    console.log('✅ Artist already registered - fetching details...\n');

    const artist = await publicClient.readContract({
      address: REGISTRY_CONTRACT_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'getArtist',
      args: [geniusArtistId],
    });

    console.log('📊 Existing Registration:');
    console.log(`   Genius ID: ${artist.geniusArtistId}`);
    console.log(`   PKP Address: ${artist.pkpAddress}`);
    console.log(`   Lens Handle: @${artist.lensHandle}`);
    console.log(`   Lens Account: ${artist.lensAccountAddress}`);
    console.log(`   Source: ${artist.source === 0 ? 'MANUAL' : 'GENERATED'}`);
    console.log(`   Verified: ${artist.verified}`);
    console.log(`   Has Content: ${artist.hasContent}`);
    console.log(`   Created: ${new Date(Number(artist.createdAt) * 1000).toISOString()}`);
    console.log(`   Updated: ${new Date(Number(artist.updatedAt) * 1000).toISOString()}\n`);
    console.log('✨ Done!\n');
    return;
  }

  console.log('   Artist not registered yet.\n');

  // 8. Register artist
  console.log('📝 Registering artist in contract...');
  console.log(`   Genius ID: ${geniusArtistId}`);
  console.log(`   PKP Address: ${pkpData.pkpEthAddress}`);
  console.log(`   Lens Handle: ${lensData.lensHandle.replace('@', '')}`);
  console.log(`   Lens Account: ${lensData.lensAccountAddress}`);
  console.log(`   Source: MANUAL\n`);

  const { request } = await publicClient.simulateContract({
    account,
    address: REGISTRY_CONTRACT_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'registerArtist',
    args: [
      geniusArtistId,
      pkpData.pkpEthAddress as `0x${string}`,
      lensData.lensHandle.replace('@', ''),
      lensData.lensAccountAddress as `0x${string}`,
      ProfileSource.MANUAL,
    ],
  });

  const hash = await walletClient.writeContract(request);
  console.log(`   ✅ Transaction sent: ${hash}`);

  console.log('⏳ Waiting for confirmation...');
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`   ✅ Confirmed in block: ${receipt.blockNumber}\n`);

  // 9. Verify registration (wait a moment for state to settle)
  console.log('✅ Verifying registration...\n');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s for state to settle

  try {
    const artist = await publicClient.readContract({
      address: REGISTRY_CONTRACT_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'getArtist',
      args: [geniusArtistId],
    });

    console.log('📊 Registration Complete:');
    console.log(`   Genius ID: ${artist.geniusArtistId}`);
    console.log(`   PKP Address: ${artist.pkpAddress}`);
    console.log(`   Lens Handle: @${artist.lensHandle}`);
    console.log(`   Lens Account: ${artist.lensAccountAddress}`);
    console.log(`   Source: ${artist.source === 0 ? 'MANUAL' : 'GENERATED'}`);
    console.log(`   Transaction: ${hash}\n`);
  } catch (error: any) {
    // Fallback: just verify existence
    console.log(`   ⚠️  Could not fetch full details, verifying existence...`);
    const nowExists = await publicClient.readContract({
      address: REGISTRY_CONTRACT_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'artistExists',
      args: [geniusArtistId],
    });

    if (nowExists) {
      console.log(`   ✅ Artist exists in contract`);
      console.log(`   Transaction: ${hash}\n`);
    } else {
      throw new Error('Registration failed - artist not found after tx confirmation');
    }
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('✨ Artist successfully registered in contract!\n');
  console.log('🔗 Artist is now discoverable:');
  console.log(`   - By Genius ID: ${geniusArtistId}`);
  console.log(`   - By PKP Address: ${pkpData.pkpEthAddress}`);
  console.log(`   - By Lens Handle: ${lensData.lensHandle}\n`);
  console.log('📱 Frontend can now redirect /artist/${geniusArtistId} → /u/${lensHandle}\n');
}

async function main() {
  try {
    const creator = values.creator;

    if (!creator) {
      console.error('\n❌ Error: --creator argument required\n');
      console.log('Usage: bun run local/8-register-in-contract.ts --creator @taylorswift\n');
      process.exit(1);
    }

    await registerInContract(creator);
    console.log('✨ Done!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
