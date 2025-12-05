import { useState, useEffect, useRef } from 'react'
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
  /** Additional className */
  className?: string
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
export function ScoreCounter({
  score,
  animationDuration = 400,
  label = 'SCORE',
  size = 'md',
  className,
}: ScoreCounterProps) {
  const [displayScore, setDisplayScore] = useState(score)
  const [isAnimating, setIsAnimating] = useState(false)
  const previousScoreRef = useRef(score)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const previousScore = previousScoreRef.current
    const diff = score - previousScore

    // Skip animation if score decreased or no change
    if (diff <= 0) {
      setDisplayScore(score)
      previousScoreRef.current = score
      return
    }

    // Animate the score rolling up
    setIsAnimating(true)
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / animationDuration, 1)

      // Easing function for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const currentValue = Math.round(previousScore + diff * easeOut)

      setDisplayScore(currentValue)

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        setDisplayScore(score)
        setIsAnimating(false)
        previousScoreRef.current = score
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [score, animationDuration])

  const styles = sizeStyles[size]

  return (
    <div
      className={cn(
        'flex flex-col items-center',
        styles.container,
        className
      )}
    >
      {label && (
        <span
          className={cn(
            'uppercase tracking-wider text-white/60 font-medium',
            styles.label
          )}
        >
          {label}
        </span>
      )}
      <span
        className={cn(
          'font-black tabular-nums transition-transform duration-150',
          'text-transparent bg-clip-text bg-gradient-to-b from-white to-white/80',
          styles.score,
          isAnimating && 'scale-110'
        )}
      >
        {displayScore.toLocaleString()}
      </span>
    </div>
  )
}
