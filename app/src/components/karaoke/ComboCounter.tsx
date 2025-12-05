import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface ComboCounterProps {
  /** Current combo multiplier (1 = no combo, 2+ = active combo) */
  combo: number
  className?: string
}

/**
 * Displays combo multiplier (x1, x2, x3, etc.)
 * Animates when combo increases.
 */
export function ComboCounter({
  combo,
  className,
}: ComboCounterProps) {
  const hasCombo = combo >= 2
  const [isAnimating, setIsAnimating] = useState(false)
  const prevComboRef = useRef(combo)

  // Trigger animation when combo increases
  useEffect(() => {
    if (combo > prevComboRef.current) {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 300)
      return () => clearTimeout(timer)
    }
    prevComboRef.current = combo
  }, [combo])

  return (
    <div
      className={cn(
        'flex items-center gap-1 font-black tabular-nums transition-all duration-200',
        hasCombo ? 'scale-110' : 'scale-100',
        hasCombo ? 'text-amber-400' : 'text-white/40',
        isAnimating && 'animate-score-pop',
        className
      )}
    >
      <span className="text-lg">x</span>
      <span className="text-2xl">{combo}</span>
    </div>
  )
}
