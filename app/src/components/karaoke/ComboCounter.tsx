import { type Component, createSignal, createEffect } from 'solid-js'
import { cn } from '@/lib/utils'

export interface ComboCounterProps {
  /** Current combo multiplier (1 = no combo, 2+ = active combo) */
  combo: number
  class?: string
}

/**
 * Displays combo multiplier (x1, x2, x3, etc.)
 * Animates when combo increases.
 */
export const ComboCounter: Component<ComboCounterProps> = (props) => {
  const [isAnimating, setIsAnimating] = createSignal(false)
  let prevCombo = props.combo

  createEffect(() => {
    if (props.combo > prevCombo) {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 300)
      prevCombo = props.combo
      return () => clearTimeout(timer)
    }
    prevCombo = props.combo
  })

  const hasCombo = () => props.combo >= 2

  return (
    <div
      class={cn(
        'flex items-center gap-1 font-black tabular-nums transition-all duration-200',
        hasCombo() ? 'scale-110' : 'scale-100',
        hasCombo() ? 'text-amber-400' : 'text-white/40',
        isAnimating() && 'animate-score-pop',
        props.class
      )}
    >
      <span class="text-lg">x</span>
      <span class="text-2xl">{props.combo}</span>
    </div>
  )
}
