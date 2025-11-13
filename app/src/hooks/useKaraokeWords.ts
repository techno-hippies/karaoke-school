import { useMemo } from 'react'
import type { WordTimestamp, ProcessedWord } from '@/types/karaoke'

const DEBUG = true

/**
 * Calculate timing state for each word at current playback time
 */
export function useKaraokeWords(
  words: WordTimestamp[],
  currentTime: number
): ProcessedWord[] {
    // @ts-expect-error - state type compatibility
  return useMemo(() => {
    const processed = words.map((word) => {
      const isActive = currentTime >= word.start && currentTime <= word.end
      const isPast = currentTime > word.end
      const isFuture = currentTime < word.start

      return {
        ...word,
        state: isActive ? 'active' : isPast ? 'past' : 'future',
        isActive,
        isPast,
        isFuture,
      }
    })

    // Debug logging - log detailed timing info
    if (DEBUG && currentTime > 0) {
      const activeWords = processed.filter(w => w.isActive)
      const nextWord = processed.find(w => w.isFuture)

      // Only log if words have changed (roughly every 0.1s or when active word changes)
      if (Math.round(currentTime * 100) % 10 === 0) {
        console.log(`⏱️  [useKaraokeWords] currentTime: ${currentTime.toFixed(3)}s`, {
          totalWords: words.length,
          activeWordsCount: activeWords.length,
          activeWords: activeWords.map(w => ({ text: w.text, start: w.start.toFixed(3), end: w.end.toFixed(3) })),
          nextWord: nextWord ? { text: nextWord.text, start: nextWord.start.toFixed(3) } : 'none',
          firstWordTiming: words[0] ? { text: words[0].text, start: words[0].start.toFixed(3), end: words[0].end.toFixed(3) } : 'none',
        })
      }
    }

    return processed
  }, [words, currentTime])
}
