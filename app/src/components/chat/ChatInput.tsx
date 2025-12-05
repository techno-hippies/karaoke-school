import { useState, useRef, useEffect } from 'react'
import { PaperPlaneRight, Waveform, Stop } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export interface ChatInputProps {
  /** Called when user sends a message */
  onSend?: (message: string) => void
  /** Called when user taps voice button to start recording */
  onStartRecording?: () => void
  /** Called when user taps stop button to stop recording */
  onStopRecording?: () => void
  /** Called when input is focused (for scroll handling) */
  onFocus?: () => void
  /** Placeholder text */
  placeholder?: string
  /** Disable input */
  disabled?: boolean
  /** Is currently recording */
  isRecording?: boolean
  /** Recording duration in seconds (for display) */
  recordingDuration?: number
  /** Is processing audio (transcribing) */
  isProcessing?: boolean
  className?: string
}

/**
 * ChatInput - Text input with send/voice button, keyboard-aware on mobile
 *
 * Features:
 * - Auto-resize textarea
 * - Send on Enter (Shift+Enter for newline)
 * - Single action button: voice (empty) → send (has text)
 * - Mobile keyboard awareness using visualViewport API
 */
/** Format seconds as M:SS */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function ChatInput({
  onSend,
  onStartRecording,
  onStopRecording,
  onFocus,
  placeholder,
  disabled = false,
  isRecording = false,
  recordingDuration = 0,
  isProcessing = false,
  className,
}: ChatInputProps) {
  const { t } = useTranslation()
  const [message, setMessage] = useState('')
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Use translation for default placeholder
  const inputPlaceholder = placeholder ?? t('chatInput.placeholder')

  // Handle mobile keyboard visibility
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const handleResize = () => {
      // Calculate keyboard height from viewport difference
      const heightDiff = window.innerHeight - viewport.height
      setKeyboardHeight(heightDiff > 100 ? heightDiff : 0)
    }

    viewport.addEventListener('resize', handleResize)
    viewport.addEventListener('scroll', handleResize)

    return () => {
      viewport.removeEventListener('resize', handleResize)
      viewport.removeEventListener('scroll', handleResize)
    }
  }, [])

  // Auto-resize textarea (grow only, min 44px)
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset to min height to get accurate scrollHeight
    textarea.style.height = '44px'
    const newHeight = Math.max(44, Math.min(textarea.scrollHeight, 120))
    textarea.style.height = `${newHeight}px`
  }, [message])

  const handleSend = () => {
    const trimmed = message.trim()
    if (!trimmed || disabled) return

    onSend?.(trimmed)
    setMessage('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasText = message.trim().length > 0

  const handleActionButton = () => {
    if (isRecording) {
      onStopRecording?.()
    } else if (hasText) {
      handleSend()
    } else {
      onStartRecording?.()
    }
  }

  // Processing state - show spinner
  if (isProcessing) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'flex-shrink-0 bg-background border-t border-border',
          'px-4 transition-all duration-200',
          className
        )}
        style={{
          paddingTop: '14px',
          paddingBottom: keyboardHeight > 0
            ? `calc(${keyboardHeight}px + env(safe-area-inset-bottom) + 14px)`
            : 'calc(env(safe-area-inset-bottom) + 14px)',
        }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-3 h-11">
          <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">{t('chatInput.transcribing')}</span>
        </div>
      </div>
    )
  }

  // Recording state - show recording UI (subtle grey theme)
  if (isRecording) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'flex-shrink-0 bg-background border-t border-border',
          'px-4 transition-all duration-200',
          className
        )}
        style={{
          paddingTop: '14px',
          paddingBottom: keyboardHeight > 0
            ? `calc(${keyboardHeight}px + env(safe-area-inset-bottom) + 14px)`
            : 'calc(env(safe-area-inset-bottom) + 14px)',
        }}
      >
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          {/* Recording indicator */}
          <div className="flex-1 flex items-center gap-3 rounded-full bg-secondary px-4 h-11">
            {/* Pulsing dot */}
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />

            {/* Duration */}
            <span className="text-sm font-medium text-foreground">
              {formatDuration(recordingDuration)}
            </span>

            {/* Subtle waveform bars */}
            <div className="flex-1 flex items-center justify-center gap-[3px]">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="w-[3px] bg-muted-foreground/50 rounded-full animate-pulse"
                  style={{
                    height: `${6 + Math.random() * 10}px`,
                    animationDelay: `${i * 80}ms`,
                    animationDuration: `${400 + Math.random() * 200}ms`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Stop button - filled square icon */}
          <button
            onClick={handleActionButton}
            disabled={disabled}
            className={cn(
              'flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center',
              'bg-secondary text-foreground hover:bg-secondary/80',
              'transition-all duration-200',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Stop className="w-5 h-5" weight="fill" />
          </button>
        </div>
      </div>
    )
  }

  // Default state - text input
  return (
    <div
      ref={containerRef}
      className={cn(
        'flex-shrink-0 bg-background border-t border-border',
        'px-4 transition-all duration-200',
        className
      )}
      style={{
        paddingTop: '14px',
        paddingBottom: keyboardHeight > 0
          ? `calc(${keyboardHeight}px + env(safe-area-inset-bottom) + 14px)`
          : 'calc(env(safe-area-inset-bottom) + 14px)',
      }}
    >
      <div className="max-w-3xl mx-auto flex items-end gap-2">
        {/* Text input - matches h-11 (44px) from Input component */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          placeholder={inputPlaceholder}
          disabled={disabled}
          rows={1}
          className={cn(
            'flex-1 min-w-0 resize-none rounded-full bg-secondary px-4 py-[10px]',
            'text-base text-foreground placeholder:text-muted-foreground leading-6',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'scrollbar-hide'
          )}
        />

        {/* Action button: Mic (empty) / Send (has text) */}
        <button
          onClick={handleActionButton}
          disabled={disabled}
          className={cn(
            'flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center',
            'transition-all duration-200',
            hasText
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {hasText ? (
            <PaperPlaneRight className="w-5 h-5" weight="fill" />
          ) : (
            <Waveform className="w-5 h-5" weight="regular" />
          )}
        </button>
      </div>
    </div>
  )
}
