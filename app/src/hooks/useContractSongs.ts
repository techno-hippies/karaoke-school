/**
 * useContractSongs
 * Hook to load recently catalogued songs from KaraokeCatalogV2 contract on Base Sepolia
 *
 * Uses the getRecentSongs() function to fetch the most recently added songs.
 * Returns up to 20 songs, sorted by addedAt timestamp (newest first).
 */

import { useState, useEffect } from 'react'
import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'
import { BASE_SEPOLIA_CONTRACTS } from '@/config/contracts'
import { KARAOKE_CATALOG_ABI } from '@/config/abis/karaokeCatalog'
import type { Song } from '@/features/post-flow/types'

// TODO: Use ContractSong interface when implementing direct contract reads
// interface ContractSong {
//   id: string
//   geniusId: number
//   title: string
//   artist: string
//   duration: number
//   hasFullAudio: boolean
//   requiresPayment: boolean
//   audioUri: string
//   metadataUri: string
//   coverUri: string
//   thumbnailUri: string
//   musicVideoUri: string
//   enabled: boolean
//   addedAt: bigint
// }

export interface UseContractSongsResult {
  songs: Song[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Converts Glens:// or lens:// URI to Grove storage URL
 * Note: "Glens" appears to be a typo in some contract data - should be "lens"
 * TODO: Use when parsing contract URIs
 */
// function lensToGroveUrl(lensUri: string): string {
//   if (!lensUri) return ''
//   // Handle both lens://, glen://, and Glens:// (case-insensitive)
//   const lower = lensUri.toLowerCase()
//   if (!lower.startsWith('lens') && !lower.startsWith('glen')) return ''
//   // Extract hash from lens://HASH or glen(s)://HASH format
//   const hash = lensUri.replace(/^(lens|glens?):\/\//i, '')
//   // Use Grove storage API (Lens chain storage backend)
//   return `https://api.grove.storage/${hash}`
// }

/**
 * Capitalize section names (e.g., "chorus" → "Chorus", "verse 1" → "Verse 1")
 * TODO: Use when formatting section names
 */
// function capitalizeSection(sectionType: string): string {
//   if (!sectionType) return ''
//   return sectionType
//     .split(' ')
//     .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
//     .join(' ')
// }

/**
 * Load songs from KaraokeCatalogV2 contract
 *
 * NOTE: V2 contract optimization removed getAllSongs() to fit under 24KB limit.
 * For now, returns empty trending list - users must search for songs.
 *
 * Future options:
 * 1. Hardcode popular song IDs in config (load via getSongByGeniusId)
 * 2. Add back pagination to contract (getSongAtIndex)
 * 3. Use off-chain indexer (The Graph, etc.)
 */
export function useContractSongs(): UseContractSongsResult {
  const [songs, setSongs] = useState<Song[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadSongs = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      })

      // Fetch the 20 most recently catalogued songs
      const recentSongs = await publicClient.readContract({
        address: BASE_SEPOLIA_CONTRACTS.karaokeCatalog,
        abi: KARAOKE_CATALOG_ABI,
        functionName: 'getRecentSongs',
        args: [20n], // BigInt for uint256
      }) as any[]

      console.log('[useContractSongs] Loaded', recentSongs.length, 'recent songs')

      // Transform contract songs to app Song format
      const transformedSongs: Song[] = recentSongs.map((contractSong) => ({
        id: contractSong.geniusId.toString(),
        geniusId: Number(contractSong.geniusId),
        title: contractSong.title,
        artist: contractSong.artist,
        artworkUrl: contractSong.thumbnailUri ?
          (contractSong.thumbnailUri.startsWith('lens://') || contractSong.thumbnailUri.startsWith('grove://')
            ? `https://api.grove.storage/${contractSong.thumbnailUri.replace(/^(lens|grove):\/\//, '')}`
            : contractSong.thumbnailUri)
          : undefined,
        isFree: !contractSong.requiresPayment,
        isProcessed: true, // All songs from catalog are processed
      }))

      setSongs(transformedSongs)
    } catch (err) {
      console.error('[useContractSongs] Error loading songs:', err)
      setError(err instanceof Error ? err : new Error('Failed to load songs'))
      setSongs([]) // Set empty array on error
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSongs()
  }, [])

  return {
    songs,
    isLoading,
    error,
    refetch: loadSongs,
  }
}
