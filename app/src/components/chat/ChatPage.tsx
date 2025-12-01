import { useRef, useEffect, useCallback } from 'react'
import { Sparkle } from '@phosphor-icons/react'
import { ChatMessage, type ChatMessageProps } from './ChatMessage'
import { ChatSurveyMessage, type ChatSurveyMessageProps } from './ChatSurveyMessage'
import { ChatInput, type ChatInputProps } from './ChatInput'
import { BackButton } from '@/components/ui/back-button'
import { Button } from '@/components/ui/button'
import { AvatarWithSkeleton } from '@/components/ui/avatar-with-skeleton'
import { cn } from '@/lib/utils'

export type ChatItem =
  | { type: 'message'; id: string; props: ChatMessageProps }
  | { type: 'survey'; id: string; props: ChatSurveyMessageProps }

export interface ChatPageProps {
  /** Chat messages and survey items */
  items: ChatItem[]
  /** Input props */
  inputProps?: Omit<ChatInputProps, 'className'>
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
  className?: string
}

/**
 * ChatPage - Full chat interface with messages and input
 *
 * Features:
 * - Scrollable message list
 * - Auto-scroll to bottom on new messages
 * - Typing indicator
 * - Sticky input at bottom
 * - Supports both regular messages and survey questions
 */
export function ChatPage({
  items,
  inputProps,
  aiAvatarUrl,
  title = 'Chat',
  showHeader = true,
  onBack,
  isTyping = false,
  showUpgrade = false,
  onUpgrade,
  className,
}: ChatPageProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when items change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [items, isTyping])

  // Scroll to bottom when input is focused (for mobile keyboard)
  const handleInputFocus = useCallback(() => {
    // Wait for keyboard animation to complete before scrolling
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 300)
  }, [])

  return (
    <div className={cn('fixed inset-0 flex flex-col bg-background md:static md:h-screen', className)}>
      {/* Centered container for desktop */}
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full min-h-0">
      {/* Header */}
      {showHeader && (
        <div className="flex-shrink-0 relative flex items-center justify-between h-16 px-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex justify-start z-10">
            {onBack && <BackButton onClick={onBack} />}
          </div>
          <h1 className="absolute inset-0 flex items-center justify-center text-lg font-semibold pointer-events-none">{title}</h1>
          <div className="flex justify-end z-10">
            {showUpgrade && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onUpgrade}
              >
                <Sparkle className="w-4 h-4" weight="fill" />
                Upgrade
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide"
      >
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
          {items.map((item) => {
            if (item.type === 'message') {
              return (
                <ChatMessage
                  key={item.id}
                  {...item.props}
                  avatarUrl={item.props.sender === 'ai' ? aiAvatarUrl : undefined}
                />
              )
            }
            if (item.type === 'survey') {
              return (
                <ChatSurveyMessage
                  key={item.id}
                  {...item.props}
                  avatarUrl={aiAvatarUrl}
                />
              )
            }
            return null
          })}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-3 w-full justify-start">
              <AvatarWithSkeleton src={aiAvatarUrl} alt="AI" size="sm" />
              <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-secondary">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput {...inputProps} onFocus={handleInputFocus} />
      </div>
    </div>
  )
}
