import { type Component, Show, For, createMemo } from 'solid-js'
import { cn } from '@/lib/utils'
import type { LyricLine } from './types'

export interface KaraokeLyricLineProps {
  line: LyricLine
  currentTime: number
  isActive: boolean
  isPast: boolean
  showTranslation?: boolean
  selectedLanguage?: string
  class?: string
}

/**
 * Single lyric line with optional word-level highlighting and translation (SolidJS)
 */
export const KaraokeLyricLine: Component<KaraokeLyricLineProps> = (props) => {
  // Filter out empty words
  const allWords = createMemo(() =>
    (props.line.words || []).filter((word) => word.text.trim() !== '')
  )

  // Check if word-level data is complete
  const hasCompleteWordData = createMemo(() => {
    const words = allWords()
    if (words.length === 0) return false

    const firstWord = words[0].text
    const lineText = props.line.originalText
    const cleanedLineStart = lineText.replace(/^["\s]+/, '')
    return cleanedLineStart.toLowerCase().startsWith(firstWord.toLowerCase())
  })

  // Process words with karaoke timing
  const processedWords = createMemo(() => {
    const words = allWords()
    const currentTime = props.isActive ? props.currentTime : 0

    return words.map((word) => {
      const progress = currentTime >= word.end
        ? 1
        : currentTime <= word.start
          ? 0
          : (currentTime - word.start) / (word.end - word.start)

      return {
        ...word,
        progress,
        isActive: currentTime >= word.start && currentTime < word.end,
        isComplete: currentTime >= word.end,
      }
    })
  })

  const translation = () =>
    props.showTranslation
      ? props.line.translations?.[props.selectedLanguage || 'zh']
      : undefined

  return (
    <div class={cn('transition-all duration-300 w-full max-w-full', props.class)}>
      {/* Word-level highlighting if we have complete word data */}
      <Show
        when={props.isActive && hasCompleteWordData()}
        fallback={
          <p
            class={cn(
              'text-xl sm:text-2xl md:text-3xl font-bold leading-tight break-words transition-all duration-300 w-full max-w-full',
              props.isActive && 'drop-shadow-[0_0_20px_rgba(96,165,250,0.4)]'
            )}
            style={{
              color: props.isActive ? '#ffffff' : props.isPast ? '#a3a3a3' : '#737373',
            }}
          >
            {props.line.originalText}
          </p>
        }
      >
        <p class="text-xl sm:text-2xl md:text-3xl font-bold leading-tight drop-shadow-[0_0_20px_rgba(96,165,250,0.4)]">
          <For each={processedWords()}>
            {(word, index) => (
              <>
                <span
                  class="relative inline-block"
                  style={{
                    color: word.isComplete || word.isActive ? '#ffffff' : '#737373',
                  }}
                >
                  {word.text}
                  {/* Highlight overlay for active word */}
                  <Show when={word.isActive && word.progress > 0 && word.progress < 1}>
                    <span
                      class="absolute inset-0 overflow-hidden text-blue-400"
                      style={{ width: `${word.progress * 100}%` }}
                    >
                      {word.text}
                    </span>
                  </Show>
                </span>
                {/* Space between words */}
                <Show when={index() < processedWords().length - 1}>{' '}</Show>
              </>
            )}
          </For>
        </p>
      </Show>

      {/* Translation */}
      <Show when={translation()}>
        <p
          class={cn(
            'text-base sm:text-lg md:text-xl mt-3 break-words transition-all duration-300 w-full max-w-full',
            props.isActive
              ? 'text-neutral-200 drop-shadow-[0_0_10px_rgba(96,165,250,0.2)]'
              : 'text-neutral-600'
          )}
        >
          {translation()}
        </p>
      </Show>
    </div>
  )
}
