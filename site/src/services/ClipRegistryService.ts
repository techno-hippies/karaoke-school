/**
 * Clip Registry Service
 * Provides interaction with the ClipRegistryV1 smart contract
 */

import { getContract, type PublicClient } from 'viem';
import { getPublicClient } from 'wagmi/actions';
import { wagmiConfig } from '../config/wagmi.config';
import {
  CLIP_REGISTRY_V1_ABI,
  getClipRegistryAddress,
  mapContractClip,
  type ContractClip,
  type RegistryClip
} from '../contracts/ClipRegistryV1';

export interface ClipRegistry {
  version: number;
  lastUpdated: string;
  clips: RegistryClip[];
}

export class ClipRegistryService {
  private publicClient: PublicClient | null = null;
  private chainId: number;
  private contractAddress: string;

  constructor(chainId: number = 37111) { // Default to Lens Chain Testnet
    this.chainId = chainId;
    try {
      this.contractAddress = getClipRegistryAddress(chainId);
    } catch (error) {
      console.warn(`ClipRegistryV1 not available on chain ${chainId}:`, error);
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
      console.error('[ClipRegistry] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Get the contract instance
   */
  private getContract() {
    if (!this.publicClient) {
      throw new Error('ClipRegistryService not initialized. Call initialize() first.');
    }
    if (!this.contractAddress) {
      throw new Error(`ClipRegistryV1 not deployed on chain ${this.chainId}`);
    }

    return getContract({
      address: this.contractAddress as `0x${string}`,
      abi: CLIP_REGISTRY_V1_ABI,
      client: this.publicClient
    });
  }

  /**
   * Fetch all enabled clips from the contract
   */
  async fetchClipRegistry(): Promise<ClipRegistry> {
    try {
      await this.ensureInitialized();
      const contract = this.getContract();

      console.log('[ClipRegistry] Fetching enabled clips...');
      const contractClips = await contract.read.getEnabledClips() as ContractClip[];

      console.log(`[ClipRegistry] Fetched ${contractClips.length} enabled clips from contract`);

      // Map contract clips to frontend format
      const clips = contractClips.map(mapContractClip);

      return {
        version: 1, // ClipRegistryV1
        lastUpdated: new Date().toISOString(),
        clips
      };

    } catch (error) {
      console.error('[ClipRegistry] Failed to fetch registry:', error);
      throw error;
    }
  }

  /**
   * Get a specific clip by ID
   */
  async getClipById(clipId: string): Promise<RegistryClip | null> {
    try {
      await this.ensureInitialized();
      const contract = this.getContract();

      const contractClip = await contract.read.getClip([clipId]) as ContractClip;
      return mapContractClip(contractClip);

    } catch (error) {
      console.error(`[ClipRegistry] Failed to get clip ${clipId}:`, error);
      return null;
    }
  }

  /**
   * Get clips filtered by difficulty level
   */
  async getClipsByDifficulty(minLevel: number, maxLevel: number): Promise<RegistryClip[]> {
    try {
      await this.ensureInitialized();
      const contract = this.getContract();

      const contractClips = await contract.read.getClipsByDifficulty([
        minLevel,
        maxLevel
      ]) as ContractClip[];

      return contractClips.map(mapContractClip);

    } catch (error) {
      console.error(`[ClipRegistry] Failed to get clips by difficulty:`, error);
      return [];
    }
  }

  /**
   * Get clips filtered by speaking pace (words per second)
   */
  async getClipsByPace(minWps: number, maxWps: number): Promise<RegistryClip[]> {
    try {
      await this.ensureInitialized();
      const contract = this.getContract();

      // Convert decimal wps to contract format (multiply by 10)
      const contractClips = await contract.read.getClipsByPace([
        Math.round(minWps * 10),
        Math.round(maxWps * 10)
      ]) as ContractClip[];

      return contractClips.map(mapContractClip);

    } catch (error) {
      console.error(`[ClipRegistry] Failed to get clips by pace:`, error);
      return [];
    }
  }

  /**
   * Check if a clip exists in the registry
   */
  async clipExists(clipId: string): Promise<boolean> {
    try {
      await this.ensureInitialized();
      const contract = this.getContract();

      return await contract.read.clipExists([clipId]) as boolean;

    } catch (error) {
      console.error(`[ClipRegistry] Failed to check clip existence ${clipId}:`, error);
      return false;
    }
  }

  /**
   * Get total number of clips in registry
   */
  async getClipCount(): Promise<number> {
    try {
      await this.ensureInitialized();
      const contract = this.getContract();

      const count = await contract.read.getClipCount() as bigint;
      return Number(count);

    } catch (error) {
      console.error('[ClipRegistry] Failed to get clip count:', error);
      return 0;
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
let defaultClipRegistry: ClipRegistryService | null = null;

/**
 * Get the default clip registry service instance
 */
export function getClipRegistry(chainId?: number): ClipRegistryService {
  if (chainId) {
    return new ClipRegistryService(chainId);
  }

  if (!defaultClipRegistry) {
    defaultClipRegistry = new ClipRegistryService();
  }

  return defaultClipRegistry;
}

/**
 * Helper function to get clips from contract with fallback handling
 */
export async function getContractClips(): Promise<RegistryClip[]> {
  try {
    const registry = getClipRegistry();

    if (!registry.isAvailable()) {
      console.warn('[ClipRegistry] Contract not available, returning empty array');
      return [];
    }

    const clipRegistry = await registry.fetchClipRegistry();
    return clipRegistry.clips;

  } catch (error) {
    console.error('[ClipRegistry] Failed to get contract clips:', error);
    return [];
  }
}

/**
 * Helper function to get a clip by ID with error handling
 */
export async function getContractClipById(clipId: string): Promise<RegistryClip | null> {
  try {
    const registry = getClipRegistry();

    if (!registry.isAvailable()) {
      console.warn('[ClipRegistry] Contract not available');
      return null;
    }

    return await registry.getClipById(clipId);

  } catch (error) {
    console.error(`[ClipRegistry] Failed to get clip ${clipId}:`, error);
    return null;
  }
}
