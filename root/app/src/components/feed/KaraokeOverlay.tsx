import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { KaraokeOverlayProps, KaraokeLine } from './types'

/**
 * KaraokeOverlay - TikTok-style karaoke lyrics at top-center
 * Shows current lyric line with word-level highlighting + translation
 */
export function KaraokeOverlay({
  lines,
  currentTime,
  className
}: KaraokeOverlayProps) {
  // Find current line based on time
  const currentLine = useMemo(() => {
    if (!lines || lines.length === 0) return null
    return lines.find(line =>
      currentTime >= line.start && currentTime <= line.end
    ) || null
  }, [lines, currentTime])

  // Don't render if no lyrics or no current line
  if (!currentLine) return null

  // Process words for highlighting
  const highlightedWords = useMemo(() => {
    if (!currentLine.words || currentLine.words.length === 0) {
      // No word-level timing, return whole line
      return [{ text: currentLine.text, isSung: true }]
    }

    return currentLine.words.map(word => ({
      ...word,
      isSung: currentTime >= word.start
    }))
  }, [currentLine, currentTime])

  return (
    <div className={cn('absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 via-black/50 to-transparent pt-6 pb-12 pointer-events-none z-10', className)}>
      <div className="flex justify-center px-4">
        <div className="text-white text-center space-y-2 max-w-xl">
          {/* Original lyrics */}
          <div className="text-2xl font-bold leading-tight drop-shadow-lg">
            {highlightedWords.map((word, i) => (
              <span
                key={i}
                className={cn(
                  'transition-colors duration-200',
                  word.isSung ? 'text-primary' : 'text-white/80'
                )}
              >
                {word.text}{' '}
              </span>
            ))}
          </div>

          {/* Translation below original lyrics */}
          {currentLine.translation && (
            <div className="text-lg font-medium leading-tight drop-shadow-lg text-white/90">
              {currentLine.translation}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
