/**
 * Event Emitter - Utility for emitting events to Lens Chain event contracts
 *
 * This module provides functions to emit events after Grove uploads,
 * enabling The Graph subgraph to index songs, segments, and performances.
 */

import { createPublicClient, createWalletClient, http, type Address, type Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { parseAbi } from 'viem';

// Lens Chain testnet configuration
const LENS_CHAIN = {
  id: 37111,
  name: 'Lens Chain Testnet',
  nativeCurrency: { name: 'GRASS', symbol: 'GRASS', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.LENS_CHAIN_RPC_URL || 'https://rpc.testnet.lens.xyz'] },
    public: { http: [process.env.LENS_CHAIN_RPC_URL || 'https://rpc.testnet.lens.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.testnet.lens.xyz' },
  },
};

// Contract ABIs (minimal - just the emit functions)
const SONG_EVENTS_ABI = parseAbi([
  'function emitSongRegistered(uint32 geniusId, string metadataUri, uint32 geniusArtistId) external',
]);

const SEGMENT_EVENTS_ABI = parseAbi([
  'function emitSegmentRegistered(bytes32 segmentHash, uint32 geniusId, string tiktokSegmentId, string metadataUri) external',
  'function emitSegmentProcessed(bytes32 segmentHash, string instrumentalUri, string alignmentUri, string metadataUri) external',
]);

const ACCOUNT_EVENTS_ABI = parseAbi([
  'function emitAccountCreated(address lensAccountAddress, address pkpAddress, string username, string metadataUri, uint32 geniusArtistId) external',
]);

// Create clients
function getClients() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not set in environment');
  }

  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);

  const publicClient = createPublicClient({
    chain: LENS_CHAIN,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: LENS_CHAIN,
    transport: http(),
  });

  return { publicClient, walletClient, account };
}

/**
 * Emit SongRegistered event
 */
export async function emitSongRegistered(params: {
  geniusId: number;
  metadataUri: string;
  geniusArtistId: number;
}): Promise<Hash> {
  const { walletClient, account } = getClients();
  const contractAddress = process.env.SONG_EVENTS_ADDRESS as Address;

  if (!contractAddress) {
    throw new Error('SONG_EVENTS_ADDRESS not set in environment');
  }

  console.log(`📡 Emitting SongRegistered event for genius ID ${params.geniusId}...`);

  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi: SONG_EVENTS_ABI,
    functionName: 'emitSongRegistered',
    args: [params.geniusId, params.metadataUri, params.geniusArtistId],
    account,
  });

  console.log(`✅ SongRegistered event emitted: ${hash}`);
  return hash;
}

/**
 * Emit SegmentRegistered event
 */
export async function emitSegmentRegistered(params: {
  segmentHash: `0x${string}`;
  geniusId: number;
  tiktokSegmentId: string;
  metadataUri: string;
}): Promise<Hash> {
  const { walletClient, account } = getClients();
  const contractAddress = process.env.SEGMENT_EVENTS_ADDRESS as Address;

  if (!contractAddress) {
    throw new Error('SEGMENT_EVENTS_ADDRESS not set in environment');
  }

  console.log(`📡 Emitting SegmentRegistered event for ${params.segmentHash}...`);

  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi: SEGMENT_EVENTS_ABI,
    functionName: 'emitSegmentRegistered',
    args: [params.segmentHash, params.geniusId, params.tiktokSegmentId, params.metadataUri],
    account,
  });

  console.log(`✅ SegmentRegistered event emitted: ${hash}`);
  return hash;
}

/**
 * Emit SegmentProcessed event
 */
export async function emitSegmentProcessed(params: {
  segmentHash: `0x${string}`;
  instrumentalUri: string;
  alignmentUri: string;
  metadataUri: string;
}): Promise<Hash> {
  const { walletClient, account } = getClients();
  const contractAddress = process.env.SEGMENT_EVENTS_ADDRESS as Address;

  if (!contractAddress) {
    throw new Error('SEGMENT_EVENTS_ADDRESS not set in environment');
  }

  console.log(`📡 Emitting SegmentProcessed event for ${params.segmentHash}...`);

  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi: SEGMENT_EVENTS_ABI,
    functionName: 'emitSegmentProcessed',
    args: [params.segmentHash, params.instrumentalUri, params.alignmentUri, params.metadataUri],
    account,
  });

  console.log(`✅ SegmentProcessed event emitted: ${hash}`);
  return hash;
}

/**
 * Emit AccountCreated event
 */
export async function emitAccountCreated(params: {
  lensAccountAddress: Address;
  pkpAddress: Address;
  username: string;
  metadataUri: string;
  geniusArtistId: number;
}): Promise<Hash> {
  const { walletClient, account } = getClients();
  const contractAddress = process.env.ACCOUNT_EVENTS_ADDRESS as Address;

  if (!contractAddress) {
    throw new Error('ACCOUNT_EVENTS_ADDRESS not set in environment');
  }

  console.log(`📡 Emitting AccountCreated event for @${params.username}...`);

  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi: ACCOUNT_EVENTS_ABI,
    functionName: 'emitAccountCreated',
    args: [
      params.lensAccountAddress,
      params.pkpAddress,
      params.username,
      params.metadataUri,
      params.geniusArtistId,
    ],
    account,
  });

  console.log(`✅ AccountCreated event emitted: ${hash}`);
  return hash;
}

/**
 * Helper: Generate segment hash (matches contract implementation)
 */
export function generateSegmentHash(geniusId: number, tiktokSegmentId: string): `0x${string}` {
  const { keccak256, encodePacked } = require('viem');
  return keccak256(encodePacked(['uint32', 'string'], [geniusId, tiktokSegmentId]));
}
