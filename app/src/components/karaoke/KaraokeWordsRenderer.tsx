import type { ProcessedWord } from '@/types/karaoke'

export interface KaraokeWordsRendererProps {
  words: ProcessedWord[]
  className?: string
  wordClassName?: string | ((word: ProcessedWord) => string)
}

/**
 * Render karaoke words with configurable styling
 */
export function KaraokeWordsRenderer({
  words,
  className = '',
  wordClassName = '',
}: KaraokeWordsRendererProps) {
  const getWordClassName = (word: ProcessedWord): string => {
    if (typeof wordClassName === 'function') {
      return wordClassName(word)
    }
    return wordClassName
  }

  return (
    <div className={className}>
      {words.map((word, index) => (
        <span key={index} className={getWordClassName(word)}>
          {word.text}
        </span>
      ))}
    </div>
  )
}

/**
 * Pre-configured renderer with karaoke-style highlighting
 */
export function TikTokKaraokeRenderer({
  words,
  className = '',
}: Omit<KaraokeWordsRendererProps, 'wordClassName'>) {
  return (
    <p className={className}>
      {words.map((word, index) => (
        <span
          key={index}
          className={
            word.isActive
              ? 'text-white font-bold transition-colors duration-75'
              : word.isPast
              ? 'text-neutral-400 transition-colors duration-75'
              : 'text-neutral-500 transition-colors duration-75'
          }
        >
          {word.text}{index < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  )
}
