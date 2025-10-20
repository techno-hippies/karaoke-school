/**
 * Type definitions for master pipeline
 */

import type { Address, Hex } from 'viem';

// ============================================================================
// Artist Types
// ============================================================================

export interface ArtistPKP {
  pkpPublicKey: string;
  pkpEthAddress: Address;
  pkpTokenId: string;
  ownerEOA: Address;
  network: string;
  mintedAt: string;
  transactionHash: Hex;
}

export interface ArtistIdentifiers {
  geniusArtistId: number;
  luminateId: string;
  musicbrainzId?: string;
  spotifyArtistId?: string;
  appleId?: string;
  isni?: string;
  ipi?: string;
}

export interface ArtistLens {
  lensHandle: string;
  lensAccountAddress: Address;
  lensAccountId: Hex;
  network: string;
  createdAt: string;
  metadataUri: string;
  transactionHash: Hex;
}

export interface ArtistOnChain {
  geniusArtistId: number;
  pkpAddress: Address;
  lensHandle: string;
  lensAccountAddress: Address;
  registeredAt: string;
  transactionHash: Hex;
}

export interface ArtistManifest {
  name: string;
  geniusArtistId: number;
  handle: string; // filesystem handle (e.g., "beyonce")
  identifiers: ArtistIdentifiers;
  pkp: ArtistPKP;
  lens: ArtistLens;
  onchain: ArtistOnChain;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Song Types
// ============================================================================

export interface SongMetadata {
  geniusSongId: number;
  title: string;
  artistName: string;
  artistGeniusId: number;
  spotifyId?: string;
  tiktokMusicId?: string;
  duration: number; // seconds
  coverArt: string;
  metadataUri?: string;
  fetchedAt: string;
}

export interface SongOnChain {
  geniusSongId: number;
  registeredAt: string;
  transactionHash: Hex;
  enabled: boolean;
}

export interface SongManifest {
  metadata: SongMetadata;
  onchain?: SongOnChain;
  segments: string[]; // Array of segment hashes
  originalPath?: string; // Path to original FLAC
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Segment Types
// ============================================================================

export interface TikTokClip {
  url: string;
  videoId: string;
  downloadedAt: string;
  filePath: string;
}

export interface AudioMatchResult {
  startTime: number; // seconds in original track
  endTime: number; // seconds in original track
  confidence: number; // 0-1
  method: 'dtw' | 'stt' | 'hybrid';
  matchedAt: string;
}

export interface ProcessedAudio {
  vocals: {
    filePath: string;
    groveUri?: string;
    duration: number;
  };
  instrumental: {
    filePath: string;
    groveUri?: string;
    duration: number;
  };
  alignment: {
    filePath: string;
    groveUri?: string;
  };
  processedAt: string;
}

export interface SegmentOnChain {
  segmentHash: Hex;
  songGeniusId: number;
  tiktokSegmentId: string;
  startTime: number;
  endTime: number;
  phase1RegisteredAt?: string;
  phase1TransactionHash?: Hex;
  phase2ProcessedAt?: string;
  phase2TransactionHash?: Hex;
}

export interface SegmentManifest {
  segmentHash: Hex;
  songGeniusId: number;
  tiktokSegmentId: string;
  tiktokClip: TikTokClip;
  audioMatch: AudioMatchResult;
  processedAudio?: ProcessedAudio;
  onchain?: SegmentOnChain;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Pipeline Config
// ============================================================================

export interface NetworkConfig {
  litNetwork: string;
  lensNetwork: string;
  contractsNetwork: string;
  contractsRpcUrl: string;
  contractsChainId: number;
}

export interface ContractAddresses {
  artistRegistry: Address;
  songRegistry: Address;
  segmentRegistry: Address;
  performanceRegistry: Address;
  studentProfile: Address;
  leaderboard: Address;
}

export interface PipelineConfig {
  network: NetworkConfig;
  contracts: ContractAddresses;
  dataDir: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface PipelineStep<T> {
  name: string;
  description: string;
  required: boolean;
  execute: () => Promise<T>;
}

export interface PipelineResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  duration: number; // milliseconds
}
