import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface PerformanceGlowProps {
  /** Show hit effect (green) */
  showHit?: boolean
  /** Show miss effect (red) */
  showMiss?: boolean
  /** Trigger key to re-animate (e.g., Date.now() on each grade) */
  triggerKey?: number
  className?: string
}

/**
 * Edge glow effect for karaoke performance feedback.
 * - Green glow on hit
 * - Red glow on miss
 * Glows on bottom, left, and right edges (not top).
 */
export function PerformanceGlow({
  showHit = false,
  showMiss = false,
  triggerKey,
  className,
}: PerformanceGlowProps) {
  const [hitAnimating, setHitAnimating] = useState(false)
  const [missAnimating, setMissAnimating] = useState(false)

  // Trigger hit animation
  useEffect(() => {
    if (showHit) {
      setHitAnimating(true)
      const timer = setTimeout(() => setHitAnimating(false), 350)
      return () => clearTimeout(timer)
    }
  }, [showHit, triggerKey])

  // Trigger miss animation
  useEffect(() => {
    if (showMiss) {
      setMissAnimating(true)
      const timer = setTimeout(() => setMissAnimating(false), 400)
      return () => clearTimeout(timer)
    }
  }, [showMiss, triggerKey])

  return (
    <>
      {/* Hit effect - green pulse */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 transition-opacity duration-200',
          hitAnimating ? 'opacity-100' : 'opacity-0',
          className
        )}
        style={{
          boxShadow: `
            inset 0 -25px 35px -10px rgba(74, 222, 128, 0.4),
            inset 20px 0 30px -10px rgba(74, 222, 128, 0.3),
            inset -20px 0 30px -10px rgba(74, 222, 128, 0.3)
          `,
        }}
      />

      {/* Miss effect - red pulse */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 transition-opacity duration-200',
          missAnimating ? 'opacity-100' : 'opacity-0',
          className
        )}
        style={{
          boxShadow: `
            inset 0 -30px 40px -10px rgba(239, 68, 68, 0.5),
            inset 25px 0 35px -10px rgba(239, 68, 68, 0.4),
            inset -25px 0 35px -10px rgba(239, 68, 68, 0.4)
          `,
        }}
      />
    </>
  )
}
