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
        'bg-background transition-transform duration-300 ease-out',
        show ? 'translate-y-0' : 'translate-y-full',
        className
      )}
    >
      <div className="w-full">
        {children}
      </div>
    </div>
  )
}
