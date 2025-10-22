/**
 * Pipeline configuration management
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { PipelineConfig, NetworkConfig, ContractAddresses } from './types';

// Get config directory
const CONFIG_DIR = join(process.cwd(), 'config');
const DATA_DIR = join(process.cwd(), 'data');

/**
 * Load network configuration
 */
export function loadNetworkConfig(): NetworkConfig {
  const env = process.env;

  return {
    litNetwork: env.LIT_NETWORK || 'chronicle-yellowstone',
    lensNetwork: env.LENS_NETWORK || 'lens-testnet',
    contractsNetwork: env.CONTRACTS_NETWORK || 'base-sepolia',
    contractsRpcUrl: env.CONTRACTS_RPC_URL || 'https://sepolia.base.org',
    contractsChainId: 84532, // Base Sepolia
  };
}

/**
 * Load contract addresses from config file
 */
export function loadContractAddresses(): ContractAddresses {
  try {
    const contractsPath = join(CONFIG_DIR, 'contracts.json');
    const contracts = JSON.parse(readFileSync(contractsPath, 'utf-8'));

    return {
      artistRegistry: contracts.ArtistRegistryV1,
      songRegistry: contracts.SongRegistryV1,
      segmentRegistry: contracts.SegmentRegistryV1,
      performanceRegistry: contracts.PerformanceRegistryV1,
      studentProfile: contracts.StudentProfileV1,
      leaderboard: contracts.LeaderboardV1,
    };
  } catch (error) {
    console.warn('⚠️  Contract addresses not found. Please deploy contracts first.');
    return {
      artistRegistry: '0x0000000000000000000000000000000000000000',
      songRegistry: '0x0000000000000000000000000000000000000000',
      segmentRegistry: '0x0000000000000000000000000000000000000000',
      performanceRegistry: '0x0000000000000000000000000000000000000000',
      studentProfile: '0x0000000000000000000000000000000000000000',
      leaderboard: '0x0000000000000000000000000000000000000000',
    };
  }
}

/**
 * Load full pipeline configuration
 */
export function loadPipelineConfig(): PipelineConfig {
  return {
    network: loadNetworkConfig(),
    contracts: loadContractAddresses(),
    dataDir: DATA_DIR,
  };
}

/**
 * Get path helpers
 */
export const paths = {
  // Data directories
  dataDir: () => DATA_DIR,
  artists: () => join(DATA_DIR, 'artists'),
  creators: () => join(DATA_DIR, 'creators'),
  accounts: () => join(DATA_DIR, 'accounts'),
  songs: () => join(DATA_DIR, 'songs'),
  segments: () => join(DATA_DIR, 'segments'),

  // Unified account paths (V2)
  account: (username: string) => join(DATA_DIR, 'accounts', `${username}.json`),

  // Artist paths (legacy V1)
  artist: (handle: string) => join(DATA_DIR, 'artists', handle),
  artistPkp: (handle: string) => join(DATA_DIR, 'artists', handle, 'pkp.json'),
  artistLens: (handle: string) => join(DATA_DIR, 'artists', handle, 'lens.json'),
  artistManifest: (handle: string) => join(DATA_DIR, 'artists', handle, 'manifest.json'),

  // Creator paths (legacy V1)
  creator: (handle: string) => join(DATA_DIR, 'creators', handle),
  creatorPkp: (handle: string) => join(DATA_DIR, 'creators', handle, 'pkp.json'),
  creatorLens: (handle: string) => join(DATA_DIR, 'creators', handle, 'lens.json'),
  creatorManifest: (handle: string) => join(DATA_DIR, 'creators', handle, 'manifest.json'),
  creatorVideo: (handle: string, videoHash: string) =>
    join(DATA_DIR, 'creators', handle, 'videos', videoHash),
  creatorVideoManifest: (handle: string, videoHash: string) =>
    join(DATA_DIR, 'creators', handle, 'videos', videoHash, 'manifest.json'),

  // Song paths
  song: (geniusId: number) => join(DATA_DIR, 'songs', geniusId.toString()),
  songMetadata: (geniusId: number) =>
    join(DATA_DIR, 'songs', geniusId.toString(), 'metadata.json'),
  songManifest: (geniusId: number) =>
    join(DATA_DIR, 'songs', geniusId.toString(), 'manifest.json'),
  songOriginal: (geniusId: number) =>
    join(DATA_DIR, 'songs', geniusId.toString(), 'original.flac'),

  // Segment paths
  segment: (hash: string) => join(DATA_DIR, 'segments', hash),
  segmentManifest: (hash: string) => join(DATA_DIR, 'segments', hash, 'manifest.json'),
  segmentTikTok: (hash: string) => join(DATA_DIR, 'segments', hash, 'tiktok_clip.mp4'),
  segmentVocals: (hash: string) => join(DATA_DIR, 'segments', hash, 'vocals.wav'),
  segmentInstrumental: (hash: string) => join(DATA_DIR, 'segments', hash, 'instrumental.wav'),
  segmentAlignment: (hash: string) => join(DATA_DIR, 'segments', hash, 'alignment.json'),
};

/**
 * Environment variable helpers
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}
