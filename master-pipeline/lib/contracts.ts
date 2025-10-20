/**
 * Smart contract interaction utilities
 * Wraps v2-contracts (ArtistRegistry, SongRegistry, SegmentRegistry)
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import type { ArtistOnChain, SongOnChain, SegmentOnChain } from './types';
import { loadPipelineConfig, requireEnv } from './config';

/**
 * Initialize wallet and public clients
 */
export function initClients() {
  const config = loadPipelineConfig();

  const privateKey = requireEnv('PRIVATE_KEY');
  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(config.network.contractsRpcUrl),
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(config.network.contractsRpcUrl),
  });

  return { walletClient, publicClient, account };
}

/**
 * Contract ABIs (JSON format - extracted from v2-contracts)
 */
const artistRegistryAbi = [
  {
    type: 'function',
    name: 'registerArtist',
    inputs: [
      { name: 'geniusArtistId', type: 'uint32', internalType: 'uint32' },
      { name: 'pkpAddress', type: 'address', internalType: 'address' },
      { name: 'lensHandle', type: 'string', internalType: 'string' },
      { name: 'lensAccountAddress', type: 'address', internalType: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getArtist',
    inputs: [{ name: 'geniusArtistId', type: 'uint32', internalType: 'uint32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct IArtistRegistry.Artist',
        components: [
          { name: 'geniusArtistId', type: 'uint32', internalType: 'uint32' },
          { name: 'pkpAddress', type: 'address', internalType: 'address' },
          { name: 'lensHandle', type: 'string', internalType: 'string' },
          { name: 'lensAccountAddress', type: 'address', internalType: 'address' },
          { name: 'verified', type: 'bool', internalType: 'bool' },
          { name: 'createdAt', type: 'uint64', internalType: 'uint64' },
          { name: 'updatedAt', type: 'uint64', internalType: 'uint64' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLensHandle',
    inputs: [{ name: 'geniusArtistId', type: 'uint32', internalType: 'uint32' }],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
] as const;

// TODO: Add proper JSON ABIs for SongRegistry and SegmentRegistry when needed
const songRegistryAbi = [] as const;
const segmentRegistryAbi = [] as const;

// ============================================================================
// Artist Registry
// ============================================================================

/**
 * Register artist in ArtistRegistry
 */
export async function registerArtist(params: {
  geniusArtistId: number;
  pkpAddress: Address;
  lensHandle: string;
  lensAccountAddress: Address;
}): Promise<ArtistOnChain> {
  const { geniusArtistId, pkpAddress, lensHandle, lensAccountAddress } = params;

  console.log(`\n📝 Registering artist ${geniusArtistId} in ArtistRegistry...`);

  const { walletClient, publicClient } = initClients();
  const config = loadPipelineConfig();

  // Call registerArtist
  const hash = await walletClient.writeContract({
    address: config.contracts.artistRegistry,
    abi: artistRegistryAbi,
    functionName: 'registerArtist',
    args: [BigInt(geniusArtistId), pkpAddress, lensHandle, lensAccountAddress],
  });

  console.log(`⏳ Waiting for transaction: ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash });

  const artistData: ArtistOnChain = {
    geniusArtistId,
    pkpAddress,
    lensHandle,
    lensAccountAddress,
    registeredAt: new Date().toISOString(),
    transactionHash: hash,
  };

  console.log(`✅ Artist registered on-chain`);
  console.log(`   Tx: ${hash}`);

  return artistData;
}

/**
 * Get artist from ArtistRegistry
 */
export async function getArtist(geniusArtistId: number) {
  const { publicClient } = initClients();
  const config = loadPipelineConfig();

  const artist = await publicClient.readContract({
    address: config.contracts.artistRegistry,
    abi: artistRegistryAbi,
    functionName: 'getArtist',
    args: [BigInt(geniusArtistId)],
  });

  return artist;
}

// ============================================================================
// Song Registry
// ============================================================================

/**
 * Register song in SongRegistry
 */
export async function registerSong(params: {
  geniusArtistId: number;
  geniusSongId: number;
  title: string;
  artistName: string;
  duration: number;
  coverArt: string;
  metadataUri: string;
}): Promise<SongOnChain> {
  const { geniusArtistId, geniusSongId, title, artistName, duration, coverArt, metadataUri } =
    params;

  console.log(`\n📝 Registering song ${geniusSongId} in SongRegistry...`);

  const { walletClient, publicClient } = initClients();
  const config = loadPipelineConfig();

  // Call registerSong
  const hash = await walletClient.writeContract({
    address: config.contracts.songRegistry,
    abi: songRegistryAbi,
    functionName: 'registerSong',
    args: [
      BigInt(geniusArtistId),
      BigInt(geniusSongId),
      title,
      artistName,
      BigInt(duration),
      coverArt,
      metadataUri,
    ],
  });

  console.log(`⏳ Waiting for transaction: ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash });

  const songData: SongOnChain = {
    geniusSongId,
    registeredAt: new Date().toISOString(),
    transactionHash: hash,
    enabled: true,
  };

  console.log(`✅ Song registered on-chain`);
  console.log(`   Tx: ${hash}`);

  return songData;
}

/**
 * Get song from SongRegistry
 */
export async function getSong(geniusSongId: number) {
  const { publicClient } = initClients();
  const config = loadPipelineConfig();

  const song = await publicClient.readContract({
    address: config.contracts.songRegistry,
    abi: songRegistryAbi,
    functionName: 'getSong',
    args: [BigInt(geniusSongId)],
  });

  return song;
}

// ============================================================================
// Segment Registry
// ============================================================================

/**
 * Register segment (Phase 1: Metadata only)
 */
export async function registerSegment(params: {
  geniusSongId: number;
  tiktokSegmentId: string;
  startTime: number;
  endTime: number;
  coverArt: string;
}): Promise<SegmentOnChain> {
  const { geniusSongId, tiktokSegmentId, startTime, endTime, coverArt } = params;

  console.log(`\n📝 Registering segment in SegmentRegistry (Phase 1)...`);

  const { walletClient, publicClient } = initClients();
  const config = loadPipelineConfig();

  // Call registerSegment
  const hash = await walletClient.writeContract({
    address: config.contracts.segmentRegistry,
    abi: segmentRegistryAbi,
    functionName: 'registerSegment',
    args: [BigInt(geniusSongId), tiktokSegmentId, BigInt(startTime), BigInt(endTime), coverArt],
  });

  console.log(`⏳ Waiting for transaction: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Get segment hash from event logs (assuming first log is SegmentRegistered event)
  // TODO: Parse event logs properly
  const segmentHash = '0x' as Hex; // Placeholder

  const segmentData: SegmentOnChain = {
    segmentHash,
    songGeniusId: geniusSongId,
    tiktokSegmentId,
    startTime,
    endTime,
    phase1RegisteredAt: new Date().toISOString(),
    phase1TransactionHash: hash,
  };

  console.log(`✅ Segment registered (Phase 1)`);
  console.log(`   Tx: ${hash}`);

  return segmentData;
}

/**
 * Process segment (Phase 2: Audio assets)
 */
export async function processSegment(params: {
  segmentHash: Hex;
  vocalsUri: string;
  instrumentalUri: string;
  alignmentUri: string;
}): Promise<void> {
  const { segmentHash, vocalsUri, instrumentalUri, alignmentUri } = params;

  console.log(`\n📝 Processing segment (Phase 2)...`);

  const { walletClient, publicClient } = initClients();
  const config = loadPipelineConfig();

  // Call processSegment
  const hash = await walletClient.writeContract({
    address: config.contracts.segmentRegistry,
    abi: segmentRegistryAbi,
    functionName: 'processSegment',
    args: [segmentHash, vocalsUri, instrumentalUri, alignmentUri],
  });

  console.log(`⏳ Waiting for transaction: ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash });

  console.log(`✅ Segment processed (Phase 2)`);
  console.log(`   Tx: ${hash}`);
}

/**
 * Get segment from SegmentRegistry
 */
export async function getSegment(segmentHash: Hex) {
  const { publicClient } = initClients();
  const config = loadPipelineConfig();

  const segment = await publicClient.readContract({
    address: config.contracts.segmentRegistry,
    abi: segmentRegistryAbi,
    functionName: 'getSegment',
    args: [segmentHash],
  });

  return segment;
}
