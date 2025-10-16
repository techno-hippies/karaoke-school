/**
 * Utility functions for Lit Actions
 */

import type { MatchSegmentResult } from './types'

export type SongSection = NonNullable<MatchSegmentResult['sections']>[number]

/**
 * Format section for display
 */
export function formatSection(section: SongSection): string {
  const minutes = Math.floor(section.startTime / 60)
  const seconds = Math.floor(section.startTime % 60)
  return `${section.type} (${minutes}:${seconds.toString().padStart(2, '0')} - ${section.duration}s)`
}

/**
 * Generate segment ID from section (matches contract format)
 * Example: "Chorus 1" -> "chorus-1"
 */
export function generateSegmentId(section: SongSection): string {
  return section.type.toLowerCase().replace(/\s+/g, '-')
}
