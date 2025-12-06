import { type Component, Show } from 'solid-js'
import { cn } from '@/lib/utils'

export interface AudioButtonProps {
  /** Whether audio is currently playing */
  isPlaying?: boolean
  /** Whether audio is loading */
  isLoading?: boolean
  /** Click handler */
  onClick?: () => void
  /** Optional size - defaults to 48px (w-12 h-12) */
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
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
}

export const AudioButton: Component<AudioButtonProps> = (props) => {
  const size = () => props.size || 'md'

  return (
    <button
      onClick={props.onClick}
      disabled={props.isLoading}
      class={cn(
        'flex items-center justify-center rounded-full transition-all cursor-pointer',
        'bg-primary hover:opacity-90 disabled:opacity-50',
        sizeClasses[size()],
        props.class
      )}
      aria-label={props['aria-label'] ?? 'Play audio'}
    >
      <Show when={props.isLoading}>
        {/* Spinner icon */}
        <svg class={cn('text-foreground animate-spin', iconSizes[size()])} fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </Show>
      <Show when={!props.isLoading && props.isPlaying}>
        {/* Pause icon */}
        <svg class={cn('text-foreground', iconSizes[size()])} fill="currentColor" viewBox="0 0 256 256">
          <path d="M216,48V208a16,16,0,0,1-16,16H160a16,16,0,0,1-16-16V48a16,16,0,0,1,16-16h40A16,16,0,0,1,216,48ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Z" />
        </svg>
      </Show>
      <Show when={!props.isLoading && !props.isPlaying}>
        {/* Play icon */}
        <svg class={cn('text-foreground', iconSizes[size()])} fill="currentColor" viewBox="0 0 256 256">
          <path d="M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27Z" />
        </svg>
      </Show>
    </button>
  )
}
