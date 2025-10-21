import { useQuery } from '@tanstack/react-query'
import { lensUriToHttp } from '@/lib/grove'
import type { LyricLine } from '@/types/karaoke'

interface AlignmentWord {
  text: string
  start: number
  end?: number
  loss?: number
}

interface AlignmentData {
  startTime: number
  endTime: number
  duration: number
  confidence: number
  fullAlignment: AlignmentWord[]
}

/**
 * Fetch and parse segment alignment data from Grove Storage
 * Converts word-level alignment to line-based lyrics for MediaPage
 */
export function useSegmentAlignment(alignmentUri?: string) {
  return useQuery({
    queryKey: ['segment-alignment', alignmentUri],
    queryFn: async () => {
      console.log('[useSegmentAlignment] Starting fetch for URI:', alignmentUri)

      if (!alignmentUri) {
        console.log('[useSegmentAlignment] No alignment URI provided')
        return null
      }

      const url = lensUriToHttp(alignmentUri)
      console.log('[useSegmentAlignment] Fetching from URL:', url)

      const response = await fetch(url)

      if (!response.ok) {
        console.error('[useSegmentAlignment] Fetch failed:', response.status, response.statusText)
        throw new Error(`Failed to fetch alignment data: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('[useSegmentAlignment] Received data:', data)
      console.log('[useSegmentAlignment] Data keys:', Object.keys(data))
      console.log('[useSegmentAlignment] Lyrics field:', data.lyrics)

      // Check if lyrics exists in new format: data.lyrics.en.synced
      if (!data.lyrics?.en?.synced) {
        console.error('[useSegmentAlignment] No lyrics.en.synced field found in response')
        console.error('[useSegmentAlignment] Available fields:', Object.keys(data.lyrics || {}))
        return []
      }

      // Get the synced word-level alignment from the new format
      const alignmentWords = data.lyrics.en.synced

      console.log('[useSegmentAlignment] Alignment words:', alignmentWords)
      console.log('[useSegmentAlignment] Alignment words count:', Array.isArray(alignmentWords) ? alignmentWords.length : 'not an array')

      // Convert word-level alignment to line-based lyrics
      // Group words into lines (split on newlines or every ~10 words)
      const lyrics: LyricLine[] = []
      let currentLine: AlignmentWord[] = []
      let lineStartTime = 0
      let lineIndex = 0

      alignmentWords.forEach((word: AlignmentWord, index: number) => {
        if (currentLine.length === 0 && word.text.trim() !== '') {
          lineStartTime = word.start
        }

        currentLine.push(word)

        // Create a new line every 8-10 words (non-whitespace) or at punctuation
        const nonWhitespaceCount = currentLine.filter(w => w.text.trim() !== '').length
        const shouldBreak =
          nonWhitespaceCount >= 8 ||
          word.text.match(/[.!?,;:]/) ||
          index === alignmentWords.length - 1

        if (shouldBreak && currentLine.length > 0) {
          const lineText = currentLine.map(w => w.text).join('').trim()
          const lastNonWhitespace = [...currentLine].reverse().find(w => w.text.trim() !== '')

          if (lineText) {
            lyrics.push({
              lineIndex: lineIndex++,
              originalText: lineText,
              start: lineStartTime,
              end: lastNonWhitespace ? (lastNonWhitespace.end || lastNonWhitespace.start + 1) : lineStartTime + 1,
              words: currentLine.map(w => ({
                text: w.text,
                start: w.start,
                end: w.end || w.start + 0.5, // Estimate end if not provided
              })),
            })
          }

          currentLine = []
        }
      })

      console.log('[useSegmentAlignment] Parsed lyrics:', lyrics)
      return lyrics
    },
    enabled: !!alignmentUri,
  })
}
