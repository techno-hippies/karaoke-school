/**
 * ClipRegistryV1 Contract Interface
 * Provides type-safe interaction with the on-chain clip registry
 * Clips are TikTok-style short segments (15-60s) extracted from full songs
 */

export const CLIP_REGISTRY_V1_ABI = [
  // Events
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {"indexed": true, "name": "previousOwner", "type": "address"},
      {"indexed": true, "name": "newOwner", "type": "address"}
    ]
  },
  {
    "type": "event",
    "name": "ClipAdded",
    "inputs": [
      {"indexed": true, "name": "id", "type": "string"},
      {"indexed": false, "name": "title", "type": "string"},
      {"indexed": false, "name": "artist", "type": "string"},
      {"indexed": false, "name": "sectionType", "type": "string"},
      {"indexed": false, "name": "difficultyLevel", "type": "uint8"},
      {"indexed": false, "name": "enabled", "type": "bool"}
    ]
  },

  // Read Functions
  {
    "type": "function",
    "name": "getClip",
    "stateMutability": "view",
    "inputs": [{"name": "id", "type": "string"}],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "components": [
          {"name": "id", "type": "string"},
          {"name": "title", "type": "string"},
          {"name": "artist", "type": "string"},
          {"name": "sectionType", "type": "string"},
          {"name": "sectionIndex", "type": "uint8"},
          {"name": "duration", "type": "uint32"},
          {"name": "audioUri", "type": "string"},
          {"name": "instrumentalUri", "type": "string"},
          {"name": "timestampsUri", "type": "string"},
          {"name": "thumbnailUri", "type": "string"},
          {"name": "languages", "type": "string"},
          {"name": "difficultyLevel", "type": "uint8"},
          {"name": "wordsPerSecond", "type": "uint16"},
          {"name": "enabled", "type": "bool"}
        ]
      }
    ]
  },
  {
    "type": "function",
    "name": "getEnabledClips",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "components": [
          {"name": "id", "type": "string"},
          {"name": "title", "type": "string"},
          {"name": "artist", "type": "string"},
          {"name": "sectionType", "type": "string"},
          {"name": "sectionIndex", "type": "uint8"},
          {"name": "duration", "type": "uint32"},
          {"name": "audioUri", "type": "string"},
          {"name": "instrumentalUri", "type": "string"},
          {"name": "timestampsUri", "type": "string"},
          {"name": "thumbnailUri", "type": "string"},
          {"name": "languages", "type": "string"},
          {"name": "difficultyLevel", "type": "uint8"},
          {"name": "wordsPerSecond", "type": "uint16"},
          {"name": "enabled", "type": "bool"}
        ]
      }
    ]
  },
  {
    "type": "function",
    "name": "getClipsByDifficulty",
    "stateMutability": "view",
    "inputs": [
      {"name": "minLevel", "type": "uint8"},
      {"name": "maxLevel", "type": "uint8"}
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "components": [
          {"name": "id", "type": "string"},
          {"name": "title", "type": "string"},
          {"name": "artist", "type": "string"},
          {"name": "sectionType", "type": "string"},
          {"name": "sectionIndex", "type": "uint8"},
          {"name": "duration", "type": "uint32"},
          {"name": "audioUri", "type": "string"},
          {"name": "instrumentalUri", "type": "string"},
          {"name": "timestampsUri", "type": "string"},
          {"name": "thumbnailUri", "type": "string"},
          {"name": "languages", "type": "string"},
          {"name": "difficultyLevel", "type": "uint8"},
          {"name": "wordsPerSecond", "type": "uint16"},
          {"name": "enabled", "type": "bool"}
        ]
      }
    ]
  },
  {
    "type": "function",
    "name": "getClipsByPace",
    "stateMutability": "view",
    "inputs": [
      {"name": "minWps", "type": "uint16"},
      {"name": "maxWps", "type": "uint16"}
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "components": [
          {"name": "id", "type": "string"},
          {"name": "title", "type": "string"},
          {"name": "artist", "type": "string"},
          {"name": "sectionType", "type": "string"},
          {"name": "sectionIndex", "type": "uint8"},
          {"name": "duration", "type": "uint32"},
          {"name": "audioUri", "type": "string"},
          {"name": "instrumentalUri", "type": "string"},
          {"name": "timestampsUri", "type": "string"},
          {"name": "thumbnailUri", "type": "string"},
          {"name": "languages", "type": "string"},
          {"name": "difficultyLevel", "type": "uint8"},
          {"name": "wordsPerSecond", "type": "uint16"},
          {"name": "enabled", "type": "bool"}
        ]
      }
    ]
  },
  {
    "type": "function",
    "name": "getClipCount",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}]
  },
  {
    "type": "function",
    "name": "clipExists",
    "stateMutability": "view",
    "inputs": [{"name": "id", "type": "string"}],
    "outputs": [{"name": "", "type": "bool"}]
  },

  // Write Functions (Owner only)
  {
    "type": "function",
    "name": "addClip",
    "stateMutability": "nonpayable",
    "inputs": [
      {"name": "id", "type": "string"},
      {"name": "title", "type": "string"},
      {"name": "artist", "type": "string"},
      {"name": "sectionType", "type": "string"},
      {"name": "sectionIndex", "type": "uint8"},
      {"name": "duration", "type": "uint32"},
      {"name": "audioUri", "type": "string"},
      {"name": "instrumentalUri", "type": "string"},
      {"name": "timestampsUri", "type": "string"},
      {"name": "thumbnailUri", "type": "string"},
      {"name": "languages", "type": "string"},
      {"name": "difficultyLevel", "type": "uint8"},
      {"name": "wordsPerSecond", "type": "uint16"}
    ],
    "outputs": []
  },
  {
    "type": "function",
    "name": "toggleClip",
    "stateMutability": "nonpayable",
    "inputs": [{"name": "id", "type": "string"}],
    "outputs": []
  },

  // Ownership
  {
    "type": "function",
    "name": "owner",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"name": "", "type": "address"}]
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "stateMutability": "nonpayable",
    "inputs": [{"name": "newOwner", "type": "address"}],
    "outputs": []
  }
] as const;

