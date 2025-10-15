/**
 * useSegmentLyrics
 * Hook to load word-level lyrics for a specific segment from base-alignment metadata
 * and merge translations if available
 */

import { useState, useEffect } from 'react'
import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'
import { BASE_SEPOLIA_CONTRACTS } from '@/config/contracts'
import { KARAOKE_CATALOG_ABI } from '@/config/abis/karaokeCatalog'
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
 * and merge translations if available
 *
 * @param metadataUri - lens:// URI pointing to base-alignment metadata
 * @param segmentStartTime - Segment start time in seconds
 * @param segmentEndTime - Segment end time in seconds
 * @param geniusId - Genius song ID (for fetching translations)
 * @param targetLanguage - Target language code (e.g. 'zh', 'vi', 'es')
 * @param translationVersion - Version number that increments when translations update (forces refetch)
 */
export function useSegmentLyrics(
  metadataUri: string | undefined,
  segmentStartTime: number | undefined,
  segmentEndTime: number | undefined,
  geniusId?: number,
  targetLanguage?: string,
  translationVersion?: number
): UseSegmentLyricsResult {
  const [lyrics, setLyrics] = useState<LyricLine[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!metadataUri || segmentStartTime === undefined || segmentEndTime === undefined) {
      console.log('[useSegmentLyrics] Missing required params:', {
        hasMetadataUri: !!metadataUri,
        metadataUri,
        segmentStartTime,
        segmentEndTime
      })
      setLyrics([])
      return
    }

    setIsLoading(true)
    setError(null)

    const fetchLyrics = async () => {
      try {
        const url = lensToGroveUrl(metadataUri)
        console.log('[useSegmentLyrics] Fetching from:', url)
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`Failed to fetch metadata: ${response.status}`)
        }

        const metadata = await response.json()

        // Check if metadata has lines array (new format)
        if (metadata.lines && Array.isArray(metadata.lines)) {
          console.log('[useSegmentLyrics] Loading lyrics from lines array')

          // Filter lines that overlap with the segment time range
          console.log('[useSegmentLyrics] Filtering lines:', {
            totalLines: metadata.lines.length,
            segmentStartTime,
            segmentEndTime,
            firstLineStart: metadata.lines[0]?.start,
            firstLineEnd: metadata.lines[0]?.end,
            lastLineStart: metadata.lines[metadata.lines.length - 1]?.start,
            lastLineEnd: metadata.lines[metadata.lines.length - 1]?.end
          })

          const filteredLines = metadata.lines.filter((line: BaseAlignmentLine) => {
            return line.end > segmentStartTime && line.start < segmentEndTime
          })

          console.log('[useSegmentLyrics] Filtered result:', {
            matchedLines: filteredLines.length,
            firstMatch: filteredLines[0]?.text,
            lastMatch: filteredLines[filteredLines.length - 1]?.text
          })

          // Transform to expected LyricLine format
          let segmentLyrics: LyricLine[] = filteredLines.map((line: BaseAlignmentLine, index: number) => ({
            lineIndex: index,
            originalText: line.text,
            start: line.start,
            end: line.end,
            words: line.words || [],
          }))

          // Fetch and merge translations if target language is specified
          if (geniusId && targetLanguage) {
            try {
              console.log('[useSegmentLyrics] Fetching translation for:', { geniusId, targetLanguage })

              const publicClient = createPublicClient({
                chain: baseSepolia,
                transport: http(),
              })

              // Get translation URI from contract
              const translationUri = await publicClient.readContract({
                address: BASE_SEPOLIA_CONTRACTS.karaokeCatalog,
                abi: KARAOKE_CATALOG_ABI,
                functionName: 'getTranslation',
                args: [geniusId, targetLanguage],
              }) as string

              if (translationUri && translationUri !== '') {
                console.log('[useSegmentLyrics] Found translation URI:', translationUri)

                // Fetch translation data
                const translationUrl = lensToGroveUrl(translationUri)
                const translationResp = await fetch(translationUrl)
                const translationData = await translationResp.json()

                if (translationData.lines && Array.isArray(translationData.lines)) {
                  console.log('[useSegmentLyrics] Merging translations:', translationData.lines.length, 'lines')

                  // Merge translations into lyrics by matching text field
                  segmentLyrics = segmentLyrics.map(lyric => {
                    const match = translationData.lines.find((t: any) => t.text === lyric.originalText)
                    if (match && match.translation) {
                      return {
                        ...lyric,
                        translations: {
                          [targetLanguage]: match.translation
                        }
                      }
                    }
                    return lyric
                  })

                  console.log('[useSegmentLyrics] Merged translations successfully')
                }
              } else {
                console.log('[useSegmentLyrics] No translation found for language:', targetLanguage)
              }
            } catch (translationErr) {
              console.warn('[useSegmentLyrics] Failed to fetch translations:', translationErr)
              // Continue without translations
            }
          }

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
  }, [metadataUri, segmentStartTime, segmentEndTime, geniusId, targetLanguage, translationVersion])

  return { lyrics, isLoading, error }
}
