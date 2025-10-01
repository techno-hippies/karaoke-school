/**
 * Contract Registry Service
 * Provides interaction with the SongRegistryV2 smart contract
 */

import { getContract, type PublicClient } from 'viem';
import { getPublicClient } from 'wagmi/actions';
import { wagmiConfig } from '../config/wagmi.config';
import {
  SONG_REGISTRY_V2_ABI,
  getSongRegistryAddress,
  mapContractSong,
  type ContractSong,
  type RegistrySong
} from '../contracts/SongRegistryV2';

export interface SongRegistry {
  version: number;
  lastUpdated: string;
  songs: RegistrySong[];
}

export class ContractRegistryService {
  private publicClient: PublicClient | null = null;
  private chainId: number;
  private contractAddress: string;

  constructor(chainId: number = 37111) { // Default to Lens Chain Testnet
    this.chainId = chainId;
    try {
      this.contractAddress = getSongRegistryAddress(chainId);
    } catch (error) {
      console.warn(`SongRegistryV2 not available on chain ${chainId}:`, error);
      this.contractAddress = '';
    }
  }

  /**
   * Initialize the service with the current public client
   */
  async initialize(): Promise<void> {
    try {
      this.publicClient = getPublicClient(wagmiConfig, { chainId: this.chainId });
      if (!this.publicClient) {
        throw new Error(`No public client available for chain ${this.chainId}`);
      }
    } catch (error) {
      console.error('[ContractRegistry] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Get the contract instance
   */
  private getContract() {
    if (!this.publicClient) {
      throw new Error('ContractRegistryService not initialized. Call initialize() first.');
    }
    if (!this.contractAddress) {
      throw new Error(`SongRegistryV2 not deployed on chain ${this.chainId}`);
    }

    return getContract({
      address: this.contractAddress as `0x${string}`,
      abi: SONG_REGISTRY_V2_ABI,
      client: this.publicClient
    });
  }

  /**
   * Fetch all songs from the contract
   */
  async fetchSongRegistry(): Promise<SongRegistry> {
    try {
      await this.ensureInitialized();
      const contract = this.getContract();

      // First try to get song count to test the contract
      console.log('[ContractRegistry] Testing contract with getSongCount()');
      const songCount = await contract.read.getSongCount() as bigint;
      console.log(`[ContractRegistry] Contract reports ${songCount} songs`);

      if (songCount === 0n) {
        console.log('[ContractRegistry] No songs in contract');
        return {
          version: 2,
          lastUpdated: new Date().toISOString(),
          songs: []
        };
      }

      // Get all songs using getAllSongs()
      console.log('[ContractRegistry] Fetching all songs...');
      const contractSongs = await contract.read.getAllSongs() as ContractSong[];

      console.log(`[ContractRegistry] Fetched ${contractSongs.length} songs from contract`);

      // Map contract songs to frontend format (all songs in the array exist)
      const songs = contractSongs.map(mapContractSong);

      return {
        version: 2, // SongRegistryV2
        lastUpdated: new Date().toISOString(),
        songs
      };

    } catch (error) {
      console.error('[ContractRegistry] Failed to fetch registry:', error);
      throw error;
    }
  }

  /**
   * Get a specific song by ID
   */
  async getSongById(songId: string): Promise<RegistrySong | null> {
    try {
      await this.ensureInitialized();
      const contract = this.getContract();

      const contractSong = await contract.read.getSong([songId]) as ContractSong;
      return mapContractSong(contractSong);

    } catch (error) {
      console.error(`[ContractRegistry] Failed to get song ${songId}:`, error);
      return null;
    }
  }

  /**
   * Check if a song exists in the registry
   */
  async songExists(songId: string): Promise<boolean> {
    try {
      await this.ensureInitialized();
      const contract = this.getContract();

      return await contract.read.songExists([songId]) as boolean;

    } catch (error) {
      console.error(`[ContractRegistry] Failed to check song existence ${songId}:`, error);
      return false;
    }
  }

  /**
   * Get songs in batches for pagination
   */
  async getSongsBatch(offset: number, limit: number = 50): Promise<RegistrySong[]> {
    try {
      await this.ensureInitialized();
      const contract = this.getContract();

      const contractSongs = await contract.read.getSongsBatch([
        BigInt(offset),
        BigInt(limit)
      ]) as ContractSong[];

      return contractSongs.map(mapContractSong);

    } catch (error) {
      console.error(`[ContractRegistry] Failed to get songs batch:`, error);
      return [];
    }
  }

  /**
   * Get total number of songs in registry
   */
  async getSongCount(): Promise<number> {
    try {
      await this.ensureInitialized();
      const contract = this.getContract();

      const count = await contract.read.getSongCount() as bigint;
      return Number(count);

    } catch (error) {
      console.error('[ContractRegistry] Failed to get song count:', error);
      return 0;
    }
  }

  /**
   * Get all song IDs from the registry
   */
  async getSongIds(): Promise<string[]> {
    try {
      const registry = await this.fetchSongRegistry();
      return registry.songs.map(song => song.id);
    } catch (error) {
      console.error('[ContractRegistry] Failed to get song IDs:', error);
      return [];
    }
  }

  /**
   * Ensure the service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.publicClient) {
      await this.initialize();
    }
  }

  /**
   * Check if the contract registry is available
   */
  isAvailable(): boolean {
    return !!this.contractAddress;
  }

  /**
   * Get contract deployment information
   */
  getContractInfo(): { chainId: number; address: string; isAvailable: boolean } {
    return {
      chainId: this.chainId,
      address: this.contractAddress,
      isAvailable: this.isAvailable()
    };
  }
}

// Singleton instance for the default chain
let defaultContractRegistry: ContractRegistryService | null = null;

/**
 * Get the default contract registry service instance
 */
export function getContractRegistry(chainId?: number): ContractRegistryService {
  if (chainId) {
    return new ContractRegistryService(chainId);
  }

  if (!defaultContractRegistry) {
    defaultContractRegistry = new ContractRegistryService();
  }

  return defaultContractRegistry;
}

/**
 * Helper function to get songs from contract with fallback handling
 */
export async function getContractSongs(): Promise<RegistrySong[]> {
  try {
    const registry = getContractRegistry();

    if (!registry.isAvailable()) {
      console.warn('[ContractRegistry] Contract not available, returning empty array');
      return [];
    }

    const songRegistry = await registry.fetchSongRegistry();
    return songRegistry.songs;

  } catch (error) {
    console.error('[ContractRegistry] Failed to get contract songs:', error);
    return [];
  }
}

/**
 * Helper function to get a song by ID with error handling
 */
export async function getContractSongById(songId: string): Promise<RegistrySong | null> {
  try {
    const registry = getContractRegistry();

    if (!registry.isAvailable()) {
      console.warn('[ContractRegistry] Contract not available');
      return null;
    }

    return await registry.getSongById(songId);

  } catch (error) {
    console.error(`[ContractRegistry] Failed to get song ${songId}:`, error);
    return null;
  }
}