import { type Component, For, createSignal, createEffect, onCleanup } from 'solid-js'
import { cn } from '@/lib/utils'

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
  class?: string
}

/**
 * Chinese livestream style floating hearts.
 * More hearts = doing well, fewer = struggling.
 * Emoji tiers based on performance level and combo streaks.
 */
export const FloatingHearts: Component<FloatingHeartsProps> = (props) => {
  const [hearts, setHearts] = createSignal<FloatingHeart[]>([])
  let idCounter = 0

  createEffect(() => {
    const rate = props.heartsPerSecond
    if (rate <= 0) return

    // Minimum 400ms between hearts to avoid clutter
    const interval = Math.max(400, 1000 / rate)

    const spawnHeart = () => {
      const id = idCounter++
      const emojis = getEmojisForPerformance(props.performanceLevel, props.combo ?? 1)

      const heart: FloatingHeart = {
        id,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        x: 80 + Math.random() * 12, // Right side, 80-92%
      }

      setHearts(prev => [...prev, heart])

      // Remove heart after animation
      setTimeout(() => {
        setHearts(prev => prev.filter(h => h.id !== id))
      }, 4500)
    }

    const intervalId = setInterval(spawnHeart, interval)
    onCleanup(() => clearInterval(intervalId))
  })

  return (
    <div class={cn('fixed inset-0 pointer-events-none overflow-hidden z-20', props.class)}>
      <For each={hearts()}>
        {(heart) => (
          <div
            class="absolute animate-heart-rise"
            style={{
              left: `${heart.x}%`,
              bottom: '0%',
              'font-size': '28px',
            }}
          >
            {heart.emoji}
          </div>
        )}
      </For>
    </div>
  )
}

/**
 * Calculate hearts per second based on performance level and combo.
 * - Below 10% = no hearts (really struggling)
 * - 10-30% = very slow (encouragement)
 * - 30-60% = moderate
 * - 60%+ = fast with combo bonus
 *
 * Thresholds lowered to provide more positive feedback and encouragement.
 */
export function getHeartsRate(level: number, combo: number): number {
  // Below 10% = no hearts (really struggling)
  if (level < 0.1) return 0
  // 10-30% = very slow (0.3-0.5/sec) - encouragement hearts
  if (level < 0.3) return 0.3 + (level - 0.1) * 1.0
  // 30-60% = moderate (0.5-1.2/sec)
  if (level < 0.6) return 0.5 + (level - 0.3) * 2.3
  // 60%+ = fast (1.2-2.5/sec) with combo bonus
  const comboBonus = Math.min(combo, 10) * 0.1
  return 1.2 + (level - 0.6) * 3.25 + comboBonus
}
