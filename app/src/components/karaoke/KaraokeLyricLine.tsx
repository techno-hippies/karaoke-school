import { useKaraokeWords } from '@/hooks/useKaraokeWords'
import { TikTokKaraokeRenderer } from './KaraokeWordsRenderer'
import type { LyricLine } from '@/types/karaoke'
import { cn } from '@/lib/utils'

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
  // Filter out malformed word timestamps
  const validWords = (line.words || []).filter((word) => {
    const duration = word.end - word.start
    return duration > 0 && duration < 5
  })

  // Process words with karaoke timing if active
  const processedWords = useKaraokeWords(
    validWords,
    isActive ? currentTime : 0
  )

  const translation = showTranslation
    ? line.translations?.[selectedLanguage]
    : undefined

  return (
    <div className={cn('transition-all duration-300', isActive && 'scale-105', className)}>
      {/* Word-level highlighting if available, otherwise line-level */}
      {isActive && validWords.length > 0 ? (
        <TikTokKaraokeRenderer
          words={processedWords}
          className="text-3xl font-bold leading-tight flex flex-wrap"
        />
      ) : (
        <p
          className="text-3xl font-bold leading-tight transition-colors duration-300"
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
            'text-xl mt-3 transition-colors duration-300',
            isActive ? 'text-neutral-300' : 'text-neutral-600'
          )}
        >
          {translation}
        </p>
      )}
    </div>
  )
}
