/**
 * Auto-generated mapping of Genius artist IDs to Lens usernames
 *
 * This file maps Genius artist IDs to Lens usernames for artists
 * who have PKP profiles. Artists without PKP profiles should use
 * the fallback /artist/:geniusArtistId route.
 *
 * Generated: 2025-10-17T11:56:51.293Z
 * Command: bun run generate-artist-mapping
 *
 * @see pkp-lens-flow/scripts/generate-artist-mapping.ts
 */

export const GENIUS_TO_LENS_USERNAME: Record<number, string> = {
  "1177": "taylorswifttiktok",
  "3422526": "billieeilishtiktok"
}

/**
 * Check if a Genius artist has a Lens profile (PKP)
 */
export function hasLensProfile(geniusArtistId: number): boolean {
  return geniusArtistId in GENIUS_TO_LENS_USERNAME
}

/**
 * Get Lens username for a Genius artist (if exists)
 * Returns null if artist doesn't have a PKP profile
 */
export function getLensUsername(geniusArtistId: number): string | null {
  return GENIUS_TO_LENS_USERNAME[geniusArtistId] || null
}

/**
 * Get the best route for an artist
 * - If artist has PKP profile: /u/:username (rich profile with videos + songs)
 * - If artist has no PKP: /artist/:geniusArtistId (Genius data only)
 */
export function getArtistRoute(geniusArtistId: number): string {
  const username = getLensUsername(geniusArtistId)
  return username ? `/u/${username}` : `/artist/${geniusArtistId}`
}
