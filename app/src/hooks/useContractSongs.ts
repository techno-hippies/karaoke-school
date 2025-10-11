/**
 * useContractSongs
 * Hook to load songs from KaraokeCatalogV1 contract on Base Sepolia
 */

import { useState, useEffect } from 'react'
import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'
import { BASE_SEPOLIA_CONTRACTS } from '@/config/contracts'
import { KARAOKE_CATALOG_ABI } from '@/config/abis/karaokeCatalog'
import type { Song } from '@/features/post-flow/types'

interface ContractSong {
  id: string
  geniusId: number
  geniusArtistId: number
  title: string
  artist: string
  duration: number
  hasFullAudio: boolean
  requiresPayment: boolean
  audioUri: string
  metadataUri: string
  coverUri: string
  thumbnailUri: string
  musicVideoUri: string
  segmentHashes: `0x${string}`[]
  languages: string
  enabled: boolean
  addedAt: bigint
}

export interface UseContractSongsResult {
  songs: Song[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Converts Glens:// or lens:// URI to Grove storage URL
 * Note: "Glens" appears to be a typo in some contract data - should be "lens"
 */
function lensToGroveUrl(lensUri: string): string {
  if (!lensUri) return ''
  // Handle both lens://, glen://, and Glens:// (case-insensitive)
  const lower = lensUri.toLowerCase()
  if (!lower.startsWith('lens') && !lower.startsWith('glen')) return ''
  // Extract hash from lens://HASH or glen(s)://HASH format
  const hash = lensUri.replace(/^(lens|glens?):\/\//i, '')
  // Use Grove storage API (Lens chain storage backend)
  return `https://api.grove.storage/${hash}`
}

/**
 * Capitalize section names (e.g., "chorus" → "Chorus", "verse 1" → "Verse 1")
 */
function capitalizeSection(sectionType: string): string {
  if (!sectionType) return ''
  return sectionType
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Load all songs from KaraokeCatalogV1 contract
 */
export function useContractSongs(): UseContractSongsResult {
  const [songs, setSongs] = useState<Song[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadSongs = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Create public client for Base Sepolia
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      })

      // Query contract
      const rawSongs = (await publicClient.readContract({
        address: BASE_SEPOLIA_CONTRACTS.karaokeCatalog,
        abi: KARAOKE_CATALOG_ABI,
        functionName: 'getAllSongs',
      })) as ContractSong[]

      console.log('[useContractSongs] Raw songs from contract:', rawSongs)

      // Map to frontend Song interface and load segments for each song
      const mapped: Song[] = []

      for (const s of rawSongs.filter((s) => s.enabled)) {
        let segments: any[] = []

        // Load segments if song has them
        if (s.segmentHashes.length > 0) {
          try {
            const rawSegments = (await publicClient.readContract({
              address: BASE_SEPOLIA_CONTRACTS.karaokeCatalog,
              abi: KARAOKE_CATALOG_ABI,
              functionName: 'getSegmentsForSong',
              args: [s.geniusId],
            })) as any[]

            segments = rawSegments.map((seg: any) => ({
              id: seg.segmentId,
              displayName: capitalizeSection(seg.sectionType),
              startTime: Number(seg.startTime),
              endTime: Number(seg.endTime),
              duration: Number(seg.duration),
              isOwned: false, // TODO: Check ownership
            }))

            console.log(`[useContractSongs] Loaded ${segments.length} segments for ${s.title}`)

            // NOTE: This only loads segments that were created in the contract.
            // To load ALL sections from match-and-segment (verse-1, verse-2, chorus-1, etc.),
            // we need to either:
            // 1. Store all sections in metadataUri JSON
            // 2. Have Lit Action write all segments to contract (not just processed ones)
            // 3. Re-run match-and-segment Lit Action on-demand (expensive)
          } catch (err) {
            console.warn(`[useContractSongs] Failed to load segments for ${s.title}:`, err)
          }
        }

        mapped.push({
          id: s.id,
          geniusId: Number(s.geniusId),
          title: s.title,
          artist: s.artist,
          artworkUrl: s.coverUri ? lensToGroveUrl(s.coverUri) : undefined,
          isFree: !s.requiresPayment,
          isProcessed: s.hasFullAudio || s.segmentHashes.length > 0,
          segments,
        })
      }

      // Sort by addedAt (newest first)
      mapped.sort((a, b) => {
        const aTime = rawSongs.find((r) => r.id === a.id)?.addedAt || 0n
        const bTime = rawSongs.find((r) => r.id === b.id)?.addedAt || 0n
        return Number(bTime - aTime)
      })

      console.log('[useContractSongs] Mapped songs:', mapped)
      setSongs(mapped)
    } catch (err) {
      console.error('[useContractSongs] Error loading songs:', err)
      setError(err instanceof Error ? err : new Error('Failed to load songs'))
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
