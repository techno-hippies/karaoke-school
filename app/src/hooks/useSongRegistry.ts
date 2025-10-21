import { useReadContract } from 'wagmi'
import { CONTRACTS } from '@/lib/contracts/addresses'
import { ABIS } from '@/lib/contracts/abis'
import type { Address } from 'viem'

export interface Song {
  geniusId: number
  geniusArtistId: number
  spotifyId: string
  tiktokMusicId: string
  title: string
  artist: string
  duration: number
  coverUri: string
  metadataUri: string
  copyrightFree: boolean
  enabled: boolean
  createdAt: bigint
  updatedAt: bigint
}

/**
 * Get song by Genius ID
 */
export function useSong(geniusId?: number) {
  return useReadContract({
    address: CONTRACTS.SongRegistryV1 as Address,
    abi: ABIS.SongRegistryV1,
    functionName: 'getSong',
    args: geniusId ? [geniusId] : undefined,
    query: {
      enabled: !!geniusId && geniusId > 0,
    },
  })
}

/**
 * Check if song exists
 */
export function useSongExists(geniusId?: number) {
  return useReadContract({
    address: CONTRACTS.SongRegistryV1 as Address,
    abi: ABIS.SongRegistryV1,
    functionName: 'songExists',
    args: geniusId ? [geniusId] : undefined,
    query: {
      enabled: !!geniusId && geniusId > 0,
    },
  })
}

/**
 * Get total number of songs
 */
export function useTotalSongs() {
  return useReadContract({
    address: CONTRACTS.SongRegistryV1 as Address,
    abi: ABIS.SongRegistryV1,
    functionName: 'getTotalSongs',
  })
}

/**
 * Get songs by artist
 * Note: This queries on-chain. For production, use The Graph subgraph for efficient multi-song queries.
 */
export function useSongsByArtist(geniusArtistId?: number) {
  return useReadContract({
    address: CONTRACTS.SongRegistryV1 as Address,
    abi: ABIS.SongRegistryV1,
    functionName: 'getSongsByArtist',
    args: geniusArtistId ? [geniusArtistId] : undefined,
    query: {
      enabled: !!geniusArtistId && geniusArtistId > 0,
    },
  })
}
