/**
 * useSongData
 * Hook to load a single song from KaraokeCatalogV2 contract by Genius ID
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
 *
 * @param geniusId - Genius song ID
 * @param userAddress - Optional user address to check song ownership
 */
export function useSongData(geniusId: number | undefined, userAddress?: string): UseSongDataResult {
  const [song, setSong] = useState<Song | null>(null)
  const [segments, setSegments] = useState<SongSegment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [refreshCount, setRefreshCount] = useState(0)

  // Use ref to track loading state for strict mode guard
  const isLoadingRef = useRef(false)

  const loadSong = useCallback(async () => {
    if (!geniusId) {
      setError(new Error('Genius ID is required'))
      return
    }

    // Prevent duplicate loads (React Strict Mode guard)
    if (isLoadingRef.current) {
      console.log('[useSongData] Already loading, skipping duplicate call')
      return
    }

    try {
      isLoadingRef.current = true
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
      console.log('[useSongData] Raw songData:', {
        metadataUri: songData.metadataUri,
        sectionsUri: songData.sectionsUri,
        alignmentUri: songData.alignmentUri,
        keys: Object.keys(songData)
      })

      // Load segments and alignment from separate URIs (V2: Decoupled storage)
      let loadedSegments: SongSegment[] = []
      let hasBaseAlignment = false

      // Try new sectionsUri first, fall back to old metadataUri for backwards compatibility
      const sectionsSource = songData.sectionsUri || songData.metadataUri
      if (sectionsSource) {
        try {
          const sectionsUrl = lensToGroveUrl(sectionsSource)
          const sectionsResp = await fetch(sectionsUrl)
          const sectionsData = await sectionsResp.json()

          if (sectionsData.sections && Array.isArray(sectionsData.sections)) {
            loadedSegments = sectionsData.sections.map((section: any, index: number) => ({
              id: `${section.type.toLowerCase().replace(/\s+/g, '-')}-${index}`,
              displayName: capitalizeSection(section.type),
              startTime: section.startTime,
              endTime: section.endTime,
              duration: section.duration,
              isOwned: false, // TODO: Check ownership from contract
            }))
            console.log('[useSongData] Loaded', loadedSegments.length, 'segments from sectionsUri')
          }
        } catch (sectionsError) {
          console.error('[useSongData] Failed to load sections:', sectionsError)
        }
      }

      // Check for base-alignment from alignmentUri (or fall back to metadataUri)
      const alignmentSource = songData.alignmentUri || songData.metadataUri
      if (alignmentSource) {
        try {
          const alignmentUrl = lensToGroveUrl(alignmentSource)
          const alignmentResp = await fetch(alignmentUrl)
          const alignmentData = await alignmentResp.json()

          // Check if base-alignment has been run (metadata contains lines array)
          hasBaseAlignment = !!(alignmentData.lines && Array.isArray(alignmentData.lines) && alignmentData.lines.length > 0)
          console.log('[useSongData] Base-alignment detection:', {
            hasLines: !!alignmentData.lines,
            lineCount: alignmentData.lines?.length || 0,
            hasBaseAlignment
          })
        } catch (alignmentError) {
          console.error('[useSongData] Failed to load alignment:', alignmentError)
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
        isOwned: false, // Will be checked separately if userAddress is provided
        segments: loadedSegments,
        metadataUri: songData.metadataUri,
        alignmentUri: songData.alignmentUri,
        sectionsUri: songData.sectionsUri,
        soundcloudPermalink: songData.soundcloudPath || undefined,
        hasBaseAlignment,
      }

      console.log('[useSongData] Final song state:', {
        hasBaseAlignment,
        isOwned: false,
        segmentCount: loadedSegments.length,
        metadataUri: songData.metadataUri
      })

      setSong(loadedSong)
      setSegments(loadedSegments)
    } catch (err) {
      console.error('[useSongData] Error loading song:', err)
      setError(err instanceof Error ? err : new Error('Failed to load song'))
    } finally {
      isLoadingRef.current = false
      setIsLoading(false)
    }
  }, [geniusId])

  useEffect(() => {
    loadSong()
  }, [loadSong])

  // Separate effect to check ownership when user address becomes available
  // This prevents full song refetch just to update ownership status
  useEffect(() => {
    if (!song || !userAddress || !geniusId) return

    const checkOwnership = async () => {
      try {
        const { checkSongOwnership } = await import('@/lib/credits/queries')
        const isOwned = await checkSongOwnership(userAddress, geniusId)

        if (isOwned) {
          console.log('[useSongData] User owns this song')
          setSong(prev => prev ? { ...prev, isOwned: true } : null)
        }
      } catch (ownershipError) {
        console.error('[useSongData] Failed to check ownership:', ownershipError)
      }
    }

    checkOwnership()
  }, [userAddress, song?.id, geniusId])

  // Memoize refetch to trigger controlled re-loads
  const refetch = useCallback(async () => {
    setRefreshCount(c => c + 1)
    await loadSong()
  }, [loadSong])

  // Memoize return values to prevent unnecessary re-renders downstream
  return useMemo(() => ({
    song,
    segments,
    isLoading,
    error,
    refetch,
  }), [song, segments, isLoading, error, refetch])
}
