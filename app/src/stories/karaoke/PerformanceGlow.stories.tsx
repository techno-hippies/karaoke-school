import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Chinese livestream style floating hearts for performance feedback.
 * More hearts = doing well, fewer = struggling.
 */

const meta = {
  title: 'Karaoke/KaraokePracticeSession/TextEffects',
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

// Sample lyrics
const sampleLyrics = [
  { text: "Let's go!", isActive: false, isPast: true },
  { text: 'Steve walks warily down the street', isActive: false, isPast: true },
  { text: 'With the brim pulled way down low', isActive: true, isPast: false },
  { text: "Ain't no sound but the sound of his feet", isActive: false, isPast: false },
  { text: 'Machine guns ready to go', isActive: false, isPast: false },
]

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

  // Base tier by level
  if (level < 0.6) {
    pool = [...TIER_EMOJIS.basic]
  } else if (level < 0.8) {
    pool = [...TIER_EMOJIS.good]
  } else {
    pool = [...TIER_EMOJIS.great]
  }

  // Add streak emojis based on combo
  if (combo >= 10) {
    pool = [...pool, ...TIER_EMOJIS.hotStreak]
  } else if (combo >= 5) {
    pool = [...pool, ...TIER_EMOJIS.streak]
  }

  return pool
}

interface FloatingHeart {
  id: number
  emoji: string
  x: number // percentage from left
  delay: number
  duration: number
  size: number
  opacity: number
  wobble: number // pre-calculated wobble amount
}

interface PerformanceState {
  level: number // 0-1
  combo: number
  heartsPerSecond: number // base rate
}

/**
 * Floating Hearts Component - Chinese livestream style
 */
