import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { KaraokeOverlayProps, KaraokeLine } from './types'

/**
 * KaraokeOverlay - TikTok-style karaoke lyrics at bottom-left
 * Shows current lyric line with word-level highlighting + username below
 */
export function KaraokeOverlay({
  lines,
  currentTime,
  username,
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
    <div className={cn('absolute bottom-20 left-4 right-20 pointer-events-none z-10', className)}>
      {/* Lyrics with word highlighting */}
      <div className="text-white text-left space-y-1">
        <div className="text-lg font-bold leading-tight drop-shadow-lg">
          {highlightedWords.map((word, i) => (
            <span
              key={i}
              className={cn(
                'transition-colors duration-200',
                word.isSung ? 'text-yellow-400' : 'text-white/80'
              )}
            >
              {word.text}{' '}
            </span>
          ))}
        </div>

        {/* Username below lyrics - TikTok style */}
        <div className="mt-2">
          <span className="text-white font-semibold text-sm drop-shadow-lg">
            @{username}
          </span>
        </div>
      </div>
    </div>
  )
}
