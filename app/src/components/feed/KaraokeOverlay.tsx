import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { KaraokeOverlayProps } from './types'

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
  // Show line from its start time until the next line starts (not just until its end time)
  const currentLine = useMemo(() => {
    if (!lines || lines.length === 0) return null

    // Debug: Log timing data for first 3 lines (only once when lines load)
    if (lines.length > 0 && currentTime < 2) {
      console.log('[KaraokeOverlay] Total lines:', lines.length)
      console.log('[KaraokeOverlay] First 3 lines timing:', lines.slice(0, 3).map((l, i) => ({
        index: i,
        text: l.text.substring(0, 30) + '...',
        start: l.start,
        end: l.end
      })))
    }

    // Find the line that should be displayed
    // A line is active from its start time until the next line starts
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const nextLine = lines[i + 1]

      // If we're past this line's start time
      if (currentTime >= line.start) {
        // Show this line until the next line starts (or if it's the last line, until its end)
        if (!nextLine || currentTime < nextLine.start) {
          // Debug: Log which line is being selected at key timestamps
          if (currentTime % 5 < 0.2) { // Log every 5 seconds
            console.log(`[KaraokeOverlay] Time: ${currentTime.toFixed(1)}s → Line ${i}: "${line.text.substring(0, 30)}..." (start: ${line.start}, nextStart: ${nextLine?.start || 'none'})`)
          }
          return line
        }
      }
    }

    return null
  }, [lines, currentTime])

  // Debug: Log only when line changes (not on every time update)
  const currentLineText = currentLine?.text
  const currentLineTranslation = currentLine?.translation
  useMemo(() => {
    if (currentLineText) {
      console.log('[KaraokeOverlay] Line:', currentLineText.substring(0, 50))
      if (currentLineTranslation) {
        console.log('[KaraokeOverlay] Translation:', currentLineTranslation.substring(0, 50))
      }
    }
  }, [currentLineText, currentLineTranslation])

  // Find next line (for karaoke recording mode)
  const nextLine = useMemo(() => {
    if (!showNextLine || !lines || !currentLine) return null
    const currentIndex = lines.indexOf(currentLine)
    if (currentIndex === -1 || currentIndex === lines.length - 1) return null
    return lines[currentIndex + 1]
  }, [showNextLine, lines, currentLine])

  // Process words for highlighting (MUST be before early return)
  const highlightedWords = useMemo(() => {
    if (!currentLine) return []

    // Check if this is English text by looking for ASCII characters
    const isEnglish = /^[\x00-\x7F\s]*$/.test(currentLine.text)

    // Only use word-level highlighting for English text
    // For other languages, show the full line (translation has no word timings)
    if (!isEnglish || !currentLine.words || currentLine.words.length === 0) {
      // Show whole line
      return [{ text: currentLine.text, isSung: true }]
    }

    // English with word-level timing
    const words = currentLine.words.map(word => ({
      ...word,
      isSung: currentTime >= word.start && currentTime < word.end
    }))

    return words
  }, [currentLine, currentTime])

  // Don't render if no lyrics or no current line (AFTER all hooks)
  if (!currentLine) return null

  return (
    <div className={cn('absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 via-black/50 to-transparent pt-6 pb-12 pointer-events-none z-20 animate-in fade-in duration-300', className)}>
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
            <div className="text-base sm:text-lg md:text-xl font-bold leading-tight drop-shadow-lg text-foreground/60 break-words">
              {nextLine.text}
            </div>
          ) : currentLine.translation ? (
            <div className="text-sm sm:text-base md:text-lg font-medium leading-tight drop-shadow-lg text-foreground/90 break-words">
              {currentLine.translation}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
