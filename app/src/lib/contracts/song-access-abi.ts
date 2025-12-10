/**
 * SongAccess contract ABI for Base Sepolia
 * ETH-based payments (single signature!)
 */

export const SONG_ACCESS_ABI = [
  {
    inputs: [{ name: 'spotifyTrackId', type: 'string' }],
    name: 'purchase',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spotifyTrackId', type: 'string' },
      { name: 'recipient', type: 'address' },
    ],
    name: 'purchaseFor',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'spotifyTrackId', type: 'string' },
    ],
    name: 'ownsSongByTrackId',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'price',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const
