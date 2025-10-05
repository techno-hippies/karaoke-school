import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { KaraokeOverlayProps, KaraokeLine } from './types'

/**
 * KaraokeOverlay - TikTok-style karaoke lyrics at top-center
 * Shows current lyric line with word-level highlighting + translation
 * Can also show next line for karaoke recording mode
 */
export function KaraokeOverlay({
  lines,
  currentTime,
  className,
  showNextLine = false
}: KaraokeOverlayProps) {
  // Find current line based on time
  const currentLine = useMemo(() => {
    if (!lines || lines.length === 0) return null
    return lines.find(line =>
      currentTime >= line.start && currentTime <= line.end
    ) || null
  }, [lines, currentTime])

  // Find next line (for karaoke recording mode)
  const nextLine = useMemo(() => {
    if (!showNextLine || !lines || !currentLine) return null
    const currentIndex = lines.indexOf(currentLine)
    if (currentIndex === -1 || currentIndex === lines.length - 1) return null
    return lines[currentIndex + 1]
  }, [showNextLine, lines, currentLine])

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
      isSung: currentTime >= word.start && currentTime < word.end
    }))
  }, [currentLine, currentTime])

  return (
    <div className={cn('absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 via-black/50 to-transparent pt-6 pb-12 pointer-events-none z-10', className)}>
      <div className="flex justify-center px-8">
        <div className="text-foreground text-center space-y-2 max-w-xl">
          {/* Current line with word highlighting */}
          <div className={cn(
            "font-bold leading-tight drop-shadow-lg",
            showNextLine ? "text-xl" : "text-2xl"
          )}>
            {highlightedWords.map((word, i) => (
              <span
                key={i}
                className={cn(
                  'transition-colors duration-200',
                  word.isSung ? 'text-primary' : 'text-foreground/80'
                )}
              >
                {word.text}{' '}
              </span>
            ))}
          </div>

          {/* Next line (for karaoke recording) or translation (for video playback) */}
          {showNextLine && nextLine ? (
            <div className="text-xl font-bold leading-tight drop-shadow-lg text-foreground/60">
              {nextLine.text}
            </div>
          ) : currentLine.translation ? (
            <div className="text-lg font-medium leading-tight drop-shadow-lg text-foreground/90">
              {currentLine.translation}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
