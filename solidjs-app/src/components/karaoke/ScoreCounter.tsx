import { type Component, createSignal, createEffect, onCleanup } from 'solid-js'
import { cn } from '@/lib/utils'

export interface ScoreCounterProps {
  /** Current score value (0-100+) */
  score: number
  /** Animation duration in ms for the rolling effect */
  animationDuration?: number
  /** Optional label above the score */
  label?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Additional class */
  class?: string
}

const sizeStyles = {
  sm: {
    container: 'gap-0.5',
    label: 'text-[10px]',
    score: 'text-2xl',
  },
  md: {
    container: 'gap-1',
    label: 'text-xs',
    score: 'text-4xl',
  },
  lg: {
    container: 'gap-1.5',
    label: 'text-sm',
    score: 'text-6xl',
  },
}

/**
 * Animated score counter that rolls up numbers like an arcade game.
 * Used during karaoke practice to show accumulating points.
 */
export const ScoreCounter: Component<ScoreCounterProps> = (props) => {
  const [displayScore, setDisplayScore] = createSignal(props.score)
  const [isAnimating, setIsAnimating] = createSignal(false)
  let previousScore = props.score
  let animationFrame: number | null = null

  createEffect(() => {
    const targetScore = props.score
    const diff = targetScore - previousScore

    // Skip animation if score decreased or no change
    if (diff <= 0) {
      setDisplayScore(targetScore)
      previousScore = targetScore
      return
    }

    // Animate the score rolling up
    setIsAnimating(true)
    const startTime = performance.now()
    const startScore = previousScore
    const duration = props.animationDuration ?? 400

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const currentValue = Math.round(startScore + diff * easeOut)

      setDisplayScore(currentValue)

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      } else {
        setDisplayScore(targetScore)
        setIsAnimating(false)
        previousScore = targetScore
      }
    }

    animationFrame = requestAnimationFrame(animate)

    onCleanup(() => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    })
  })

  const styles = () => sizeStyles[props.size ?? 'md']

  return (
    <div
      class={cn(
        'flex flex-col items-center',
        styles().container,
        props.class
      )}
    >
      {props.label !== '' && (
        <span
          class={cn(
            'uppercase tracking-wider text-white/60 font-medium',
            styles().label
          )}
        >
          {props.label ?? 'SCORE'}
        </span>
      )}
      <span
        class={cn(
          'font-black tabular-nums transition-transform duration-150',
          'text-transparent bg-clip-text bg-gradient-to-b from-white to-white/80',
          styles().score,
          isAnimating() && 'scale-110'
        )}
      >
        {displayScore().toLocaleString()}
      </span>
    </div>
  )
}
