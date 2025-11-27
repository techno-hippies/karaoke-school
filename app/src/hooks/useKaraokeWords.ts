import { useMemo } from 'react'
import type { WordTimestamp, ProcessedWord } from '@/types/karaoke'

/**
 * Calculate timing state for each word at current playback time
 */
export function useKaraokeWords(
  words: WordTimestamp[],
  currentTime: number
): ProcessedWord[] {
  return useMemo(() => {
    return words.map((word) => {
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
  }, [words, currentTime])
}
