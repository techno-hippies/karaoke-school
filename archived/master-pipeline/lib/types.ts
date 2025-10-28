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
// Creator Types
// ============================================================================

export interface CreatorPKP {
  pkpPublicKey: string;
  pkpEthAddress: Address;
  pkpTokenId: string;
  ownerEOA: Address;
  network: string;
  mintedAt: string;
  transactionHash: Hex;
}

export interface CreatorIdentifiers {
  tiktokHandle: string;        // Primary identifier
  tiktokUserId?: string;        // TikTok API user ID
  instagramHandle?: string;
  youtubeChannelId?: string;
  spotifyCreatorId?: string;
}

export interface CreatorLens {
  lensHandle: string;           // Same as TikTok handle
  lensAccountAddress: Address;
  lensAccountId: Hex;
  network: string;
  createdAt: string;
  metadataUri: string;
  transactionHash: Hex;
}

export interface CreatorManifest {
  handle: string;               // TikTok handle (filesystem + Lens)
  displayName: string;          // Creator's display name
  identifiers: CreatorIdentifiers;
  pkp: CreatorPKP;
  lens: CreatorLens;
  videos: string[];             // Array of video hashes
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Creator Video Types
// ============================================================================

export interface MLCData {
  isrc: string;
  mlcSongCode: string;
  iswc: string;
  writers: Array<{
    name: string;
    ipi: string | null;
    role: string;
    share: number;
  }>;
  publishers: Array<{
    name: string;
    ipi: string;
    share: number;
    administrators: Array<{
      name: string;
      ipi: string;
      share: number;
    }>;
  }>;
  totalPublisherShare: number;
  storyMintable: boolean;
}

export interface VideoManifest {
  videoHash: string;
  creatorHandle: string;
  tiktokVideoId: string;
  tiktokUrl: string;

  song: {
    title: string;
    artist: string;
    spotifyId: string;
    isrc: string;
    geniusId?: number;
    mlcSongCode?: string;
  };

  match: {
    startTime: number;
    endTime: number;
    duration: number;
    confidence: number;
    method: string;
  };

  files: {
    originalVideo: string;
    segment: string;
    vocals: string;
    instrumental: string;
  };

  grove: {
    vocalsUri: string;
    instrumentalUri: string;
    alignmentUri: string;
  };

  licensing: MLCData;

  storyProtocol?: {
    ipId: string;
    parentIpId?: string;      // Original song IP (if registered)
    licenseTermsId?: string;
    mintedAt: string;
    transactionHash: Hex;
  };

  lens?: {
    postId: string;
    uri: string;
    transactionHash: Hex;
  };

  createdAt: string;
  updatedAt: string;
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
