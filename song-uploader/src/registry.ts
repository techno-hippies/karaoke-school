import { chains } from "@lens-chain/sdk/viem";
import { immutable, StorageClient } from "@lens-chain/storage-client";
import type { WalletClient } from 'viem';
import type { SongRegistry, SongEntry, UploadResult } from './types.js';

let storageClient: StorageClient | null = null;

function getStorageClient(): StorageClient {
  if (!storageClient) {
    storageClient = StorageClient.create();
  }
  return storageClient;
}

/**
 * Create initial empty registry
 */
export function createEmptyRegistry(): SongRegistry {
  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    songs: []
  };
}

/**
 * Upload initial registry to Grove (immutable)
 */
export async function createRegistry(): Promise<string> {
  const storage = getStorageClient();
  const registry = createEmptyRegistry();

  const acl = immutable(chains.mainnet.id);

  console.log('Creating initial registry...');

  const response = await storage.uploadAsJson(registry, { acl });

  console.log('Registry created:', response.uri);
  return response.uri;
}

/**
 * Load existing registry from Grove
 */
export async function loadRegistry(registryUri: string): Promise<SongRegistry> {
  try {
    console.log('Loading registry from:', registryUri);

    // Convert lens:// URI to gateway URL for fetching
    const gatewayUrl = registryUri.replace('lens://', 'https://api.grove.storage/');
    const response = await fetch(gatewayUrl);

    if (!response.ok) {
      throw new Error(`Failed to load registry: ${response.status}`);
    }

    const registry = await response.json() as SongRegistry;
    console.log(`Loaded registry with ${registry.songs.length} songs`);

    return registry;
  } catch (error) {
    console.error('Error loading registry:', error);
    throw error;
  }
}

/**
 * Add a new song to the registry
 */
export function addSongToRegistry(
  registry: SongRegistry,
  uploadResult: UploadResult,
  metadata: { title: string; artist: string; duration: number }
): SongRegistry {
  const newSong: SongEntry = {
    id: uploadResult.songId,
    title: metadata.title,
    artist: metadata.artist,
    duration: metadata.duration,
    audioUri: uploadResult.audioUri,
    timestampsUri: uploadResult.metadataUri,
    thumbnailUri: uploadResult.thumbnailUri,
    addedAt: new Date().toISOString()
  };

  return {
    ...registry,
    lastUpdated: new Date().toISOString(),
    songs: [...registry.songs, newSong]
  };
}

/**
 * Replace registry in Grove (immutable - creates new URI)
 */
export async function updateRegistry(
  registryUri: string,
  updatedRegistry: SongRegistry
): Promise<string> {
  const storage = getStorageClient();

  const acl = immutable(chains.mainnet.id);

  console.log('Creating new registry with updated songs...', {
    oldUri: registryUri,
    songCount: updatedRegistry.songs.length
  });

  const response = await storage.uploadAsJson(updatedRegistry, { acl });

  console.log('✅ New registry created:', response.uri);
  return response.uri;
}

/**
 * Check if a song already exists in the registry
 */
export function songExists(registry: SongRegistry, songId: string): boolean {
  return registry.songs.some(song => song.id === songId);
}

/**
 * Save registry URI to file for the main app to use
 */
export async function saveRegistryUri(uri: string): Promise<void> {
  const outputPath = './output/registry-uri.txt';
  await Bun.write(outputPath, uri);
  console.log(`Registry URI saved to ${outputPath}`);
}