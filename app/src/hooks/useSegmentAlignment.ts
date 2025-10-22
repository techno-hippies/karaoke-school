import { useQuery } from '@tanstack/react-query'
import { lensUriToHttp } from '@/lib/grove'
import type { LyricLine } from '@/types/karaoke'

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
      console.log('[useSegmentAlignment] Data version:', data.version)
      console.log('[useSegmentAlignment] Data keys:', Object.keys(data))

      // Check for v2.0.0 format: data.lyrics.languages.en.lines
      if (!data.lyrics?.languages?.en?.lines) {
        console.error('[useSegmentAlignment] No lyrics.languages.en.lines found in response')
        console.error('[useSegmentAlignment] Available structure:', JSON.stringify(data.lyrics, null, 2).slice(0, 500))
        return []
      }

      // Get lines from v2.0.0 format
      const alignmentLines = data.lyrics.languages.en.lines

      console.log('[useSegmentAlignment] Alignment lines count:', alignmentLines.length)
      console.log('[useSegmentAlignment] First line sample:', alignmentLines[0])
      console.log('[useSegmentAlignment] Second line sample:', alignmentLines[1])

      // Convert v2.0.0 format to LyricLine format
      const lyrics: LyricLine[] = alignmentLines.map((line: any, index: number) => {
        // Calculate line end time (use next line's start, or add 3 seconds if last line)
        const nextLine = alignmentLines[index + 1]
        const lineEnd = nextLine ? nextLine.start : line.start + 3

        // Log raw words for line 1 before filtering
        if (index === 1) {
          console.log('[useSegmentAlignment] Line 1 RAW words COUNT:', line.words.length)
          line.words.forEach((w: any, i: number) => {
            console.log(`  [${i}]: text=${JSON.stringify(w.text)}, start=${w.start}, trim="${w.text.trim()}", isEmpty=${w.text.trim() === ''}, isNewline=${w.text === '\n'}`)
          })
        }

        // Filter out whitespace-only words and newlines
        const validWords = line.words.filter((word: any) =>
          word.text.trim() !== '' && word.text !== '\n'
        )

        if (index === 1) {
          console.log('[useSegmentAlignment] Line 1 AFTER filter, validWords count:', validWords.length)
          console.log('[useSegmentAlignment] Line 1 validWords:', validWords.map((w: any) => JSON.stringify(w.text)))
        }

        // Calculate word end times and convert to absolute timing
        const words = validWords.map((word: any, wordIndex: number) => {
          const nextWord = validWords[wordIndex + 1]
          // Word end is either next word's start, or line end if last word
          const wordEndRelative = nextWord ? nextWord.start : (lineEnd - line.start)

          return {
            text: word.text,
            start: line.start + word.start, // Convert to absolute time
            end: line.start + wordEndRelative, // Convert to absolute time
          }
        })

        if (index === 1) {
          console.log('[useSegmentAlignment] Line 1 FINAL words with timing:', words.map((w: any) => ({
            text: JSON.stringify(w.text),
            start: w.start.toFixed(2),
            end: w.end.toFixed(2),
            duration: (w.end - w.start).toFixed(2)
          })))
        }

        return {
          lineIndex: index,
          originalText: line.text,
          start: line.start,
          end: lineEnd,
          words,
        }
      })

      if (lyrics[0]) {
        console.log('[useSegmentAlignment] Parsed line 0:', {
          text: lyrics[0].originalText,
          start: lyrics[0].start,
          end: lyrics[0].end,
          words: lyrics[0].words?.map((w: any) => ({ text: w.text, start: w.start.toFixed(2), end: w.end.toFixed(2) }))
        })
      }
      if (lyrics[1]) {
        console.log('[useSegmentAlignment] Parsed line 1:', {
          text: lyrics[1].originalText,
          start: lyrics[1].start,
          end: lyrics[1].end,
          words: lyrics[1].words?.map((w: any) => ({ text: w.text, start: w.start.toFixed(2), end: w.end.toFixed(2) }))
        })
      }

      return lyrics
    },
    enabled: !!alignmentUri,
  })
}
