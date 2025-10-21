import { useReadContract } from 'wagmi'
import { CONTRACTS } from '@/lib/contracts/addresses'
import { ABIS } from '@/lib/contracts/abis'
import type { Address } from 'viem'

export interface Artist {
  geniusArtistId: number
  pkpAddress: Address
  lensHandle: string
  lensAccountAddress: Address
  verified: boolean
  createdAt: bigint
  updatedAt: bigint
}

/**
 * Get artist by Genius ID
 */
export function useArtist(geniusArtistId?: number) {
  return useReadContract({
    address: CONTRACTS.ArtistRegistryV1 as Address,
    abi: ABIS.ArtistRegistryV1,
    functionName: 'getArtist',
    args: geniusArtistId ? [geniusArtistId] : undefined,
    query: {
      enabled: !!geniusArtistId && geniusArtistId > 0,
    },
  })
}

/**
 * Get Genius ID by Lens handle
 */
export function useGeniusIdByLensHandle(lensHandle?: string) {
  return useReadContract({
    address: CONTRACTS.ArtistRegistryV1 as Address,
    abi: ABIS.ArtistRegistryV1,
    functionName: 'getGeniusIdByLensHandle',
    args: lensHandle ? [lensHandle] : undefined,
    query: {
      enabled: !!lensHandle && lensHandle.length > 0,
    },
  })
}

/**
 * Check if artist exists
 */
export function useArtistExists(geniusArtistId?: number) {
  return useReadContract({
    address: CONTRACTS.ArtistRegistryV1 as Address,
    abi: ABIS.ArtistRegistryV1,
    functionName: 'artistExists',
    args: geniusArtistId ? [geniusArtistId] : undefined,
    query: {
      enabled: !!geniusArtistId && geniusArtistId > 0,
    },
  })
}

/**
 * Get total number of artists
 */
export function useTotalArtists() {
  return useReadContract({
    address: CONTRACTS.ArtistRegistryV1 as Address,
    abi: ABIS.ArtistRegistryV1,
    functionName: 'getTotalArtists',
  })
}
