import { useMemo } from 'react'
import type { LyricLine } from '@/types/karaoke'
import { cn } from '@/lib/utils'

export interface KaraokeLyrics3LineProps {
  lyrics: LyricLine[]
  currentTime: number
  className?: string
}

/**
 * Standard 3-line karaoke display.
 * Shows previous, current, and next line - vertically centered.
 */
export function KaraokeLyrics3Line({
  lyrics,
  currentTime,
  className,
}: KaraokeLyrics3LineProps) {
  // Filter out section markers
  const filteredLyrics = useMemo(() => {
    return lyrics.filter((line) => !line.sectionMarker)
  }, [lyrics])

  // Find current active line
  const currentLineIndex = useMemo(() => {
    // Find line where we're within its time range
    const activeIndex = filteredLyrics.findIndex(
      (line) => currentTime >= line.start && currentTime <= line.end
    )
    if (activeIndex >= 0) return activeIndex

    // If between lines, show the upcoming line as current
    const upcomingIndex = filteredLyrics.findIndex(
      (line) => currentTime < line.start
    )
    // Return the previous line if we're past all lines, or -1 if before first
    if (upcomingIndex === -1) return filteredLyrics.length - 1
    return upcomingIndex > 0 ? upcomingIndex - 1 : -1
  }, [filteredLyrics, currentTime])

  // Get the 3 lines to display
  const { prevLine, currentLine, nextLine } = useMemo(() => {
    return {
      prevLine: currentLineIndex > 0 ? filteredLyrics[currentLineIndex - 1] : null,
      currentLine: currentLineIndex >= 0 ? filteredLyrics[currentLineIndex] : null,
      nextLine: currentLineIndex < filteredLyrics.length - 1 ? filteredLyrics[currentLineIndex + 1] : null,
    }
  }, [filteredLyrics, currentLineIndex])

  // Check if current line is actually active (being sung)
  const isCurrentActive = currentLine && currentTime >= currentLine.start && currentTime <= currentLine.end

  return (
    <div className={cn('flex flex-col items-center justify-center h-full px-6', className)}>
      <div className="space-y-6 text-center max-w-lg">
        {/* Previous line - dimmed */}
        <p className={cn(
          'text-xl sm:text-2xl font-medium transition-all duration-300 min-h-[2em]',
          prevLine ? 'text-white/30' : 'text-transparent'
        )}>
          {prevLine?.originalText || '\u00A0'}
        </p>

        {/* Current line - bright, scales up when active */}
        <p className={cn(
          'text-2xl sm:text-3xl font-bold transition-all duration-300 min-h-[2em]',
          isCurrentActive
            ? 'text-white scale-105'
            : currentLine
              ? 'text-white/80'
              : 'text-white/50'
        )}>
          {currentLine?.originalText || 'Get ready...'}
        </p>

        {/* Next line - dimmed */}
        <p className={cn(
          'text-xl sm:text-2xl font-medium transition-all duration-300 min-h-[2em]',
          nextLine ? 'text-white/40' : 'text-transparent'
        )}>
          {nextLine?.originalText || '\u00A0'}
        </p>
      </div>
    </div>
  )
}
