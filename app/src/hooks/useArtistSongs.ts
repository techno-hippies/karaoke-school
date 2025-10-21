import { useReadContracts } from 'wagmi'
import { CONTRACTS } from '@/lib/contracts/addresses'
import { ABIS } from '@/lib/contracts/abis'
import type { Address } from 'viem'
import { useSongsByArtist, type Song } from './useSongRegistry'

/**
 * Get full song data for an artist
 * First fetches song IDs, then fetches each song individually
 */
export function useArtistSongs(geniusArtistId?: number) {
  // Step 1: Get song IDs
  const { data: songIds, isLoading: isLoadingIds, error: idsError } = useSongsByArtist(geniusArtistId)

  // Step 2: Fetch each song individually
  const contracts = Array.isArray(songIds)
    ? (songIds as number[]).map((songId) => ({
        address: CONTRACTS.SongRegistryV1 as Address,
        abi: ABIS.SongRegistryV1,
        functionName: 'getSong',
        args: [songId],
      }))
    : []

  const { data: songsData, isLoading: isLoadingSongs, error: songsError } = useReadContracts({
    contracts,
    query: {
      enabled: !!songIds && Array.isArray(songIds) && songIds.length > 0,
    },
  })

  // Transform results
  const songs: Song[] = Array.isArray(songsData)
    ? songsData
        .filter((result) => result.status === 'success')
        .map((result) => result.result as Song)
    : []

  return {
    data: songs,
    isLoading: isLoadingIds || isLoadingSongs,
    error: idsError || songsError,
  }
}
