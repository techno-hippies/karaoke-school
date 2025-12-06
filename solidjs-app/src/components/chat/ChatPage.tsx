/**
 * ChatPage Component
 *
 * Full chat interface with messages and input:
 * - Scrollable message list
 * - Auto-scroll to bottom on new messages
 * - Typing indicator
 * - Sticky input at bottom
 * - Supports both regular messages and survey questions
 * - Mobile keyboard handling via visual viewport API
 */

import {
  Component,
  For,
  Show,
  createSignal,
  createEffect,
  onMount,
  onCleanup,
  splitProps,
} from 'solid-js'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ChatMessage, type ChatMessageProps } from './ChatMessage'
import { ChatSurveyMessage, type ChatSurveyMessageProps } from './ChatSurveyMessage'
import { ChatInput, type ChatInputProps } from './ChatInput'
import { Icon } from '@/components/icons'
import { BackButton } from '@/components/ui/back-button'
import { useTranslation } from '@/lib/i18n'

export type ChatItem =
  | { type: 'message'; id: string; props: ChatMessageProps }
  | { type: 'survey'; id: string; props: ChatSurveyMessageProps }

export interface ChatPageProps {
  /** Chat messages and survey items */
  items: ChatItem[]
  /** Input props */
  inputProps?: Omit<ChatInputProps, 'class'>
  /** AI avatar URL (used for all AI messages) */
  aiAvatarUrl?: string
  /** Header title */
  title?: string
  /** Show header */
  showHeader?: boolean
  /** Called when back button clicked */
  onBack?: () => void
  /** Is AI currently typing */
  isTyping?: boolean
  /** Show upgrade button */
  showUpgrade?: boolean
  /** Called when upgrade button clicked */
  onUpgrade?: () => void
  class?: string
}

/**
 * ChatPage - Full chat interface with messages and input
 */
export const ChatPage: Component<ChatPageProps> = (props) => {
  const { t } = useTranslation()
  const [local, others] = splitProps(props, [
    'items',
    'inputProps',
    'aiAvatarUrl',
    'title',
    'showHeader',
    'onBack',
    'isTyping',
    'showUpgrade',
    'onUpgrade',
    'class',
  ])

  let messagesEndRef: HTMLDivElement | undefined
  let scrollContainerRef: HTMLDivElement | undefined

  // Visual viewport state for mobile keyboard handling
  const [viewport, setViewport] = createSignal<{ height: number; top: number } | null>(null)

  // Track visual viewport for mobile keyboard
  onMount(() => {
    const vv = window.visualViewport
    if (!vv) return

    const updateViewport = () => {
      // Only apply custom viewport when keyboard is likely open
      const keyboardOpen = window.innerHeight - vv.height > 100

      if (keyboardOpen) {
        setViewport({
          height: vv.height,
          top: vv.offsetTop,
        })
      } else {
        setViewport(null)
      }
    }

    vv.addEventListener('resize', updateViewport)
    vv.addEventListener('scroll', updateViewport)

    onCleanup(() => {
      vv.removeEventListener('resize', updateViewport)
      vv.removeEventListener('scroll', updateViewport)
    })
  })

  // Auto-scroll to bottom when items or typing state change
  createEffect(() => {
    // Track dependencies for reactivity
    local.items
    local.isTyping

    // Scroll to bottom
    messagesEndRef?.scrollIntoView({ behavior: 'smooth' })
  })

  // Scroll to bottom when input is focused (for mobile keyboard)
  const handleInputFocus = () => {
    // Wait for keyboard animation to complete before scrolling
    setTimeout(() => {
      messagesEndRef?.scrollIntoView({ behavior: 'smooth' })
    }, 300)
  }

  const headerTitle = () => local.title ?? t('chat.title')
  const showHeader = () => local.showHeader ?? true

  return (
    <div
      class={cn(
        // Fixed container that resizes to match visual viewport when keyboard opens
        'fixed inset-0 flex flex-col bg-background overflow-hidden',
        // Normal flow on desktop
        'md:static md:h-screen md:overflow-visible',
        local.class
      )}
      style={
        viewport()
          ? {
              top: `${viewport()!.top}px`,
              height: `${viewport()!.height}px`,
            }
          : undefined
      }
      {...others}
    >
      {/* Centered container for desktop */}
      <div class="flex-1 flex flex-col max-w-4xl mx-auto px-4 sm:px-6 md:px-8 w-full min-h-0">
        {/* Header */}
        <Show when={showHeader()}>
          <div class="flex-shrink-0 relative flex items-center justify-between h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div class="flex justify-start z-10">
              <Show when={local.onBack}>
                <BackButton onClick={local.onBack} class="-ml-2" />
              </Show>
            </div>
            <h1 class="absolute inset-0 flex items-center justify-center text-lg font-semibold pointer-events-none">
              {headerTitle()}
            </h1>
            <div class="flex justify-end z-10">
              <Show when={local.showUpgrade}>
                <Button variant="destructive" size="sm" onClick={local.onUpgrade}>
                  <Icon name="sparkle" class="text-base" weight="fill" />
                  {t('chat.upgrade')}
                </Button>
              </Show>
            </div>
          </div>
        </Show>

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          class="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide"
        >
          <div class="py-4 space-y-4">
            <For each={local.items}>
              {(item) => {
                if (item.type === 'message') {
                  return (
                    <ChatMessage
                      {...item.props}
                      avatarUrl={
                        item.props.sender === 'ai' ? local.aiAvatarUrl : undefined
                      }
                    />
                  )
                }
                if (item.type === 'survey') {
                  return (
                    <ChatSurveyMessage {...item.props} avatarUrl={local.aiAvatarUrl} />
                  )
                }
                return null
              }}
            </For>

            {/* Typing indicator */}
            <Show when={local.isTyping}>
              <div class="flex gap-3 w-full justify-start">
                <Avatar src={local.aiAvatarUrl} fallback="AI" size="sm" />
                <div class="px-4 py-3 rounded-2xl rounded-tl-md bg-secondary">
                  <div class="flex gap-1">
                    <span
                      class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                      style={{ 'animation-delay': '0ms' }}
                    />
                    <span
                      class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                      style={{ 'animation-delay': '150ms' }}
                    />
                    <span
                      class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                      style={{ 'animation-delay': '300ms' }}
                    />
                  </div>
                </div>
              </div>
            </Show>

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <ChatInput {...local.inputProps} onFocus={handleInputFocus} />
      </div>
    </div>
  )
}

export default ChatPage
