/**
 * Utility functions for Lit Actions
 */

import type { MatchSegmentResult } from './types'

/**
 * Format section for display
 */
export function formatSection(section: MatchSegmentResult['sections'][0]): string {
  const minutes = Math.floor(section.startTime / 60)
  const seconds = Math.floor(section.startTime % 60)
  return `${section.type} (${minutes}:${seconds.toString().padStart(2, '0')} - ${section.duration}s)`
}

/**
 * Generate segment ID from section (matches contract format)
 * Example: "Chorus 1" -> "chorus-1"
 */
export function generateSegmentId(section: MatchSegmentResult['sections'][0]): string {
  return section.type.toLowerCase().replace(/\s+/g, '-')
}
