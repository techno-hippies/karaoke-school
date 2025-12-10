import { createMemo, createEffect, For, type Component, type Accessor } from 'solid-js'
import { KaraokeLyricLine } from './KaraokeLyricLine'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { LyricLine } from './types'
import { cn } from '@/lib/utils'

export interface LyricsDisplayProps {
  lyrics: LyricLine[]
  currentTime: Accessor<number>
  selectedLanguage?: string
  showTranslations?: boolean
  class?: string
}

/**
 * Scrollable lyrics container with auto-scroll to active line (SolidJS)
 */
export const LyricsDisplay: Component<LyricsDisplayProps> = (props) => {
  let containerRef: HTMLDivElement | undefined

  // Filter out section markers
  const filteredLyrics = createMemo(() =>
    props.lyrics.filter((line) => !line.sectionMarker)
  )

  // Find current active line index
  const currentLineIndex = createMemo(() => {
    const time = props.currentTime()
    return filteredLyrics().findIndex(
      (line) => time >= line.start && time <= line.end
    )
  })

  // Auto-scroll to active line
  createEffect(() => {
    const index = currentLineIndex()
    if (index < 0 || !containerRef) return

    const lineElement = containerRef.querySelector(`[data-line-index="${index}"]`)
    if (lineElement) {
      lineElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  })

  return (
    <ScrollArea ref={containerRef} class={cn(props.class, 'overflow-x-hidden')} hideScrollbar>
      <div
        class="space-y-8 sm:space-y-10 pt-16 sm:pt-20 pb-32 sm:pb-40 px-4 sm:px-6 w-full max-w-full"
        style={{
          'mask-image': 'linear-gradient(to bottom, transparent 0%, black 64px, black calc(100% - 80px), transparent 100%)',
          '-webkit-mask-image': 'linear-gradient(to bottom, transparent 0%, black 64px, black calc(100% - 80px), transparent 100%)',
        }}
      >
        <For each={filteredLyrics()}>
          {(line, index) => (
            <div data-line-index={index()} class="w-full max-w-full overflow-hidden">
              <KaraokeLyricLine
                line={line}
                currentTime={props.currentTime()}
                isActive={index() === currentLineIndex()}
                isPast={index() < currentLineIndex()}
                showTranslation={props.showTranslations}
                selectedLanguage={props.selectedLanguage}
              />
            </div>
          )}
        </For>
      </div>
    </ScrollArea>
  )
}
