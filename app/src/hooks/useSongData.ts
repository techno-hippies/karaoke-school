/**
 * useSongData
 * Hook to load a single song from KaraokeCatalogV2 contract by Genius ID
 */

import { useState, useEffect } from 'react'
import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'
import { BASE_SEPOLIA_CONTRACTS } from '@/config/contracts'
import { KARAOKE_CATALOG_ABI } from '@/config/abis/karaokeCatalog'
import type { Song } from '@/features/post-flow/types'
import type { SongSegment } from '@/components/class/SongPage'

/**
 * Converts lens:// URI to Grove storage URL
 */
function lensToGroveUrl(lensUri: string): string {
  if (!lensUri) return ''
  const lower = lensUri.toLowerCase()
  if (!lower.startsWith('lens') && !lower.startsWith('glen')) return lensUri
  const hash = lensUri.replace(/^(lens|glens?):\/\//i, '')
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

export interface UseSongDataResult {
  song: Song | null
  segments: SongSegment[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Load song data by Genius ID from contract
 * Fetches song metadata including segments from metadataUri
 */
export function useSongData(geniusId: number | undefined): UseSongDataResult {
  const [song, setSong] = useState<Song | null>(null)
  const [segments, setSegments] = useState<SongSegment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadSong = async () => {
    if (!geniusId) {
      setError(new Error('Genius ID is required'))
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      })

      // Check if song exists
      console.log('[useSongData] Checking if song exists for geniusId:', geniusId)
      console.log('[useSongData] Contract address:', BASE_SEPOLIA_CONTRACTS.karaokeCatalog)
      const songExists = await publicClient.readContract({
        address: BASE_SEPOLIA_CONTRACTS.karaokeCatalog,
        abi: KARAOKE_CATALOG_ABI,
        functionName: 'songExistsByGeniusId',
        args: [geniusId],
      }) as boolean

      console.log('[useSongData] Song exists check result:', songExists)

      if (!songExists) {
        // Song not in catalog yet - this is expected for unprocessed songs
        console.log('[useSongData] Song not found in catalog, returning null')
        setSong(null)
        setSegments([])
        return
      }

      // Load song data
      const songData = await publicClient.readContract({
        address: BASE_SEPOLIA_CONTRACTS.karaokeCatalog,
        abi: KARAOKE_CATALOG_ABI,
        functionName: 'getSongByGeniusId',
        args: [geniusId],
      }) as any

      console.log('[useSongData] Loaded song:', songData.title, 'by', songData.artist)

      // Load segments from metadata URI
      let loadedSegments: SongSegment[] = []
      if (songData.metadataUri) {
        try {
          const metadataUrl = lensToGroveUrl(songData.metadataUri)
          const metadataResp = await fetch(metadataUrl)
          const metadata = await metadataResp.json()

          if (metadata.sections && Array.isArray(metadata.sections)) {
            loadedSegments = metadata.sections.map((section: any, index: number) => ({
              id: `${section.type.toLowerCase().replace(/\s+/g, '-')}-${index}`,
              displayName: capitalizeSection(section.type),
              startTime: section.startTime,
              endTime: section.endTime,
              duration: section.duration,
              isOwned: false, // TODO: Check ownership from contract
            }))
            console.log('[useSongData] Loaded', loadedSegments.length, 'segments from metadata')
          }
        } catch (metaError) {
          console.error('[useSongData] Failed to load metadata:', metaError)
        }
      }

      const loadedSong: Song = {
        id: geniusId.toString(),
        geniusId,
        title: songData.title,
        artist: songData.artist,
        artworkUrl: songData.thumbnailUri ? lensToGroveUrl(songData.thumbnailUri) : undefined,
        isProcessed: true,
        isFree: !songData.requiresPayment,
        segments: loadedSegments,
        metadataUri: songData.metadataUri,
      }

      setSong(loadedSong)
      setSegments(loadedSegments)
    } catch (err) {
      console.error('[useSongData] Error loading song:', err)
      setError(err instanceof Error ? err : new Error('Failed to load song'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSong()
  }, [geniusId])

  return {
    song,
    segments,
    isLoading,
    error,
    refetch: loadSong,
  }
}
