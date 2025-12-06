import { type Component, Show } from 'solid-js'
import { cn } from '@/lib/utils'

export interface AudioButtonProps {
  /** Whether audio is currently playing */
  isPlaying?: boolean
  /** Whether audio is loading */
  isLoading?: boolean
  /** Click handler */
  onClick?: () => void
  /** Optional size - defaults to 'md' */
  size?: 'sm' | 'md' | 'lg'
  /** Optional className for additional styling */
  class?: string
  /** Aria label for accessibility */
  'aria-label'?: string
}

const sizeClasses = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
}

const iconSizes = {
  sm: 20,
  md: 24,
  lg: 32,
}

/**
 * Play/Pause button for audio controls (SolidJS)
 */
export const AudioButton: Component<AudioButtonProps> = (props) => {
  const size = () => props.size || 'md'
  const iconSize = () => iconSizes[size()]

  return (
    <button
      onClick={() => props.onClick?.()}
      disabled={props.isLoading}
      class={cn(
        'flex items-center justify-center rounded-full transition-all cursor-pointer',
        'bg-primary hover:opacity-90 disabled:opacity-50',
        sizeClasses[size()],
        props.class
      )}
      aria-label={props['aria-label'] || 'Play audio'}
    >
      <Show
        when={!props.isLoading}
        fallback={
          <svg
            width={iconSize()}
            height={iconSize()}
            viewBox="0 0 24 24"
            class="text-foreground animate-spin"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="3"
              fill="none"
              stroke-dasharray="31.4"
              stroke-dashoffset="10"
            />
          </svg>
        }
      >
        <Show
          when={props.isPlaying}
          fallback={
            // Play icon
            <svg
              width={iconSize()}
              height={iconSize()}
              viewBox="0 0 24 24"
              fill="currentColor"
              class="text-foreground"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          }
        >
          {/* Pause icon */}
          <svg
            width={iconSize()}
            height={iconSize()}
            viewBox="0 0 24 24"
            fill="currentColor"
            class="text-foreground"
          >
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        </Show>
      </Show>
    </button>
  )
}
