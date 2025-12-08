import { type ParentComponent } from 'solid-js'
import { cn } from '@/lib/utils'

export interface AnimatedFooterProps {
  /** Whether the footer should be visible (slides up when true) */
  show: boolean
  /** Custom className for additional styling */
  class?: string
}

export const AnimatedFooter: ParentComponent<AnimatedFooterProps> = (props) => {
  return (
    <div
      class={cn(
        'border-t border-border bg-background flex-shrink-0 transition-transform duration-300 ease-out',
        props.show ? 'translate-y-0' : 'translate-y-full pointer-events-none',
        props.class
      )}
    >
      <div class="max-w-3xl mx-auto w-full px-4 sm:px-6 md:px-8 py-4" style={{ 'padding-bottom': 'calc(1rem + env(safe-area-inset-bottom))' }}>
        {props.children}
      </div>
    </div>
  )
}
