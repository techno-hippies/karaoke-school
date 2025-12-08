import { type Component, For, createSignal, createEffect, onCleanup } from 'solid-js'
import { cn } from '@/lib/utils'

export interface TimelineLyricLine {
  text: string
  startMs: number
  endMs: number
}

export type TimelineColorScheme = 'red' | 'blue' | 'green' | 'purple' | 'orange'

export interface VerticalTimelineProps {
  /** Lyrics with timing */
  lines: TimelineLyricLine[]
  /** Current playback time in ms */
  currentTimeMs: number
  /** Pixels per second - controls how spread out the timeline is */
  pixelsPerSecond?: number
  /** Height of the visible viewport */
  viewportHeight?: number
  /** Position of the NOW marker from top (0-1, default 0.3 = 30% from top) */
  nowMarkerPosition?: number
  /** Color scheme */
  colorScheme?: TimelineColorScheme
  /** Enable Guitar Hero style effects */
  guitarHeroMode?: boolean
  class?: string
}

const COLOR_SCHEMES: Record<TimelineColorScheme, { accent: string; glow: string; fill: string }> = {
  red: { accent: '#ef4444', glow: '0 0 30px #ef4444, 0 0 60px #ef444480', fill: 'rgba(239, 68, 68, 0.3)' },
  blue: { accent: '#3b82f6', glow: '0 0 30px #3b82f6, 0 0 60px #3b82f680', fill: 'rgba(59, 130, 246, 0.3)' },
  green: { accent: '#22c55e', glow: '0 0 30px #22c55e, 0 0 60px #22c55e80', fill: 'rgba(34, 197, 94, 0.3)' },
  purple: { accent: '#a855f7', glow: '0 0 30px #a855f7, 0 0 60px #a855f780', fill: 'rgba(168, 85, 247, 0.3)' },
  orange: { accent: '#f97316', glow: '0 0 30px #f97316, 0 0 60px #f9731680', fill: 'rgba(249, 115, 22, 0.3)' },
}

/**
 * Vertical scrolling timeline where:
 * - Physical distance = actual time
 * - Block HEIGHT = line duration (how long to sing)
 * - Block TOP edge = when to START singing
 * - Block BOTTOM edge = when to STOP
 * - NOW marker sweeps through blocks as you sing
 */
