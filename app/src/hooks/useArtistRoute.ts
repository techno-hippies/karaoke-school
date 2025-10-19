import { useState, useEffect } from 'react'
import { getArtistRoute } from '@/lib/genius/artist-lookup'

/**
 * Pre-fetch artist route for instant navigation
 *
 * This hook is MUCH simpler than originally proposed because:
 * - Song data from KaraokeCatalog already includes geniusArtistId
 * - We just pre-fetch the Lens username when song loads
 * - Clicking artist is instant (no async delay)
 *
 * Usage:
 * ```typescript
 * const artistRoute = useArtistRoute(displaySong?.geniusArtistId)
 * const handleClick = () => navigate(artistRoute)  // Instant!
 * ```
 */
export function useArtistRoute(geniusArtistId: number | undefined): string | null {
  const [route, setRoute] = useState<string | null>(null)

  useEffect(() => {
    if (!geniusArtistId) {
      setRoute(null)
      return
    }

    // Pre-fetch route when song data is available
    getArtistRoute(geniusArtistId)
      .then(r => setRoute(r))
      .catch(err => {
        console.error('[useArtistRoute] Failed to fetch route:', err)
        // Fallback to generic artist route
        setRoute(`/artist/${geniusArtistId}`)
      })
  }, [geniusArtistId])

  return route
}
