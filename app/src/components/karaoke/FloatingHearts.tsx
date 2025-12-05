import { useState, useEffect, useRef } from 'react'

// Tiered emoji system
const TIER_EMOJIS = {
  basic: ['❤️', '💗'],           // 40-60%: just hearts
  good: ['❤️', '💖', '✨'],       // 60-80%: hearts + sparkle
  great: ['💖', '✨', '⭐'],       // 80%+: sparkles + stars
  streak: ['🔥'],                 // combo 5+: flames appear
  hotStreak: ['🔥', '💥', '⭐'],  // combo 10+: fire + explosion + gold
}

function getEmojisForPerformance(level: number, combo: number): string[] {
  let pool: string[] = []

  // Base tier by level (matching hearts rate thresholds)
  if (level < 0.5) {
    pool = [...TIER_EMOJIS.basic]      // 25-50%: just hearts
  } else if (level < 0.75) {
    pool = [...TIER_EMOJIS.good]       // 50-75%: hearts + sparkle
  } else {
    pool = [...TIER_EMOJIS.great]      // 75%+: sparkles + stars
  }

  // Add streak emojis based on combo
  if (combo >= 8) {
    pool = [...pool, ...TIER_EMOJIS.hotStreak]
  } else if (combo >= 4) {
    pool = [...pool, ...TIER_EMOJIS.streak]
  }

  return pool
}

interface FloatingHeart {
  id: number
  emoji: string
  x: number
}

export interface FloatingHeartsProps {
  /** Hearts per second spawn rate (0 = no hearts) */
  heartsPerSecond: number
  /** Performance level 0-1 for emoji selection */
  performanceLevel: number
  /** Current combo for streak emojis */
  combo?: number
  className?: string
}

/**
 * Chinese livestream style floating hearts.
 * More hearts = doing well, fewer = struggling.
 * Emoji tiers based on performance level and combo streaks.
 */
export function FloatingHearts({
  heartsPerSecond,
  performanceLevel,
  combo = 1,
  className,
}: FloatingHeartsProps) {
  const [hearts, setHearts] = useState<FloatingHeart[]>([])
  const idCounter = useRef(0)

  useEffect(() => {
    if (heartsPerSecond <= 0) return

    // Minimum 400ms between hearts to avoid clutter
    const interval = Math.max(400, 1000 / heartsPerSecond)

    const spawnHeart = () => {
      const id = idCounter.current++
      const emojis = getEmojisForPerformance(performanceLevel, combo)

      const heart: FloatingHeart = {
        id,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        x: 80 + Math.random() * 12, // Right side, 80-92%
      }

      setHearts(prev => [...prev, heart])

      setTimeout(() => {
        setHearts(prev => prev.filter(h => h.id !== id))
      }, 4500)
    }

    const intervalId = setInterval(spawnHeart, interval)
    return () => clearInterval(intervalId)
  }, [heartsPerSecond, performanceLevel, combo])

  if (hearts.length === 0) return null

  return (
    <div className={`fixed inset-0 pointer-events-none overflow-hidden z-20 ${className || ''}`}>
      {hearts.map(heart => (
        <div
          key={heart.id}
          className="absolute heart-float"
          style={{
            left: `${heart.x}%`,
            bottom: '0%',
            fontSize: '28px',
          }}
        >
          {heart.emoji}
        </div>
      ))}

      <style>{`
        .heart-float {
          animation: heart-rise 4s linear forwards;
        }
        @keyframes heart-rise {
          from {
            transform: translateY(0);
            opacity: 0.9;
          }
          to {
            transform: translateY(-100vh);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}

/**
 * Calculate hearts per second based on performance level and combo.
 * - Below 25% = no hearts (struggling)
 * - 25-50% = very slow
 * - 50-75% = moderate
 * - 75%+ = fast with combo bonus
 */
export function getHeartsRate(level: number, combo: number): number {
  // Below 25% = no hearts (struggling)
  if (level < 0.25) return 0
  // 25-50% = very slow (0.4-0.7/sec)
  if (level < 0.5) return 0.4 + (level - 0.25) * 1.2
  // 50-75% = moderate (0.7-1.5/sec)
  if (level < 0.75) return 0.7 + (level - 0.5) * 3.2
  // 75%+ = fast (1.5-3/sec) with combo bonus
  const comboBonus = Math.min(combo, 10) * 0.1
  return 1.5 + (level - 0.75) * 6 + comboBonus
}
