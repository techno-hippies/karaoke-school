import { useKaraokeWords } from '@/hooks/useKaraokeWords'
import { TikTokKaraokeRenderer } from './KaraokeWordsRenderer'
import type { LyricLine } from '@/types/karaoke'
import { cn } from '@/lib/utils'

const DEBUG = true

export interface KaraokeLyricLineProps {
  line: LyricLine
  currentTime: number
  isActive: boolean
  isPast: boolean
  showTranslation?: boolean
  selectedLanguage?: string
  className?: string
}

/**
 * Single lyric line with optional word-level highlighting and translation
 */
export function KaraokeLyricLine({
  line,
  currentTime,
  isActive,
  isPast,
  showTranslation = true,
  selectedLanguage = 'cn',
  className,
}: KaraokeLyricLineProps) {
  // Only filter out truly empty words - keep all words with actual content
  const allWords = (line.words || []).filter((word) => word.text.trim() !== '')

  // Debug logging for line timing
  if (DEBUG && currentTime > 0 && isActive && Math.round(currentTime * 100) % 10 === 0) {
    console.log(`📝 [KaraokeLyricLine] Line is ACTIVE`, {
      lineText: line.originalText.substring(0, 50),
      lineStart: line.start.toFixed(3),
      lineEnd: line.end.toFixed(3),
      currentTime: currentTime.toFixed(3),
      wordCount: allWords.length,
      firstWord: allWords[0] ? { text: allWords[0].text, start: allWords[0].start?.toFixed(3), end: allWords[0].end?.toFixed(3) } : 'none',
    })
  }

  // Check if word-level data is complete by verifying first word matches line text
  const hasCompleteWordData = allWords.length > 0 && (() => {
    const firstWord = allWords[0].text
    const lineText = line.originalText
    // Check if the line text contains the first word near the beginning
    // (allowing for punctuation/quotes at the start)
    const cleanedLineStart = lineText.replace(/^["\s]+/, '')
    return cleanedLineStart.toLowerCase().startsWith(firstWord.toLowerCase())
  })()

  // Process words with karaoke timing if active
  const processedWords = useKaraokeWords(
    allWords,
    isActive ? currentTime : 0
  )

  const translation = showTranslation
    ? line.translations?.[selectedLanguage]
    : undefined

  return (
    <div className={cn('transition-all duration-300 w-full max-w-full', className)}>
      {/* Word-level highlighting ONLY if we have complete word data */}
      {isActive && hasCompleteWordData ? (
        <TikTokKaraokeRenderer
          words={processedWords}
          className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight"
        />
      ) : (
        <p
          className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight break-words transition-colors duration-300 w-full max-w-full"
          style={{
            color: isActive ? '#ffffff' : isPast ? '#a3a3a3' : '#737373',
          }}
        >
          {line.originalText}
        </p>
      )}

      {/* Translation */}
      {translation && (
        <p
          className={cn(
            'text-base sm:text-lg md:text-xl mt-3 break-words transition-colors duration-300 w-full max-w-full',
            isActive ? 'text-neutral-300' : 'text-neutral-600'
          )}
        >
          {translation}
        </p>
      )}
    </div>
  )
}
