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
  className = 'flex flex-wrap gap-1',
}: Omit<KaraokeWordsRendererProps, 'wordClassName'>) {
  return (
    <KaraokeWordsRenderer
      words={words}
      className={className}
      wordClassName={(word) =>
        word.isActive ? 'text-primary' : 'text-foreground'
      }
    />
  )
}
