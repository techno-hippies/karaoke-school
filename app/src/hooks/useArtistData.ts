/**
 * useArtistData
 * Hook to fetch artist metadata and top songs from Genius via Lit Action
 */

import { useState, useEffect } from 'react'
import { executeArtistMetadata, type ArtistMetadataResult } from '@/lib/lit/actions'
import type { PKPAuthContext } from '@/lib/lit-webauthn/types'

export interface UseArtistDataOptions {
  artistId: number | undefined
  pkpAuthContext: PKPAuthContext | null
  includeTopSongs?: boolean
}

export interface UseArtistDataResult {
  artist: ArtistMetadataResult['artist'] | null
  topSongs: ArtistMetadataResult['topSongs'] | null
  isLoading: boolean
  error: Error | null
}

/**
 * Fetch artist metadata and top songs via Lit Action
 *
 * @param options - artistId, PKP auth context, and options
 * @returns Artist data, top songs, loading state, and error
 */
export function useArtistData({
  artistId,
  pkpAuthContext,
  includeTopSongs = true,
}: UseArtistDataOptions): UseArtistDataResult {
  const [artist, setArtist] = useState<ArtistMetadataResult['artist'] | null>(null)
  const [topSongs, setTopSongs] = useState<ArtistMetadataResult['topSongs'] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!artistId || !pkpAuthContext) {
      return
    }

    let cancelled = false

    const fetchArtistData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        console.log('[useArtistData] Fetching artist metadata...', {
          artistId,
          includeTopSongs
        })

        const result = await executeArtistMetadata(artistId, pkpAuthContext, includeTopSongs)

        if (cancelled) return

        if (result.success && result.artist) {
          setArtist(result.artist)
          setTopSongs(result.topSongs || null)
          console.log('[useArtistData] ✅ Artist data loaded:', result.artist.name)
        } else {
          throw new Error(result.error || 'Failed to fetch artist data')
        }
      } catch (err) {
        if (cancelled) return

        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error('[useArtistData] ❌ Error:', errorMessage)
        setError(new Error(errorMessage))
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchArtistData()

    return () => {
      cancelled = true
    }
  }, [artistId, pkpAuthContext, includeTopSongs])

  return {
    artist,
    topSongs,
    isLoading,
    error
  }
}