// TypeScript interfaces matching contract structs
export interface ContractClip {
  id: string;
  title: string;
  artist: string;
  sectionType: string;       // "Verse", "Chorus", "Bridge", etc.
  sectionIndex: number;       // uint8 -> number (which occurrence: 0 = first)
  duration: number;           // uint32 -> number (15-60 seconds)
  audioUri: string;           // lens:// URI to vocals audio
  instrumentalUri: string;    // lens:// URI to backing track
  timestampsUri: string;      // lens:// URI to word timestamps JSON
  thumbnailUri: string;       // lens:// URI to cover image
  languages: string;          // Comma-separated language codes
  difficultyLevel: number;    // uint8 -> number (1-5)
  wordsPerSecond: number;     // uint16 -> number (pace * 10, e.g., 11 = 1.1 wps)
  enabled: boolean;
}

// Mapped interface for easier frontend usage
export interface RegistryClip {
  id: string;
  title: string;
  artist: string;
  sectionType: string;
  sectionIndex: number;
  duration: number;           // in seconds
  audioUri: string;           // lens:// URI to vocals
  instrumentalUri: string;    // lens:// URI to backing track
  timestampsUri: string;      // lens:// URI to metadata
  thumbnailUri: string;       // lens:// URI to cover
  languages: string[];        // Parsed array
  difficultyLevel: number;    // 1-5
  wordsPerSecond: number;     // Actual value (1.1, not 11)
  enabled: boolean;
}

// Convert contract clip to frontend format
export function mapContractClip(contractClip: ContractClip): RegistryClip {
  return {
    id: contractClip.id,
    title: contractClip.title,
    artist: contractClip.artist,
    sectionType: contractClip.sectionType,
    sectionIndex: contractClip.sectionIndex,
    duration: contractClip.duration,
    audioUri: contractClip.audioUri,
    instrumentalUri: contractClip.instrumentalUri,
    timestampsUri: contractClip.timestampsUri,
    thumbnailUri: contractClip.thumbnailUri,
    languages: contractClip.languages.split(',').map(l => l.trim()),
    difficultyLevel: contractClip.difficultyLevel,
    wordsPerSecond: contractClip.wordsPerSecond / 10, // Convert back to decimal
    enabled: contractClip.enabled
  };
}

// Contract deployment addresses
export const CLIP_REGISTRY_V1_ADDRESSES = {
  // Lens Chain Testnet
  37111: '0x59fCAe6753041C7b2E2ad443e4F2342Af46b81bf',
} as const;

export type SupportedChainId = keyof typeof CLIP_REGISTRY_V1_ADDRESSES;

export function getClipRegistryAddress(chainId: number): string {
  const address = CLIP_REGISTRY_V1_ADDRESSES[chainId as SupportedChainId];
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    throw new Error(`ClipRegistryV1 not deployed on chain ${chainId}`);
  }
  return address;
}
