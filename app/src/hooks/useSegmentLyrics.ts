/**
 * useSegmentLyrics
 * Hook to load word-level lyrics for a specific segment from base-alignment metadata
 */

import { useState, useEffect } from 'react'
import type { LyricLine } from '@/types/karaoke'

interface BaseAlignmentLine {
  id: string
  start: number
  end: number
  text: string
  words: Array<{
    text: string
    start: number
    end: number
  }>
}

interface UseSegmentLyricsResult {
  lyrics: LyricLine[]
  isLoading: boolean
  error: Error | null
}

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
 * Load lyrics for a specific segment from base-alignment metadata
 *
 * @param metadataUri - lens:// URI pointing to base-alignment metadata
 * @param segmentStartTime - Segment start time in seconds
 * @param segmentEndTime - Segment end time in seconds
 */
export function useSegmentLyrics(
  metadataUri: string | undefined,
  segmentStartTime: number | undefined,
  segmentEndTime: number | undefined
): UseSegmentLyricsResult {
  const [lyrics, setLyrics] = useState<LyricLine[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!metadataUri || segmentStartTime === undefined || segmentEndTime === undefined) {
      setLyrics([])
      return
    }

    setIsLoading(true)
    setError(null)

    const fetchLyrics = async () => {
      try {
        const url = lensToGroveUrl(metadataUri)
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`Failed to fetch metadata: ${response.status}`)
        }

        const metadata = await response.json()

        // Check if metadata has lines array (new format)
        if (metadata.lines && Array.isArray(metadata.lines)) {
          console.log('[useSegmentLyrics] Loading lyrics from lines array')

          // Filter lines that overlap with the segment time range
          const filteredLines = metadata.lines.filter((line: BaseAlignmentLine) => {
            return line.end > segmentStartTime && line.start < segmentEndTime
          })

          // Transform to expected LyricLine format
          const segmentLyrics: LyricLine[] = filteredLines.map((line: BaseAlignmentLine, index: number) => ({
            lineIndex: index,
            originalText: line.text,
            start: line.start,
            end: line.end,
            words: line.words || [],
          }))

          console.log(`[useSegmentLyrics] Loaded ${segmentLyrics.length} lines for segment (${segmentStartTime}s - ${segmentEndTime}s)`)
          setLyrics(segmentLyrics)
          return
        }

        // Legacy: sections only (match-and-segment data, no alignment)
        console.warn('[useSegmentLyrics] Metadata does not contain lyrics lines (base-alignment not run yet)')
        setLyrics([])
      } catch (err) {
        console.error('[useSegmentLyrics] Failed to load lyrics:', err)
        setError(err instanceof Error ? err : new Error('Failed to load lyrics'))
        setLyrics([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchLyrics()
  }, [metadataUri, segmentStartTime, segmentEndTime])

  return { lyrics, isLoading, error }
}
