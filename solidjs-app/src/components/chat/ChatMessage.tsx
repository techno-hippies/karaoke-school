/**
 * ChatMessage Component
 *
 * Single chat bubble with support for:
 * - Word-level highlighting (TTS sync)
 * - Translation button
 * - Audio playback controls
 * - Context indicator (token usage)
 */

import { Component, For, Show, splitProps, createMemo } from 'solid-js'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Translate, SpeakerHigh, Stop } from '@/components/icons'
import type { ChatWord, MessageContent } from '@/lib/chat/types'

export interface ChatMessageProps {
  /** Message content - either string or array of words for highlighting */
  content: MessageContent
  /** Who sent the message */
  sender: 'ai' | 'user'
  /** Avatar URL for AI messages */
  avatarUrl?: string
  /** Show translate button (AI messages only) */
  showTranslate?: boolean
  /** Translated text to show below original */
  translation?: string
  /** Called when translate button clicked */
  onTranslate?: () => void
  /** Is translation loading */
  isTranslating?: boolean
  /** Whether this message has audio available */
  hasAudio?: boolean
  /** Whether audio is currently playing */
  isPlayingAudio?: boolean
  /** Whether TTS is loading */
  isLoadingAudio?: boolean
  /** Called when play audio button clicked */
  onPlayAudio?: () => void
  /** Called when stop audio button clicked */
  onStopAudio?: () => void
  /** Current context token count */
  tokensUsed?: number
  /** Maximum context tokens */
  maxTokens?: number
  class?: string
}

/**
 * ChatMessage - Single chat bubble with word-level highlighting support
 */
