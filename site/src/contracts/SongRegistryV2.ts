/**
 * SongRegistryV2 Contract Interface
 * Provides type-safe interaction with the on-chain song registry
 */

export const SONG_REGISTRY_V2_ABI = [
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
    "name": "SongAdded",
    "inputs": [
      {"indexed": true, "name": "id", "type": "string"},
      {"indexed": false, "name": "title", "type": "string"},
      {"indexed": false, "name": "artist", "type": "string"},
      {"indexed": false, "name": "languages", "type": "string"},
      {"indexed": false, "name": "addedAt", "type": "uint64"}
    ]
  },

  // Read Functions
  {
    "type": "function",
    "name": "getSong",
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
          {"name": "duration", "type": "uint32"},
          {"name": "audioUri", "type": "string"},
          {"name": "timestampsUri", "type": "string"},
          {"name": "thumbnailUri", "type": "string"},
          {"name": "languages", "type": "string"},
          {"name": "addedAt", "type": "uint64"}
        ]
      }
    ]
  },
  {
    "type": "function",
    "name": "getAllSongs",
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
          {"name": "duration", "type": "uint32"},
          {"name": "audioUri", "type": "string"},
          {"name": "timestampsUri", "type": "string"},
          {"name": "thumbnailUri", "type": "string"},
          {"name": "languages", "type": "string"},
          {"name": "addedAt", "type": "uint64"}
        ]
      }
    ]
  },
  {
    "type": "function",
    "name": "getSongByIndex",
    "stateMutability": "view",
    "inputs": [{"name": "index", "type": "uint256"}],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "components": [
          {"name": "id", "type": "string"},
          {"name": "title", "type": "string"},
          {"name": "artist", "type": "string"},
          {"name": "duration", "type": "uint32"},
          {"name": "audioUri", "type": "string"},
          {"name": "timestampsUri", "type": "string"},
          {"name": "thumbnailUri", "type": "string"},
          {"name": "languages", "type": "string"},
          {"name": "addedAt", "type": "uint64"}
        ]
      }
    ]
  },
  {
    "type": "function",
    "name": "getSongCount",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}]
  },
  {
    "type": "function",
    "name": "getSongsBatch",
    "stateMutability": "view",
    "inputs": [
      {"name": "startIndex", "type": "uint256"},
      {"name": "endIndex", "type": "uint256"}
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "components": [
          {"name": "id", "type": "string"},
          {"name": "title", "type": "string"},
          {"name": "artist", "type": "string"},
          {"name": "duration", "type": "uint32"},
          {"name": "audioUri", "type": "string"},
          {"name": "timestampsUri", "type": "string"},
          {"name": "thumbnailUri", "type": "string"},
          {"name": "languages", "type": "string"},
          {"name": "addedAt", "type": "uint64"}
        ]
      }
    ]
  },
  {
    "type": "function",
    "name": "songExists",
    "stateMutability": "view",
    "inputs": [{"name": "id", "type": "string"}],
    "outputs": [{"name": "", "type": "bool"}]
  },

  // Write Functions (Owner only)
  {
    "type": "function",
    "name": "addSong",
    "stateMutability": "nonpayable",
    "inputs": [
      {"name": "id", "type": "string"},
      {"name": "title", "type": "string"},
      {"name": "artist", "type": "string"},
      {"name": "duration", "type": "uint32"},
      {"name": "audioUri", "type": "string"},
      {"name": "timestampsUri", "type": "string"},
      {"name": "thumbnailUri", "type": "string"},
      {"name": "languages", "type": "string"}
    ],
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
export interface ContractSong {
  id: string;
  title: string;
  artist: string;
  duration: number; // uint32 -> number
  audioUri: string;
  timestampsUri: string;
  thumbnailUri: string;
  languages: string; // Comma-separated language codes
  addedAt: bigint; // uint64 -> bigint
}

// Mapped interface for easier frontend usage
export interface RegistrySong {
  id: string;
  title: string;
  artist: string;
  duration: number; // in seconds
  audioUri: string;      // lens:// URI to audio file
  timestampsUri: string; // lens:// URI to lyrics/timestamps JSON
  thumbnailUri: string;  // lens:// URI to cover image
  metadataUri?: string;  // Optional additional metadata
  addedAt: string;       // ISO string format
}

// Convert contract song to frontend format
export function mapContractSong(contractSong: ContractSong): RegistrySong {
  return {
    id: contractSong.id,
    title: contractSong.title,
    artist: contractSong.artist,
    duration: contractSong.duration,
    audioUri: contractSong.audioUri,
    timestampsUri: contractSong.timestampsUri,
    thumbnailUri: contractSong.thumbnailUri,
    metadataUri: contractSong.languages, // Use languages as metadata for now
    addedAt: new Date(Number(contractSong.addedAt) * 1000).toISOString()
  };
}

// Contract deployment addresses
export const SONG_REGISTRY_V2_ADDRESSES = {
  // Lens Chain Testnet - Updated to V3
  37111: '0x183f6Ac8eff12a642F996b67B404993c385F46Fb',
} as const;

export type SupportedChainId = keyof typeof SONG_REGISTRY_V2_ADDRESSES;

export function getSongRegistryAddress(chainId: number): string {
  const address = SONG_REGISTRY_V2_ADDRESSES[chainId as SupportedChainId];
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    throw new Error(`SongRegistryV2 not deployed on chain ${chainId}`);
  }
  return address;
}