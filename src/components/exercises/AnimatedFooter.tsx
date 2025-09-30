import { ReactNode } from 'react'
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
        'fixed bottom-0 left-0 right-0 z-10 bg-neutral-700 border-t border-neutral-600 transition-transform duration-300 ease-out',
        show ? 'translate-y-0' : 'translate-y-full',
        className
      )}
    >
      <div className="max-w-2xl mx-auto px-6 py-4">
        {children}
      </div>
    </div>
  )
}
