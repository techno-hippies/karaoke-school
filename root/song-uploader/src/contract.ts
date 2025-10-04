import { createPublicClient, createWalletClient, http, type WalletClient, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { lensTestnet } from './chains.js';
import type { UploadResult, EnhancedSongMetadata } from './types.js';

// SongCatalogV1 ABI - only the functions we need
const SONG_CATALOG_ABI = [
  {
    "type": "function",
    "name": "addSong",
    "inputs": [
      { "name": "id", "type": "string" },
      { "name": "geniusId", "type": "uint32" },
      { "name": "geniusArtistId", "type": "uint32" },
      { "name": "title", "type": "string" },
      { "name": "artist", "type": "string" },
      { "name": "duration", "type": "uint32" },
      { "name": "audioUri", "type": "string" },
      { "name": "metadataUri", "type": "string" },
      { "name": "coverUri", "type": "string" },
      { "name": "thumbnailUri", "type": "string" },
      { "name": "musicVideoUri", "type": "string" },
      { "name": "segmentIds", "type": "string" },
      { "name": "languages", "type": "string" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updateSong",
    "inputs": [
      { "name": "id", "type": "string" },
      { "name": "geniusId", "type": "uint32" },
      { "name": "geniusArtistId", "type": "uint32" },
      { "name": "title", "type": "string" },
      { "name": "artist", "type": "string" },
      { "name": "duration", "type": "uint32" },
      { "name": "audioUri", "type": "string" },
      { "name": "metadataUri", "type": "string" },
      { "name": "coverUri", "type": "string" },
      { "name": "thumbnailUri", "type": "string" },
      { "name": "musicVideoUri", "type": "string" },
      { "name": "segmentIds", "type": "string" },
      { "name": "languages", "type": "string" },
      { "name": "enabled", "type": "bool" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "songExists",
    "inputs": [{ "name": "id", "type": "string" }],
    "outputs": [{ "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSongCount",
    "inputs": [],
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view"
  }
] as const;

export interface SongCatalogConfig {
  contractAddress: `0x${string}`;
  walletClient: WalletClient;
  publicClient: PublicClient;
}

/**
 * Initialize SongCatalog contract clients
 */
export function initializeSongCatalog(privateKey: string, contractAddress: `0x${string}`): SongCatalogConfig {
  // Ensure private key has 0x prefix
  const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

  if (formattedKey.length !== 66) {
    throw new Error('Invalid private key format. Must be 64 hex characters (with or without 0x prefix).');
  }

  const account = privateKeyToAccount(formattedKey as `0x${string}`);

  const walletClient = createWalletClient({
    account,
    chain: lensTestnet,
    transport: http('https://rpc.testnet.lens.xyz')
  });

  const publicClient = createPublicClient({
    chain: lensTestnet,
    transport: http('https://rpc.testnet.lens.xyz')
  });

  return {
    contractAddress,
    walletClient,
    publicClient
  };
}

/**
 * Check if a song already exists in SongCatalog
 */
export async function songExistsInCatalog(
  config: SongCatalogConfig,
  songId: string
): Promise<boolean> {
  try {
    const exists = await config.publicClient.readContract({
      address: config.contractAddress,
      abi: SONG_CATALOG_ABI,
      functionName: 'songExists',
      args: [songId]
    });
    return exists;
  } catch (error) {
    console.error(`Error checking if song ${songId} exists:`, error);
    throw error;
  }
}

/**
 * Get total song count from catalog
 */
export async function getSongCount(config: SongCatalogConfig): Promise<number> {
  try {
    const count = await config.publicClient.readContract({
      address: config.contractAddress,
      abi: SONG_CATALOG_ABI,
      functionName: 'getSongCount'
    });
    return Number(count);
  } catch (error) {
    console.error('Error getting song count:', error);
    throw error;
  }
}

/**
 * Add a song to SongCatalogV1 contract
 */
export async function addSongToCatalog(
  config: SongCatalogConfig,
  uploadResult: UploadResult,
  metadata: EnhancedSongMetadata,
  geniusId: number = 0,
  geniusArtistId: number = 0,
  segmentIds: string[] = [],
  coverUri: string = '',
  musicVideoUri: string = ''
): Promise<string> {
  try {
    console.log(`Adding ${uploadResult.songId} to SongCatalog...`);

    // Extract languages from metadata
    const languages = metadata.availableLanguages.join(',');

    // Convert segment IDs to CSV
    const segmentIdsStr = segmentIds.join(',');

    // Call addSong on contract
    const hash = await config.walletClient.writeContract({
      address: config.contractAddress,
      abi: SONG_CATALOG_ABI,
      functionName: 'addSong',
      args: [
        uploadResult.songId,
        geniusId,
        geniusArtistId,
        metadata.title,
        metadata.artist,
        metadata.duration,
        uploadResult.audioUri,
        uploadResult.metadataUri,
        coverUri,
        uploadResult.thumbnailUri || '',
        musicVideoUri,
        segmentIdsStr,
        languages
      ]
    });

    console.log(`✅ Transaction submitted: ${hash}`);
    console.log(`   Waiting for confirmation...`);

    // Wait for transaction confirmation
    const receipt = await config.publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1
    });

    if (receipt.status === 'success') {
      console.log(`✅ Song ${uploadResult.songId} added to catalog!`);
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed}`);
    } else {
      throw new Error(`Transaction failed with status: ${receipt.status}`);
    }

    return hash;
  } catch (error) {
    console.error(`Error adding song to catalog:`, error);
    throw error;
  }
}

/**
 * Update an existing song in SongCatalogV1 contract
 */
export async function updateSongInCatalog(
  config: SongCatalogConfig,
  uploadResult: UploadResult,
  metadata: EnhancedSongMetadata,
  geniusId: number = 0,
  geniusArtistId: number = 0,
  segmentIds: string[] = [],
  coverUri: string = '',
  musicVideoUri: string = '',
  enabled: boolean = true
): Promise<string> {
  try {
    console.log(`Updating ${uploadResult.songId} in SongCatalog...`);

    // Extract languages from metadata
    const languages = metadata.availableLanguages.join(',');

    // Convert segment IDs to CSV
    const segmentIdsStr = segmentIds.join(',');

    // Call updateSong on contract
    const hash = await config.walletClient.writeContract({
      address: config.contractAddress,
      abi: SONG_CATALOG_ABI,
      functionName: 'updateSong',
      args: [
        uploadResult.songId,
        geniusId,
        geniusArtistId,
        metadata.title,
        metadata.artist,
        metadata.duration,
        uploadResult.audioUri,
        uploadResult.metadataUri,
        coverUri,
        uploadResult.thumbnailUri || '',
        musicVideoUri,
        segmentIdsStr,
        languages,
        enabled
      ]
    });

    console.log(`✅ Transaction submitted: ${hash}`);
    console.log(`   Waiting for confirmation...`);

    // Wait for transaction confirmation
    const receipt = await config.publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1
    });

    if (receipt.status === 'success') {
      console.log(`✅ Song ${uploadResult.songId} updated in catalog!`);
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed}`);
    } else {
      throw new Error(`Transaction failed with status: ${receipt.status}`);
    }

    return hash;
  } catch (error) {
    console.error(`Error updating song in catalog:`, error);
    throw error;
  }
}
