import { useRef, useMemo } from 'react'
import { useAutoScroll } from '@/hooks/useAutoScroll'
import { KaraokeLyricLine } from './KaraokeLyricLine'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { LyricLine } from '@/types/karaoke'
import { cn } from '@/lib/utils'

// Debug logging configuration
const DEBUG_TIMING = true

export interface LyricsDisplayProps {
  lyrics: LyricLine[]
  currentTime: number
  selectedLanguage?: string
  showTranslations?: boolean
  className?: string
  debugInfo?: {
    renderCount: number
    startTime: number
    lastActiveLine: number | null
    lastActiveWord: { lineIndex: number; wordIndex: number } | null
    calculateActiveLineAndWord: (currentTime: number, lyrics: any[]) => { lineIndex: number; wordIndex: number }
    timingLogsRef: React.MutableRefObject<Array<{timestamp: number, currentTime: number, activeLine: number, activeWord: number}>>
  }
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
  debugInfo,
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

  // Add timing synchronization logging if debugInfo is provided
  if (debugInfo && DEBUG_TIMING && currentTime > 0) {
    const calculatedActive = debugInfo.calculateActiveLineAndWord(currentTime, lyrics)
    
    // Log when active line changes or at regular intervals for monitoring
    const shouldLog = calculatedActive.lineIndex !== debugInfo.lastActiveLine ||
                     Math.floor(currentTime * 10) % 50 === 0 // Log roughly every 5 seconds
    
    if (shouldLog) {
      const logEntry = {
        timestamp: Date.now(),
        currentTime: Math.round(currentTime * 100) / 100,
        activeLine: calculatedActive.lineIndex,
        activeWord: calculatedActive.wordIndex,
      }
      
      debugInfo.timingLogsRef.current.push(logEntry)
      // Keep only last 100 entries
      if (debugInfo.timingLogsRef.current.length > 100) {
        debugInfo.timingLogsRef.current.shift()
      }
      
      console.log(`🎭 [LyricsDisplay] ACTIVE LINE CHANGED - Audio: ${logEntry.currentTime}s, Line: ${logEntry.activeLine}, Word: ${logEntry.activeWord}`, {
        lineText: calculatedActive.lineIndex >= 0 ? filteredLyrics[calculatedActive.lineIndex]?.originalText?.substring(0, 30) + '...' : 'none',
        wordText: calculatedActive.lineIndex >= 0 && calculatedActive.wordIndex >= 0 ?
          filteredLyrics[calculatedActive.lineIndex]?.words?.[calculatedActive.wordIndex]?.text : 'none',
        renderCount: debugInfo.renderCount,
        currentLineIndex,
        filteredLyricsCount: filteredLyrics.length,
      })
    }
  }

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
