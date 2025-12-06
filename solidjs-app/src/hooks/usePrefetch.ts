import { onMount } from 'solid-js'
import { useQueryClient } from '@tanstack/solid-query'
import { gql } from 'graphql-request'
import { graphClient } from '@/lib/graphql/client'
import { convertGroveUri } from '@/lib/lens/utils'

// ============================================================
// Chat Scenario Images - Preload on app boot
// ============================================================

const CHAT_SCENARIO_IMAGES = [
  '/images/scarlett/default.webp',
  '/images/scarlett/beach.webp',
  '/images/scarlett/cafe.webp',
  '/images/violet/default.webp',
  '/images/violet/nightclub.webp',
  '/images/violet/ramen.webp',
]

/**
 * Preload chat scenario images into browser cache
 * Call this once on app mount
 */
export function preloadChatImages() {
  CHAT_SCENARIO_IMAGES.forEach(src => {
    const img = new Image()
    img.src = src
  })
}

// ============================================================
// Song Data Prefetch - From feed video
// ============================================================

const CLIPS_QUERY = gql`
  query GetClips($spotifyTrackId: String!) {
    clips(
      where: { spotifyTrackId: $spotifyTrackId }
      orderBy: clipStartMs
      orderDirection: asc
      first: 1
    ) {
      id
      clipHash
      spotifyTrackId
      metadataUri
      instrumentalUri
      clipStartMs
      clipEndMs
    }
  }
`

interface PrefetchedClip {
  id: string
  clipHash: string
  spotifyTrackId: string
  metadataUri: string
  instrumentalUri?: string
  clipStartMs: number
  clipEndMs: number
}

/**
 * Prefetch song data for a spotify track ID
 * This primes the cache so song page loads instantly
 */
async function prefetchSongData(spotifyTrackId: string): Promise<void> {
  try {
    // Fetch clips from subgraph
    const data = await graphClient.request<{ clips: PrefetchedClip[] }>(
      CLIPS_QUERY,
      { spotifyTrackId }
    )

    if (!data.clips?.length) return

    const clip = data.clips[0]

    // Also prefetch the metadata JSON
    if (clip.metadataUri) {
      const metadataUrl = convertGroveUri(clip.metadataUri)
      const response = await fetch(metadataUrl)
      if (response.ok) {
        const metadata = await response.json()
        // Prefetch cover image
        if (metadata.coverUri) {
          const coverUrl = convertGroveUri(metadata.coverUri)
          const img = new Image()
          img.src = coverUrl
        }
      }
    }
  } catch (error) {
    // Silent fail - prefetch is best effort
    console.debug('[prefetch] Failed to prefetch song:', spotifyTrackId, error)
  }
}

/**
 * Hook to prefetch song data using TanStack Query
 * Call with spotifyTrackId when a video becomes active
 */
export function useSongPrefetch() {
  const queryClient = useQueryClient()

  const prefetch = (spotifyTrackId: string | undefined) => {
    if (!spotifyTrackId) return

    // Use query client's prefetch to integrate with cache
    queryClient.prefetchQuery({
      queryKey: ['song-clips', spotifyTrackId],
      queryFn: async () => {
        const data = await graphClient.request<{ clips: PrefetchedClip[] }>(
          CLIPS_QUERY,
          { spotifyTrackId }
        )
        if (!data.clips?.length) throw new Error('No clips')
        return { spotifyTrackId, clips: data.clips }
      },
      staleTime: 300000, // 5 minutes
    })

    // Also fire off metadata prefetch (not through query client since useSongClips
    // handles that separately, but we want to warm the browser cache)
    prefetchSongData(spotifyTrackId)
  }

  return { prefetch }
}

// ============================================================
// App-level prefetch hook
// ============================================================

/**
 * Hook to run all app-level prefetches on mount
 * Add this to App.tsx or AppShell
 */
export function useAppPrefetch() {
  onMount(() => {
    // Preload chat images immediately
    preloadChatImages()
  })
}
