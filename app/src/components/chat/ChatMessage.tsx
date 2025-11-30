import { Translate, SpeakerHigh, Stop } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { AvatarWithSkeleton } from '@/components/ui/avatar-with-skeleton'

export interface ChatWord {
  text: string
  isHighlighted?: boolean
}

export interface ChatMessageProps {
  /** Message content - either string or array of words for highlighting */
  content: string | ChatWord[]
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
  /** Whether this message has audio available (or can fetch it on-demand) */
  hasAudio?: boolean
  /** Whether this message's audio is currently playing */
  isPlayingAudio?: boolean
  /** Whether TTS is currently loading for this message */
  isLoadingAudio?: boolean
  /** Called when play audio button clicked */
  onPlayAudio?: () => void
  /** Called when stop audio button clicked */
  onStopAudio?: () => void
  className?: string
}

/**
 * ChatMessage - Single chat bubble with word-level highlighting support
 *
 * AI messages: left-aligned with avatar
 * User messages: right-aligned, no avatar
 *
 * Word highlighting: Pass content as ChatWord[] with isHighlighted for TTS sync
 */
export function ChatMessage({
  content,
  sender,
  avatarUrl,
  showTranslate = false,
  translation,
  onTranslate,
  isTranslating = false,
  hasAudio = false,
  isPlayingAudio = false,
  isLoadingAudio = false,
  onPlayAudio,
  onStopAudio,
  className,
}: ChatMessageProps) {
  const isAI = sender === 'ai'

  // Normalize content to words array
  const words: ChatWord[] = typeof content === 'string'
    ? content.split(' ').map(text => ({ text, isHighlighted: false }))
    : content

  return (
    <div
      className={cn(
        'flex gap-3 w-full',
        isAI ? 'justify-start' : 'justify-end',
        className
      )}
    >
      {/* AI Avatar */}
      {isAI && (
        <AvatarWithSkeleton src={avatarUrl} alt="AI" size="sm" />
      )}

      {/* Message content */}
      <div
        className={cn(
          'flex flex-col max-w-[80%] md:max-w-[70%]',
          isAI ? 'items-start' : 'items-end'
        )}
      >
        {/* Message bubble */}
        <div
          className={cn(
            'px-4 py-3 rounded-2xl text-base leading-relaxed',
            isAI
              ? 'bg-secondary text-secondary-foreground rounded-tl-md'
              : 'bg-primary text-primary-foreground rounded-tr-md'
          )}
        >
          {/* Word-by-word rendering with highlighting */}
          <p className="whitespace-pre-wrap">
            {words.map((word, index) => {
              const trimmedText = word.text.trim()
              // Skip empty words (whitespace-only tokens from TTS)
              if (!trimmedText) return null

              // Find next non-empty word for spacing logic
              let nextWord: ChatWord | undefined
              let nextTrimmed = ''
              for (let i = index + 1; i < words.length; i++) {
                const t = words[i].text.trim()
                if (t) {
                  nextWord = words[i]
                  nextTrimmed = t
                  break
                }
              }

              // Don't add space before closing punctuation
              const nextIsClosingPunct = nextWord && /^[.,!?;:)\]}>…]/.test(nextTrimmed)
              // Don't add space after opening punctuation or merged opening quotes ("word)
              const currentIsOpeningPunct = /^[(\[{<]/.test(trimmedText)
              const startsWithOpenQuote = /^["'][a-zA-Z]/.test(trimmedText)

              const addSpace = nextWord && !nextIsClosingPunct && !currentIsOpeningPunct && !startsWithOpenQuote

              return (
                <span key={index}>
                  <span
                    className={cn(
                      'transition-colors duration-100',
                      word.isHighlighted && 'bg-yellow-400/50 text-foreground'
                    )}
                  >
                    {trimmedText}
                  </span>
                  {addSpace ? ' ' : ''}
                </span>
              )
            })}
          </p>
        </div>

        {/* Translation (if available) */}
        {translation && (
          <div className="mt-1.5 px-4 py-2 bg-muted/50 rounded-xl text-sm text-muted-foreground">
            {translation}
          </div>
        )}

        {/* Action buttons row */}
        {isAI && (showTranslate || hasAudio) && (
          <div className="mt-1.5 flex items-center gap-1">
            {/* Play/Stop audio button */}
            {hasAudio && (
              <button
                onClick={isPlayingAudio ? onStopAudio : onPlayAudio}
                disabled={isLoadingAudio}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
                  'text-sm text-muted-foreground hover:text-foreground',
                  'hover:bg-muted/50 transition-colors cursor-pointer',
                  isPlayingAudio && 'text-primary',
                  isLoadingAudio && 'opacity-50 cursor-wait'
                )}
              >
                {isPlayingAudio ? (
                  <>
                    <Stop className="w-4 h-4" weight="fill" />
                    <span>Stop</span>
                  </>
                ) : isLoadingAudio ? (
                  <>
                    <SpeakerHigh className="w-4 h-4 animate-pulse" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <SpeakerHigh className="w-4 h-4" />
                    <span>Play</span>
                  </>
                )}
              </button>
            )}

            {/* Translate button */}
            {showTranslate && !translation && (
              <button
                onClick={onTranslate}
                disabled={isTranslating}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
                  'text-sm text-muted-foreground hover:text-foreground',
                  'hover:bg-muted/50 transition-colors cursor-pointer',
                  isTranslating && 'opacity-50 cursor-wait'
                )}
              >
                <Translate className="w-4 h-4" />
                <span>{isTranslating ? 'Translating...' : 'Translate'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
