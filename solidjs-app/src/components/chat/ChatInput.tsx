/**
 * ChatInput Component
 *
 * Text input with send/voice button:
 * - Auto-resize textarea
 * - Send on Enter (Shift+Enter for newline)
 * - Single action button: voice (empty) → send (has text)
 * - Recording state with duration display
 */

import { Component, createSignal, createEffect, splitProps, Show, For } from 'solid-js'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/icons'
import { Textarea } from '@/components/ui/input'
import { formatDuration } from '@/lib/chat/audio'

export interface ChatInputProps {
  /** Called when user sends a message */
  onSend?: (message: string) => void
  /** Called when user taps voice button to start recording */
  onStartRecording?: () => void
  /** Called when user taps stop button to stop recording */
  onStopRecording?: () => void
  /** Called when input is focused */
  onFocus?: () => void
  /** Placeholder text */
  placeholder?: string
  /** Disable input */
  disabled?: boolean
  /** Is currently recording */
  isRecording?: boolean
  /** Recording duration in seconds */
  recordingDuration?: number
  /** Is processing audio (transcribing) */
  isProcessing?: boolean
  class?: string
}

/**
 * ChatInput - Text/voice input with recording states
 */
export const ChatInput: Component<ChatInputProps> = (props) => {
  const [local, others] = splitProps(props, [
    'onSend',
    'onStartRecording',
    'onStopRecording',
    'onFocus',
    'placeholder',
    'disabled',
    'isRecording',
    'recordingDuration',
    'isProcessing',
    'class',
  ])

  const [message, setMessage] = createSignal('')
  let textareaRef: HTMLTextAreaElement | undefined

  const inputPlaceholder = () => local.placeholder ?? 'Type a message...'

  // Auto-resize textarea (message() call is for reactivity tracking)
  createEffect(() => {
    message() // Track message changes for reactivity
    if (textareaRef) {
      textareaRef.style.height = '44px'
      const newHeight = Math.max(44, Math.min(textareaRef.scrollHeight, 120))
      textareaRef.style.height = `${newHeight}px`
    }
  })

  const handleSend = () => {
    const trimmed = message().trim()
    if (!trimmed || local.disabled) return

    local.onSend?.(trimmed)
    setMessage('')

    if (textareaRef) {
      textareaRef.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasText = () => message().trim().length > 0

  const handleActionButton = () => {
    if (local.isRecording) {
      local.onStopRecording?.()
    } else if (hasText()) {
      handleSend()
    } else {
      local.onStartRecording?.()
    }
  }

  // Processing state - show spinner
  if (local.isProcessing) {
    return (
      <div
        class={cn(
          'flex-shrink-0 bg-background border-t border-border',
          local.class
        )}
        style={{
          'padding-top': '14px',
          'padding-bottom': 'calc(env(safe-area-inset-bottom) + 14px)',
        }}
      >
        <div class="flex items-center justify-center gap-3 h-11">
          <div class="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-muted-foreground">Transcribing...</span>
        </div>
      </div>
    )
  }

  // Recording state
  if (local.isRecording) {
    return (
      <div
        class={cn(
          'flex-shrink-0 bg-background border-t border-border',
          local.class
        )}
        style={{
          'padding-top': '14px',
          'padding-bottom': 'calc(env(safe-area-inset-bottom) + 14px)',
        }}
      >
        <div class="flex items-center gap-2">
          {/* Recording indicator */}
          <div class="flex-1 flex items-center gap-3 rounded-full bg-secondary px-4 h-11">
            {/* Pulsing dot */}
            <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse" />

            {/* Duration */}
            <span class="text-sm font-medium text-foreground">
              {formatDuration(local.recordingDuration || 0)}
            </span>

            {/* Waveform bars */}
            <div class="flex-1 flex items-center justify-center gap-[3px]">
              <For each={Array(12).fill(0)}>
                {(_, i) => (
                  <div
                    class="w-[3px] bg-muted-foreground/50 rounded-full animate-pulse"
                    style={{
                      height: `${6 + Math.random() * 10}px`,
                      'animation-delay': `${i() * 80}ms`,
                      'animation-duration': `${400 + Math.random() * 200}ms`,
                    }}
                  />
                )}
              </For>
            </div>
          </div>

          {/* Stop button */}
          <button
            onClick={handleActionButton}
            disabled={local.disabled}
            class={cn(
              'flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center cursor-pointer',
              'bg-secondary text-foreground hover:bg-secondary/90',
              'transition-all duration-200',
              local.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Icon name="stop" class="text-xl" weight="fill" />
          </button>
        </div>
      </div>
    )
  }

  // Default state - text input
  return (
    <div
      class={cn(
        'flex-shrink-0 bg-background border-t border-border',
        local.class
      )}
      style={{
        'padding-top': '14px',
        'padding-bottom': 'calc(env(safe-area-inset-bottom) + 14px)',
      }}
      {...others}
    >
      <div class="flex items-end gap-2">
        {/* Text input */}
        <Textarea
          ref={textareaRef}
          value={message()}
          onInput={(e) => setMessage(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onFocus={local.onFocus}
          placeholder={inputPlaceholder()}
          disabled={local.disabled}
          rows={1}
          variant="chat"
          class="flex-1 min-w-0"
        />

        {/* Action button: Mic (empty) / Send (has text) */}
        <button
          onClick={handleActionButton}
          disabled={local.disabled}
          class={cn(
            'flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center cursor-pointer',
            'transition-all duration-200',
            hasText()
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/90',
            local.disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Show
            when={hasText()}
            fallback={<Icon name="waveform" class="text-xl" />}
          >
            <Icon name="paper-plane-right" class="text-xl" weight="fill" />
          </Show>
        </button>
      </div>
    </div>
  )
}

export default ChatInput
