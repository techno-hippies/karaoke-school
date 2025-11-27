import { useRef, useMemo } from 'react'
import { useAutoScroll } from '@/hooks/useAutoScroll'
import { KaraokeLyricLine } from './KaraokeLyricLine'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { LyricLine } from '@/types/karaoke'
import { cn } from '@/lib/utils'

export interface LyricsDisplayProps {
  lyrics: LyricLine[]
  currentTime: number
  selectedLanguage?: string
  showTranslations?: boolean
  className?: string
}

/**
 * Scrollable lyrics container with auto-scroll to active line
 */
export function LyricsDisplay({
  lyrics,
  currentTime,
  selectedLanguage = 'zh', // ISO 639-1 code
  showTranslations = true,
  className,
}: LyricsDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter out section markers - memoize this as it shouldn't change often
  const filteredLyrics = useMemo(() => {
    return lyrics.filter((line) => !line.sectionMarker)
  }, [lyrics])

  // Find current active line - memoize this calculation to avoid re-computation on every currentTime update
  const currentLineIndex = useMemo(() => {
    return filteredLyrics.findIndex(
      (line) => currentTime >= line.start && currentTime <= line.end
    )
  }, [filteredLyrics, currentTime])

  // Create optimized line props
  const lineProps = useMemo(() => {
    return filteredLyrics.map((line, index) => ({
      line,
      currentTime,
      isActive: index === currentLineIndex,
      isPast: index < currentLineIndex,
      showTranslation: showTranslations,
      selectedLanguage,
    }))
  }, [filteredLyrics, currentLineIndex, showTranslations, selectedLanguage, currentTime])

  // Auto-scroll to active line
  useAutoScroll(currentLineIndex, containerRef)

  return (
    <ScrollArea ref={containerRef} className={cn(className, 'overflow-x-hidden')}>
      <div
        className="space-y-8 sm:space-y-10 pt-16 sm:pt-20 pb-32 sm:pb-40 px-4 sm:px-6 w-full max-w-full"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 64px, black calc(100% - 80px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 64px, black calc(100% - 80px), transparent 100%)',
        }}
      >
        {lineProps.map((props, index) => (
          <div key={index} data-line-index={index} className="w-full max-w-full overflow-hidden">
            <KaraokeLyricLine {...props} />
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
