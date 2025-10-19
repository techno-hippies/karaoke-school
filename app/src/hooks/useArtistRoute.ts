import { useMemo } from 'react'

/**
 * Generate artist route from artist name
 *
 * Sanitizes artist name to create Lens-compatible username.
 * This matches the logic used in profile generation so navigation is instant.
 *
 * Examples:
 * - "Charli XCX" → "/u/charlixcx"
 * - "Taylor Swift" → "/u/taylorswift"
 * - "21 Savage" → "/u/21savage"
 *
 * Usage:
 * ```typescript
 * const route = useArtistRoute(displaySong?.artist)
 * navigate(route, { state: { geniusArtistId } })
 * ```
 */
export function useArtistRoute(artistName: string | undefined): string | null {
  return useMemo(() => {
    if (!artistName) return null

    // Sanitize artist name to username (same logic as profile generation)
    const username = artistName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric chars
      .slice(0, 26) // Lens username max length

    return `/u/${username}`
  }, [artistName])
}
