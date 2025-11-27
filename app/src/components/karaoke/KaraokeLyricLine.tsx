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
  // Only filter out truly empty words - keep all words with actual content
  const allWords = (line.words || []).filter((word) => word.text.trim() !== '')

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
          className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight drop-shadow-[0_0_20px_rgba(96,165,250,0.4)]"
        />
      ) : (
        <p
          className={cn(
            'text-xl sm:text-2xl md:text-3xl font-bold leading-tight break-words transition-all duration-300 w-full max-w-full',
            isActive && 'drop-shadow-[0_0_20px_rgba(96,165,250,0.4)]'
          )}
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
            'text-base sm:text-lg md:text-xl mt-3 break-words transition-all duration-300 w-full max-w-full',
            isActive
              ? 'text-neutral-200 drop-shadow-[0_0_10px_rgba(96,165,250,0.2)]'
              : 'text-neutral-600'
          )}
        >
          {translation}
        </p>
      )}
    </div>
  )
}
