import { useRef } from 'react'
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

  // Filter out section markers
  const filteredLyrics = lyrics.filter((line) => !line.sectionMarker)

  // Find current active line
  const currentLineIndex = filteredLyrics.findIndex(
    (line) => currentTime >= line.start && currentTime <= line.end
  )

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
        {filteredLyrics.map((line, index) => {
          const isActive = index === currentLineIndex
          const isPast = index < currentLineIndex

          return (
            <div key={index} data-line-index={index} className="w-full max-w-full overflow-hidden">
              <KaraokeLyricLine
                line={line}
                currentTime={currentTime}
                isActive={isActive}
                isPast={isPast}
                showTranslation={showTranslations}
                selectedLanguage={selectedLanguage}
              />
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
