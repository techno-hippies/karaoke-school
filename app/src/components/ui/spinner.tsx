/**
 * Spinner Component for SolidJS
 */

import type { Component } from 'solid-js'
import { cn } from '@/lib/utils'

interface SpinnerProps {
  class?: string
  size?: 'sm' | 'md' | 'lg'
}

export const Spinner: Component<SpinnerProps> = (props) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-10 w-10',
  }

  return (
    <div
      class={cn(
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        sizeClasses[props.size || 'md'],
        props.class
      )}
    >
      <span class="sr-only">Loading...</span>
    </div>
  )
}
