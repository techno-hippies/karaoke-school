/**
 * Unified song registry client
 * Uses contract registry as source of truth with Grove Storage fallback
 */

import { getContractRegistry, getContractSongs, getContractSongById } from '../../services/ContractRegistryService';

export interface RegistrySong {
  id: string;
  title: string;
  artist: string;
  duration: number;
  audioUri: string;      // lens:// URI
  timestampsUri: string; // lens:// URI
  thumbnailUri: string;  // lens:// URI
  addedAt: string;
  metadataUri?: string;  // Optional additional metadata
}

export interface SongRegistry {
  version: number;
  lastUpdated: string;
  songs: RegistrySong[];
}

const GROVE_REGISTRY_URL = 'https://api.grove.storage/24cdef29730ca5e8fe18c1a39f5ce65225c8558d414810e88ad344ced296a87b';

/**
 * Fetch the song registry from contract with Grove Storage fallback
 */
export async function fetchSongRegistry(): Promise<SongRegistry> {
  try {
    // Try contract registry first (primary source)
    const contractRegistry = getContractRegistry();

    if (contractRegistry.isAvailable()) {
      console.log('[SongRegistry] Using contract registry as primary source');
      const registry = await contractRegistry.fetchSongRegistry();

      // Cache successful contract fetch
      localStorage.setItem('song_registry_cache', JSON.stringify(registry));
      localStorage.setItem('song_registry_cache_timestamp', Date.now().toString());

      return registry;
    }
  } catch (error) {
    console.warn('[SongRegistry] Contract registry failed, trying Grove Storage fallback:', error);
  }

  try {
    // Fallback to Grove Storage
    console.log('[SongRegistry] Using Grove Storage fallback');
    const response = await fetch(GROVE_REGISTRY_URL);

    if (!response.ok) {
      throw new Error(`Failed to fetch song registry: ${response.statusText}`);
    }

    const registry: SongRegistry = await response.json();

    // Validate registry structure
    if (!registry.songs || !Array.isArray(registry.songs)) {
      throw new Error('Invalid registry format: missing songs array');
    }

    return registry;
  } catch (groveError) {
    console.error('[SongRegistry] Grove Storage also failed:', groveError);

    // Final fallback: use cached data if available
    try {
      const cached = localStorage.getItem('song_registry_cache');
      const cacheTimestamp = localStorage.getItem('song_registry_cache_timestamp');

      if (cached && cacheTimestamp) {
        const age = Date.now() - parseInt(cacheTimestamp);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (age < maxAge) {
          console.log('[SongRegistry] Using cached registry data');
          return JSON.parse(cached);
        }
      }
    } catch (cacheError) {
      console.error('[SongRegistry] Cache read failed:', cacheError);
    }

    // Return empty registry as last resort
    console.error('[SongRegistry] All sources failed, returning empty registry');
    return {
      version: 0,
      lastUpdated: new Date().toISOString(),
      songs: []
    };
  }
}

/**
 * Get all songs from the registry (contract-first with fallbacks)
 */
export async function getRegistrySongs(): Promise<RegistrySong[]> {
  try {
    // Try contract registry first
    const contractRegistry = getContractRegistry();
    if (contractRegistry.isAvailable()) {
      const contractSongs = await getContractSongs();
      if (contractSongs.length > 0) {
        console.log(`[SongRegistry] Got ${contractSongs.length} songs from contract`);
        return contractSongs;
      }
    }
  } catch (error) {
    console.warn('[SongRegistry] Contract songs fetch failed:', error);
  }

  // Fallback to full registry fetch
  console.log('[SongRegistry] Using fallback registry fetch');
  const registry = await fetchSongRegistry();
  return registry.songs;
}

/**
 * Get a specific song by ID from the registry (contract-first with fallbacks)
 */
export async function getRegistrySongById(songId: string): Promise<RegistrySong | null> {
  try {
    // Try contract registry first
    const contractRegistry = getContractRegistry();
    if (contractRegistry.isAvailable()) {
      const contractSong = await getContractSongById(songId);
      if (contractSong) {
        console.log(`[SongRegistry] Got song ${songId} from contract`);
        return contractSong;
      }
    }
  } catch (error) {
    console.warn(`[SongRegistry] Contract song fetch failed for ${songId}:`, error);
  }

  // Fallback to searching all songs
  console.log(`[SongRegistry] Using fallback search for song ${songId}`);
  const songs = await getRegistrySongs();
  return songs.find(song => song.id === songId) || null;
}

/**
 * Get available song IDs from the registry
 */
export async function getRegistrySongIds(): Promise<string[]> {
  try {
    // Try contract registry first
    const contractRegistry = getContractRegistry();
    if (contractRegistry.isAvailable()) {
      const songIds = await contractRegistry.getSongIds();
      if (songIds.length > 0) {
        console.log(`[SongRegistry] Got ${songIds.length} song IDs from contract`);
        return songIds;
      }
    }
  } catch (error) {
    console.warn('[SongRegistry] Contract song IDs fetch failed:', error);
  }

  // Fallback to full registry fetch
  console.log('[SongRegistry] Using fallback song IDs fetch');
  const songs = await getRegistrySongs();
  return songs.map(song => song.id);
}

/**
 * Check if a song exists in the registry (contract-first)
 */
export async function songExists(songId: string): Promise<boolean> {
  try {
    // Try contract registry first
    const contractRegistry = getContractRegistry();
    if (contractRegistry.isAvailable()) {
      const exists = await contractRegistry.songExists(songId);
      console.log(`[SongRegistry] Song ${songId} exists in contract: ${exists}`);
      return exists;
    }
  } catch (error) {
    console.warn(`[SongRegistry] Contract existence check failed for ${songId}:`, error);
  }

  // Fallback to search
  const song = await getRegistrySongById(songId);
  return song !== null;
}

/**
 * Get contract deployment info
 */
export function getRegistryInfo(): {
  contractAvailable: boolean;
  chainId: number;
  contractAddress: string;
  groveUrl: string;
} {
  const contractRegistry = getContractRegistry();
  const contractInfo = contractRegistry.getContractInfo();

  return {
    contractAvailable: contractInfo.isAvailable,
    chainId: contractInfo.chainId,
    contractAddress: contractInfo.address,
    groveUrl: GROVE_REGISTRY_URL
  };
}