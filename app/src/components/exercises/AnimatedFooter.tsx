import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface AnimatedFooterProps {
  /** Whether the footer should be visible (slides up when true) */
  show: boolean
  /** Content to display in the footer */
  children: ReactNode
  /** Custom className for additional styling */
  className?: string
}

export function AnimatedFooter({ show, children, className }: AnimatedFooterProps) {
  return (
    <div
      className={cn(
        'border-t border-border bg-background flex-shrink-0 transition-transform duration-300 ease-out',
        show ? 'translate-y-0' : 'translate-y-full pointer-events-none',
        className
      )}
    >
      <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 md:px-8 py-4">
        {children}
      </div>
    </div>
  )
}