export const VerticalTimeline: Component<VerticalTimelineProps> = (props) => {
  const pixelsPerSecond = () => props.pixelsPerSecond ?? 80
  const viewportHeight = () => props.viewportHeight ?? 500
  const nowMarkerPosition = () => props.nowMarkerPosition ?? 0.35
  const colors = () => COLOR_SCHEMES[props.colorScheme ?? 'red']
  const guitarHero = () => props.guitarHeroMode ?? true

  // Convert time to Y position (relative to NOW marker)
  const timeToY = (timeMs: number) => {
    const deltaMs = timeMs - props.currentTimeMs
    const deltaSec = deltaMs / 1000
    return deltaSec * pixelsPerSecond()
  }

  // Convert duration to height in pixels
  const durationToHeight = (startMs: number, endMs: number) => {
    const durationSec = (endMs - startMs) / 1000
    return Math.max(durationSec * pixelsPerSecond(), 30) // Minimum 30px height
  }

  // Get line status based on current time
  const getLineStatus = (line: TimelineLyricLine) => {
    if (props.currentTimeMs >= line.startMs && props.currentTimeMs <= line.endMs) {
      return 'active'
    }
    if (props.currentTimeMs > line.endMs) {
      return 'past'
    }
    return 'upcoming'
  }

  // Calculate progress through active line (0-1)
  const getActiveProgress = (line: TimelineLyricLine) => {
    if (props.currentTimeMs < line.startMs) return 0
    if (props.currentTimeMs > line.endMs) return 1
    return (props.currentTimeMs - line.startMs) / (line.endMs - line.startMs)
  }

  // Calculate how "urgent" an upcoming line is (for visual intensity)
  const getUrgency = (line: TimelineLyricLine) => {
    if (props.currentTimeMs >= line.startMs) return 0
    const msUntil = line.startMs - props.currentTimeMs
    if (msUntil < 500) return 1 // Very soon!
    if (msUntil < 1500) return 0.7
    if (msUntil < 3000) return 0.4
    return 0.2
  }

  const nowMarkerY = () => viewportHeight() * nowMarkerPosition()

  return (
    <div
      class={cn('relative overflow-hidden', props.class)}
      style={{ height: `${viewportHeight()}px` }}
    >

      {/* NOW marker line - the hit zone */}
      <div
        class="absolute left-0 right-0 z-20 pointer-events-none"
        style={{ top: `${nowMarkerY()}px`, transform: 'translateY(-50%)' }}
      >
        {/* Glow effect behind */}
        {guitarHero() && (
          <div
            class="absolute inset-x-0 h-8 -top-4 blur-xl opacity-60"
            style={{ background: `linear-gradient(to bottom, transparent, ${colors().accent}, transparent)` }}
          />
        )}

        {/* Main line */}
        <div class="flex items-center gap-2">
          <div
            class="w-4 h-4 rounded-full animate-pulse"
            style={{
              background: colors().accent,
              'box-shadow': guitarHero() ? colors().glow : `0 0 10px ${colors().accent}`,
            }}
          />
          <div
            class="flex-1 h-1 rounded-full"
            style={{
              background: `linear-gradient(to right, ${colors().accent}, transparent)`,
              'box-shadow': guitarHero() ? `0 0 10px ${colors().accent}` : undefined,
            }}
          />
        </div>
      </div>

      {/* Scrolling lyrics container */}
      <div class="absolute inset-0">
        <For each={props.lines}>
          {(line) => {
            const topY = () => nowMarkerY() + timeToY(line.startMs)
            const height = () => durationToHeight(line.startMs, line.endMs)
            const status = () => getLineStatus(line)
            const urgency = () => getUrgency(line)
            const progress = () => getActiveProgress(line)

            return (
              <div
                class={cn(
                  'absolute left-4 right-4 rounded-lg overflow-hidden',
                  'flex items-center justify-center text-center font-medium',
                  guitarHero() && status() === 'active' && 'animate-pulse',
                )}
                style={{
                  top: `${topY()}px`,
                  height: `${height()}px`,
                  opacity: status() === 'past' ? 0.25 : status() === 'upcoming' ? 0.4 + urgency() * 0.6 : 1,
                  background: status() === 'active'
                    ? `linear-gradient(to bottom, ${colors().fill}, ${colors().accent}20)`
                    : status() === 'upcoming'
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(255,255,255,0.03)',
                  border: status() === 'active'
                    ? `2px solid ${colors().accent}`
                    : '1px solid rgba(255,255,255,0.15)',
                  'box-shadow': status() === 'active' && guitarHero()
                    ? colors().glow
                    : undefined,
                  transition: 'box-shadow 0.15s, border 0.15s, background 0.15s',
                }}
              >
                {/* Progress fill for active line - sweeps down */}
                {status() === 'active' && (
                  <div
                    class="absolute inset-x-0 top-0 origin-top"
                    style={{
                      height: `${progress() * 100}%`,
                      background: `linear-gradient(to bottom, ${colors().accent}50, ${colors().accent}20)`,
                      'box-shadow': guitarHero() ? `inset 0 0 20px ${colors().accent}40` : undefined,
                    }}
                  />
                )}

                {/* Shimmer effect on active */}
                {status() === 'active' && guitarHero() && (
                  <div
                    class="absolute inset-0 opacity-30"
                    style={{
                      background: `linear-gradient(105deg, transparent 40%, ${colors().accent}40 50%, transparent 60%)`,
                      animation: 'shimmer 2s infinite',
                    }}
                  />
                )}

                {/* Text */}
                <span
                  class={cn(
                    'relative z-10 px-3 py-1',
                    status() === 'active' && 'text-white font-bold',
                    status() === 'past' && 'text-white/40',
                    status() === 'upcoming' && 'text-white/90',
                  )}
                  style={{
                    'text-shadow': status() === 'active'
                      ? `0 0 20px ${colors().accent}, 0 0 40px ${colors().accent}80`
                      : status() === 'upcoming' && urgency() > 0.5
                        ? '0 0 10px rgba(255,255,255,0.3)'
                        : undefined,
                    'font-size': height() < 50 ? '14px' : '16px',
                    transform: status() === 'active' ? 'scale(1.05)' : undefined,
                    transition: 'transform 0.15s',
                  }}
                >
                  {line.text}
                </span>
              </div>
            )
          }}
        </For>
      </div>

      {/* Time indicator */}
      <div class="absolute bottom-2 right-3 text-xs text-white/50 font-mono z-10">
        {(props.currentTimeMs / 1000).toFixed(1)}s
      </div>

      {/* Top fade - subtle gradient */}
      <div class="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-background via-background/50 to-transparent pointer-events-none z-10" />

      {/* Bottom fade - taller gradient for footer overlap */}
      <div class="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background via-background/70 to-transparent pointer-events-none z-10" />

      {/* Shimmer keyframe injection */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}

/**
 * Hook to simulate playback time for demos
 */
export function usePlaybackSimulator(durationMs: number, autoStart = false) {
  const [currentTimeMs, setCurrentTimeMs] = createSignal(0)
  const [isPlaying, setIsPlaying] = createSignal(autoStart)

  createEffect(() => {
    if (!isPlaying()) return

    const startTime = performance.now() - currentTimeMs()

    const tick = () => {
      const elapsed = performance.now() - startTime
      if (elapsed >= durationMs) {
        setCurrentTimeMs(durationMs)
        setIsPlaying(false)
        return
      }
      setCurrentTimeMs(elapsed)
      requestAnimationFrame(tick)
    }

    const rafId = requestAnimationFrame(tick)
    onCleanup(() => cancelAnimationFrame(rafId))
  })

  return {
    currentTimeMs,
    isPlaying,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    reset: () => { setCurrentTimeMs(0); setIsPlaying(false) },
    seek: (ms: number) => setCurrentTimeMs(Math.max(0, Math.min(ms, durationMs))),
  }
}