export const ChatMessage: Component<ChatMessageProps> = (props) => {
  const [local, others] = splitProps(props, [
    'content',
    'sender',
    'avatarUrl',
    'showTranslate',
    'translation',
    'onTranslate',
    'isTranslating',
    'hasAudio',
    'isPlayingAudio',
    'isLoadingAudio',
    'onPlayAudio',
    'onStopAudio',
    'tokensUsed',
    'maxTokens',
    'class',
  ])

  const isAI = () => local.sender === 'ai'

  // Normalize content to words array
  const words = createMemo<ChatWord[]>(() => {
    if (typeof local.content === 'string') {
      return local.content.split(' ').map((text) => ({ text, isHighlighted: false }))
    }
    return local.content
  })

  // Show actions row if any action is available
  const showActions = () =>
    isAI() &&
    (local.showTranslate ||
      local.hasAudio ||
      local.tokensUsed !== undefined)

  return (
    <div
      class={cn(
        'flex gap-3 w-full',
        isAI() ? 'justify-start' : 'justify-end',
        local.class
      )}
      {...others}
    >
      {/* AI Avatar */}
      <Show when={isAI()}>
        <Avatar src={local.avatarUrl} fallback="AI" size="sm" />
      </Show>

      {/* Message content */}
      <div
        class={cn(
          'flex flex-col max-w-[80%] md:max-w-[70%]',
          isAI() ? 'items-start' : 'items-end'
        )}
      >
        {/* Message bubble */}
        <div
          class={cn(
            'px-4 py-3 rounded-2xl text-base leading-relaxed',
            isAI()
              ? 'bg-secondary text-secondary-foreground rounded-tl-md'
              : 'bg-primary text-primary-foreground rounded-tr-md'
          )}
        >
          {/* Word-by-word rendering with highlighting */}
          <p class="whitespace-pre-wrap">
            <For each={words()}>
              {(word, index) => {
                const trimmedText = word.text.trim()
                // Skip empty words
                if (!trimmedText) return null

                // Find next non-empty word for spacing logic
                const wordsArray = words()
                let nextTrimmed = ''
                for (let i = index() + 1; i < wordsArray.length; i++) {
                  const t = wordsArray[i].text.trim()
                  if (t) {
                    nextTrimmed = t
                    break
                  }
                }

                // Don't add space before closing punctuation
                const nextIsClosingPunct = /^[.,!?;:)\]}>…]/.test(nextTrimmed)
                // Don't add space after opening punctuation
                const currentIsOpeningPunct = /^[(\[{<]/.test(trimmedText)
                const startsWithOpenQuote = /^["'][a-zA-Z]/.test(trimmedText)

                const addSpace =
                  nextTrimmed &&
                  !nextIsClosingPunct &&
                  !currentIsOpeningPunct &&
                  !startsWithOpenQuote

                return (
                  <span>
                    <span
                      class={cn(
                        'transition-colors duration-100',
                        word.isHighlighted && 'bg-yellow-400/50 text-foreground'
                      )}
                    >
                      {trimmedText}
                    </span>
                    {addSpace ? ' ' : ''}
                  </span>
                )
              }}
            </For>
          </p>
        </div>

        {/* Translation (if available) */}
        <Show when={local.translation}>
          <div class="mt-1.5 px-4 py-2 bg-muted/50 rounded-xl text-sm text-muted-foreground">
            {local.translation}
          </div>
        </Show>

        {/* Action buttons row */}
        <Show when={showActions()}>
          <div class="mt-1.5 flex items-center gap-1">
            {/* Play/Stop audio button */}
            <Show when={local.hasAudio}>
              <button
                onClick={local.isPlayingAudio ? local.onStopAudio : local.onPlayAudio}
                disabled={local.isLoadingAudio}
                class={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
                  'text-sm text-muted-foreground hover:text-foreground',
                  'hover:bg-muted/50 transition-colors cursor-pointer',
                  local.isPlayingAudio && 'text-primary',
                  local.isLoadingAudio && 'opacity-50 cursor-wait'
                )}
              >
                <Show
                  when={local.isPlayingAudio}
                  fallback={
                    <Show
                      when={local.isLoadingAudio}
                      fallback={
                        <>
                          <SpeakerHigh class="w-4 h-4" />
                          <span>Play</span>
                        </>
                      }
                    >
                      <SpeakerHigh class="w-4 h-4 animate-pulse" />
                      <span>Loading...</span>
                    </Show>
                  }
                >
                  <Stop class="w-4 h-4" weight="fill" />
                  <span>Stop</span>
                </Show>
              </button>
            </Show>

            {/* Translate button */}
            <Show when={local.showTranslate && !local.translation}>
              <button
                onClick={local.onTranslate}
                disabled={local.isTranslating}
                class={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
                  'text-sm text-muted-foreground hover:text-foreground',
                  'hover:bg-muted/50 transition-colors cursor-pointer',
                  local.isTranslating && 'opacity-50 cursor-wait'
                )}
              >
                <Translate class="w-4 h-4" />
                <span>{local.isTranslating ? 'Translating...' : 'Translate'}</span>
              </button>
            </Show>

            {/* Context indicator */}
            <Show when={local.tokensUsed !== undefined}>
              <ContextIndicator
                tokensUsed={local.tokensUsed!}
                maxTokens={local.maxTokens || 64000}
                class="ml-1"
              />
            </Show>
          </div>
        </Show>
      </div>
    </div>
  )
}

// ============================================================
// Context Indicator (inline component)
// ============================================================

interface ContextIndicatorProps {
  tokensUsed: number
  maxTokens: number
  class?: string
}

const ContextIndicator: Component<ContextIndicatorProps> = (props) => {
  const percentage = () =>
    Math.min(100, Math.round((props.tokensUsed / props.maxTokens) * 100))

  const color = () => {
    const pct = percentage()
    if (pct > 90) return 'text-destructive'
    if (pct > 75) return 'text-yellow-500'
    return 'text-muted-foreground'
  }

  return (
    <div
      class={cn('flex items-center gap-1 text-xs', color(), props.class)}
      title={`${props.tokensUsed.toLocaleString()} / ${props.maxTokens.toLocaleString()} tokens (${percentage()}%)`}
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          opacity="0.2"
        />
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-dasharray={`${percentage() * 0.628} 62.8`}
          stroke-linecap="round"
          transform="rotate(-90 12 12)"
        />
      </svg>
      <span>{percentage()}%</span>
    </div>
  )
}

export default ChatMessage
