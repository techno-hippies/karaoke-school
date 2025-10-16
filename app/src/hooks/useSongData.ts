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
 * Handles formats like:
 * - lens://hash
 * - lens://hash:1 (Lens protocol version/ID)
 */
function lensToGroveUrl(lensUri: string): string {
  if (!lensUri) return ''
  const lower = lensUri.toLowerCase()
  if (!lower.startsWith('lens') && !lower.startsWith('glen')) return lensUri

  // Remove lens:// prefix and any trailing :number suffix
  const hash = lensUri
    .replace(/^(lens|glens?):\/\//i, '')
    .replace(/:\d+$/, '') // Strip trailing :1, :2, etc.

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
  const [, setRefreshCount] = useState(0) // refreshCount not read, only set

  // Use ref to track loading state for strict mode guard
  const isLoadingRef = useRef(false)

  // Track previous segments to avoid unnecessary array recreations
  const prevSegmentsRef = useRef<SongSegment[]>([])

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
        // Only update segments if it's not already empty
        if (prevSegmentsRef.current.length > 0) {
          prevSegmentsRef.current = []
          setSegments([])
        }
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
        artworkUrl: undefined, // Use Genius artwork from navigation state or metadata fetch
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

      // Check if segments actually changed to prevent unnecessary re-renders
      const segmentsChanged = loadedSegments.length !== prevSegmentsRef.current.length ||
        loadedSegments.some((seg, i) => {
          const prev = prevSegmentsRef.current[i]
          return !prev ||
                 seg.id !== prev.id ||
                 seg.startTime !== prev.startTime ||
                 seg.endTime !== prev.endTime ||
                 seg.duration !== prev.duration ||
                 seg.displayName !== prev.displayName
        })

      if (segmentsChanged) {
        console.log('[useSongData] Segments changed, updating state')
        prevSegmentsRef.current = loadedSegments
        setSegments(loadedSegments)
      } else {
        console.log('[useSongData] Segments unchanged, reusing previous reference')
        // Use previous reference to maintain stability and prevent re-renders
        setSegments(prevSegmentsRef.current)
      }

      setSong(loadedSong)
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
  // Use ref to prevent re-running when song object changes (only run when song.id or userAddress changes)
  const lastCheckedOwnership = useRef<{ songId: string; userAddress: string } | null>(null)

  useEffect(() => {
    if (!song || !userAddress || !geniusId) return

    // Skip if already marked as owned
    if (song.isOwned) return

    // Skip if we already checked for this song + user combo
    if (lastCheckedOwnership.current?.songId === song.id &&
        lastCheckedOwnership.current?.userAddress === userAddress) {
      return
    }

    const checkOwnership = async () => {
      try {
        const { checkSongOwnership } = await import('@/lib/credits/queries')
        const isOwned = await checkSongOwnership(userAddress, geniusId)

        // Mark as checked
        lastCheckedOwnership.current = { songId: song.id, userAddress }

        if (isOwned) {
          console.log('[useSongData] User owns this song')
          // Only update if ownership actually changed
          setSong(prev => {
            if (!prev || prev.isOwned) return prev
            return { ...prev, isOwned: true }
          })
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