function FloatingHearts({
  heartsPerSecond,
  performanceLevel,
  combo = 1
}: {
  heartsPerSecond: number
  performanceLevel: number
  combo?: number
}) {
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
        x: 80 + Math.random() * 12, // Right side, tighter spread
        delay: 0,
        duration: 4, // Fixed 4s duration
        size: 28,
        opacity: 0.9,
        wobble: 0,
      }

      setHearts(prev => [...prev, heart])

      setTimeout(() => {
        setHearts(prev => prev.filter(h => h.id !== id))
      }, 4500)
    }

    const intervalId = setInterval(spawnHeart, interval)
    return () => clearInterval(intervalId)
  }, [heartsPerSecond, performanceLevel, combo])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-20">
      {hearts.map(heart => (
        <div
          key={heart.id}
          className="absolute heart-float"
          style={{
            left: `${heart.x}%`,
            bottom: '10%',
            fontSize: `${heart.size}px`,
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
            transform: translateY(-80vh);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}

/**
 * Lyrics display (simple version for demo)
 */
function LyricsDemo() {
  return (
    <div className="space-y-6 p-8 pt-32">
      {sampleLyrics.map((line, i) => (
        <p
          key={i}
          className={cn(
            'text-2xl font-bold leading-relaxed transition-all duration-300',
            line.isActive && 'text-white scale-105',
            line.isPast && 'text-neutral-500',
            !line.isActive && !line.isPast && 'text-neutral-600'
          )}
        >
          {line.text}
        </p>
      ))}
    </div>
  )
}

/**
 * Interactive Demo with controls
 */
function InteractiveHearts() {
  const [performance, setPerformance] = useState<PerformanceState>({
    level: 0.7,
    combo: 5,
    heartsPerSecond: 3,
  })

  // Calculate hearts per second based on performance
  const getHeartsRate = useCallback((level: number, combo: number) => {
    // Below 40% = no hearts (struggling)
    if (level < 0.4) return 0
    // 40-60% = very slow (0.3-0.5/sec)
    if (level < 0.6) return 0.3 + (level - 0.4) * 1
    // 60-80% = moderate (0.5-1/sec)
    if (level < 0.8) return 0.5 + (level - 0.6) * 2.5
    // 80%+ = fast (1-3/sec) with combo bonus
    const comboBonus = Math.min(combo, 10) * 0.1
    return 1 + (level - 0.8) * 10 + comboBonus
  }, [])

  const simulateScore = (rating: 'Easy' | 'Good' | 'Hard' | 'Again') => {
    setPerformance(prev => {
      const delta =
        rating === 'Easy' ? 0.2
        : rating === 'Good' ? 0.1
        : rating === 'Hard' ? -0.05
        : -0.25

      const newLevel = Math.max(0, Math.min(1, prev.level + delta))
      const newCombo = rating === 'Again' ? 1
        : rating === 'Hard' ? prev.combo
        : prev.combo + 1

      return {
        level: newLevel,
        combo: newCombo,
        heartsPerSecond: getHeartsRate(newLevel, newCombo),
      }
    })
  }

  // Update hearts rate when performance changes
  useEffect(() => {
    setPerformance(prev => ({
      ...prev,
      heartsPerSecond: getHeartsRate(prev.level, prev.combo),
    }))
  }, [getHeartsRate])

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Floating Hearts */}
      <FloatingHearts
        heartsPerSecond={performance.heartsPerSecond}
        performanceLevel={performance.level}
        combo={performance.combo}
      />

      {/* Controls */}
      <div className="fixed top-4 left-4 right-4 z-30 bg-neutral-900/90 backdrop-blur rounded-lg p-4 space-y-4">
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-sm text-neutral-400">Simulate:</span>
          <button
            onClick={() => simulateScore('Easy')}
            className="px-3 py-1 rounded text-sm bg-green-600 hover:bg-green-500"
          >
            Easy (100%)
          </button>
          <button
            onClick={() => simulateScore('Good')}
            className="px-3 py-1 rounded text-sm bg-lime-600 hover:bg-lime-500"
          >
            Good (75%)
          </button>
          <button
            onClick={() => simulateScore('Hard')}
            className="px-3 py-1 rounded text-sm bg-yellow-600 hover:bg-yellow-500"
          >
            Hard (50%)
          </button>
          <button
            onClick={() => simulateScore('Again')}
            className="px-3 py-1 rounded text-sm bg-red-600 hover:bg-red-500"
          >
            Again (0%)
          </button>
        </div>

        <div className="flex gap-4 text-sm">
          <span className="text-neutral-400">
            Level: <span className="text-white font-mono">{(performance.level * 100).toFixed(0)}%</span>
          </span>
          <span className="text-neutral-400">
            Combo: <span className="text-white font-mono">{performance.combo}x</span>
          </span>
          <span className="text-neutral-400">
            Hearts/sec: <span className="text-white font-mono">{performance.heartsPerSecond.toFixed(1)}</span>
          </span>
        </div>
      </div>

      {/* Lyrics */}
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-2xl">
          <LyricsDemo />
        </div>
      </div>
    </div>
  )
}

/**
 * Burst of hearts on score (for immediate feedback)
 */
function HeartBurst({ count, x, y }: { count: number; x: number; y: number }) {
  const hearts = Array.from({ length: count }, (_, i) => ({
    id: i,
    emoji: GOOD_EMOJIS[Math.floor(Math.random() * GOOD_EMOJIS.length)],
    angle: (360 / count) * i + Math.random() * 30,
    distance: 50 + Math.random() * 50,
    size: 16 + Math.random() * 12,
  }))

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: x, top: y }}
    >
      {hearts.map(heart => (
        <div
          key={heart.id}
          className="absolute animate-burst"
          style={{
            fontSize: `${heart.size}px`,
            '--angle': `${heart.angle}deg`,
            '--distance': `${heart.distance}px`,
          } as React.CSSProperties}
        >
          {heart.emoji}
        </div>
      ))}
      <style>{`
        @keyframes burst {
          0% {
            transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0) scale(0);
            opacity: 1;
          }
          50% {
            transform: translate(-50%, -50%) rotate(var(--angle)) translateY(calc(var(--distance) * -0.7)) scale(1.2);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) rotate(var(--angle)) translateY(calc(var(--distance) * -1)) scale(0.5);
            opacity: 0;
          }
        }
        .animate-burst {
          animation: burst 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

// ============================================
// Stories
// ============================================

export const FloatingHeartsDemo: Story = {
  render: () => <InteractiveHearts />,
}

export const HighPerformance: Story = {
  render: () => (
    <div className="min-h-screen bg-black relative">
      <FloatingHearts heartsPerSecond={2.5} performanceLevel={0.95} combo={12} />
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-2xl">
          <LyricsDemo />
        </div>
      </div>
    </div>
  ),
}

export const OnStreak: Story = {
  render: () => (
    <div className="min-h-screen bg-black relative">
      <FloatingHearts heartsPerSecond={1.5} performanceLevel={0.75} combo={7} />
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-2xl">
          <LyricsDemo />
        </div>
      </div>
    </div>
  ),
}

export const JustOkay: Story = {
  render: () => (
    <div className="min-h-screen bg-black relative">
      <FloatingHearts heartsPerSecond={0.4} performanceLevel={0.5} combo={2} />
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-2xl">
          <LyricsDemo />
        </div>
      </div>
    </div>
  ),
}

export const Struggling: Story = {
  render: () => (
    <div className="min-h-screen bg-black relative">
      <FloatingHearts heartsPerSecond={0} performanceLevel={0.2} combo={1} />
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-2xl">
          <LyricsDemo />
        </div>
      </div>
    </div>
  ),
}
