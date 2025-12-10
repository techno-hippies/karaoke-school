import { type Component, splitProps } from 'solid-js'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/icons'

export interface BackButtonProps {
  /** Click handler */
  onClick?: () => void
  /** Button variant: 'back' shows caret-left, 'close' shows X */
  variant?: 'back' | 'close'
  /** Optional class overrides */
  class?: string
}

/**
 * Standardized navigation button for headers
 * - 'back' variant: caret-left icon for navigation back
 * - 'close' variant: X icon for dismissing/exiting
 */
export const BackButton: Component<BackButtonProps> = (props) => {
  const [local, others] = splitProps(props, ['onClick', 'variant', 'class'])
  const variant = () => local.variant ?? 'back'

  return (
    <button
      onClick={local.onClick}
      class={cn(
        'flex items-center justify-center w-10 h-10 rounded-full',
        'hover:bg-white/10 transition-colors cursor-pointer',
        'text-foreground',
        local.class
      )}
      aria-label={variant() === 'close' ? 'Close' : 'Go back'}
      {...others}
    >
      <Icon
        name={variant() === 'close' ? 'x' : 'caret-left'}
        class="text-2xl"
      />
    </button>
  )
}
