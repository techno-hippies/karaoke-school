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
    contractsNetwork: 'lens-testnet', // All events on Lens Chain
    contractsRpcUrl: env.LENS_CHAIN_RPC_URL || 'https://rpc.testnet.lens.xyz',
    contractsChainId: 37111, // Lens Chain testnet
  };
}

/**
 * Load contract addresses from environment (Lens Chain event emitters)
 */
export function loadContractAddresses(): ContractAddresses {
  const env = process.env;

  return {
    artistRegistry: (env.ACCOUNT_EVENTS_ADDRESS || '0x0000000000000000000000000000000000000000') as any,
    songRegistry: (env.SONG_EVENTS_ADDRESS || '0x0000000000000000000000000000000000000000') as any,
    segmentRegistry: (env.SEGMENT_EVENTS_ADDRESS || '0x0000000000000000000000000000000000000000') as any,
    performanceRegistry: (env.PERFORMANCE_GRADER_ADDRESS || '0x0000000000000000000000000000000000000000') as any,
    studentProfile: '0x0000000000000000000000000000000000000000' as any,
    leaderboard: '0x0000000000000000000000000000000000000000' as any,
  };
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
  accountsDir: () => join(DATA_DIR, 'accounts'),
  songsDir: () => join(DATA_DIR, 'songs'),
  segmentsDir: () => join(DATA_DIR, 'segments'),

  // Unified account paths (V2)
  account: (username: string) => join(DATA_DIR, 'accounts', `${username}.json`),

  // Unified song paths (V2)
  song: (geniusId: string) => join(DATA_DIR, 'songs', `${geniusId}.json`),

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

  // Song paths (legacy V1 - directories)
  songDir: (geniusId: number) => join(DATA_DIR, 'songs', geniusId.toString()),
  songMetadataV1: (geniusId: number) =>
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
