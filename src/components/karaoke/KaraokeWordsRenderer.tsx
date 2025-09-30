import React from 'react';
import type { ProcessedWord } from '../../hooks/karaoke/useKaraokeWords';

export interface KaraokeWordsRendererProps {
  words: ProcessedWord[];
  className?: string;
  wordClassName?: string | ((word: ProcessedWord) => string);
  containerProps?: React.HTMLAttributes<HTMLDivElement>;
  wordProps?: React.HTMLAttributes<HTMLSpanElement>;
  showTranslations?: boolean;
  translationClassName?: string;
  renderCustomWord?: (word: ProcessedWord, index: number) => React.ReactNode;
}

/**
 * Pure renderer component for karaoke words
 * No display assumptions - completely configurable through props
 */
export const KaraokeWordsRenderer: React.FC<KaraokeWordsRendererProps> = ({
  words,
  className = '',
  wordClassName = '',
  containerProps = {},
  wordProps = {},
  showTranslations = false,
  translationClassName = '',
  renderCustomWord
}) => {
  const getWordClassName = (word: ProcessedWord): string => {
    if (typeof wordClassName === 'function') {
      return wordClassName(word);
    }
    return wordClassName;
  };

  return (
    <div className={className} {...containerProps}>
      {words.map((word, index) => {
        // Allow custom rendering for special cases
        if (renderCustomWord) {
          return renderCustomWord(word, index);
        }

        return (
          <span
            key={index}
            className={getWordClassName(word)}
            data-word-state={word.state}
            data-word-start={word.start}
            data-word-end={word.end}
            {...wordProps}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};

/**
 * Pre-configured renderer with common TikTok-style highlighting
 */
export const TikTokKaraokeRenderer: React.FC<Omit<KaraokeWordsRendererProps, 'wordClassName'>> = (props) => (
  <KaraokeWordsRenderer
    {...props}
    wordClassName={(word) => `mr-1 ${word.isActive ? 'text-[#FE2C55]' : 'text-white'}`}
  />
);

/**
 * Pre-configured renderer with past/future state colors
 */
export const FullStateKaraokeRenderer: React.FC<Omit<KaraokeWordsRendererProps, 'wordClassName'>> = (props) => (
  <KaraokeWordsRenderer
    {...props}
    wordClassName={(word) => `mr-1 transition-colors duration-150 ${
      word.isActive ? 'text-[#FE2C55] font-bold' :
      word.isPast ? 'text-neutral-400' :
      'text-white'
    }`}
  />
);