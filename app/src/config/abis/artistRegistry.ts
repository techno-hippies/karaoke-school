import { parseAbiItem } from 'viem'

/**
 * ArtistRegistryV2 ABI
 * Minimal ABI for querying artist data
 */
export const ARTIST_REGISTRY_ABI = [
  parseAbiItem('function artistExists(uint32 geniusArtistId) external view returns (bool)'),
  parseAbiItem('function getLensHandle(uint32 geniusArtistId) external view returns (string memory)'),
  parseAbiItem('function getPKPAddress(uint32 geniusArtistId) external view returns (address)'),
  parseAbiItem('function getGeniusIdByLensHandle(string calldata lensHandle) external view returns (uint32)'),

  // getArtist returns Artist struct
  {
    name: 'getArtist',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'geniusArtistId', type: 'uint32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'geniusArtistId', type: 'uint32' },
          { name: 'pkpAddress', type: 'address' },
          { name: 'lensHandle', type: 'string' },
          { name: 'lensAccountAddress', type: 'address' },
          { name: 'source', type: 'uint8' },
          { name: 'verified', type: 'bool' },
          { name: 'hasContent', type: 'bool' },
          { name: 'createdAt', type: 'uint64' },
          { name: 'updatedAt', type: 'uint64' },
        ],
      },
    ],
  },
] as const
