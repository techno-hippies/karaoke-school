import { type Component, createSignal, createEffect, onCleanup, Show } from 'solid-js'
import { cn, haptic } from '@/lib/utils'

export type PracticeGrade = 'A' | 'B' | 'C' | 'D' | 'F'

const GRADES: PracticeGrade[] = ['A', 'B', 'C', 'D', 'F']

const gradeStyles: Record<PracticeGrade, string> = {
  A: 'text-emerald-400',
  B: 'text-green-300',
  C: 'text-yellow-300',
  D: 'text-orange-300',
  F: 'text-red-400',
}

const gradeGlows: Record<PracticeGrade, string> = {
  A: 'drop-shadow-[0_0_40px_rgba(52,211,153,0.6)]',
  B: 'drop-shadow-[0_0_35px_rgba(134,239,172,0.5)]',
  C: 'drop-shadow-[0_0_30px_rgba(253,224,71,0.5)]',
  D: 'drop-shadow-[0_0_30px_rgba(253,186,116,0.5)]',
  F: 'drop-shadow-[0_0_30px_rgba(248,113,113,0.5)]',
}

export interface GradeSlotMachineProps {
  /** The final grade to land on (null = still spinning) */
  grade: PracticeGrade | null
  /** Whether currently grading (spinning) */
  isSpinning: boolean
  class?: string
}

/**
 * Slot machine style grade reveal.
 * Spins through grades while grading, lands on final grade when done.
 */
export const GradeSlotMachine: Component<GradeSlotMachineProps> = (props) => {
  const [currentIndex, setCurrentIndex] = createSignal(0)
  const [isLanding, setIsLanding] = createSignal(false)
  const [hasLanded, setHasLanded] = createSignal(false)

  let spinInterval: ReturnType<typeof setInterval> | undefined
  let landingTimeout: ReturnType<typeof setTimeout> | undefined

  // Spinning effect
  createEffect(() => {
    if (props.isSpinning && !props.grade) {
      // Start spinning
      setHasLanded(false)
      setIsLanding(false)

      spinInterval = setInterval(() => {
        setCurrentIndex(i => (i + 1) % GRADES.length)
      }, 80) // Fast spin
    } else if (props.grade && !hasLanded()) {
      // Grade arrived - start landing sequence
      clearInterval(spinInterval)
      setIsLanding(true)

      const targetIndex = GRADES.indexOf(props.grade)

      // Slow down effect: cycle through a few more times then land
      let spinsRemaining = 8 + targetIndex // Extra spins for drama
      let delay = 80

      const slowSpin = () => {
        if (spinsRemaining <= 0) {
          setCurrentIndex(targetIndex)
          setIsLanding(false)
          setHasLanded(true)
          haptic.success() // Satisfying reveal feedback
          return
        }

        setCurrentIndex(i => (i + 1) % GRADES.length)
        spinsRemaining--
        delay += 30 // Gradually slow down

        landingTimeout = setTimeout(slowSpin, delay)
      }

      slowSpin()
    }
  })

  onCleanup(() => {
    clearInterval(spinInterval)
    clearTimeout(landingTimeout)
  })

  const displayGrade = () => GRADES[currentIndex()]
  const isActive = () => props.isSpinning || isLanding()

  // Show colors while spinning too
  const currentGradeStyle = () => {
    if (hasLanded() && props.grade) {
      return gradeStyles[props.grade]
    }
    // Show dimmed colors while spinning
    return gradeStyles[displayGrade()] + ' opacity-40'
  }

  return (
    <div class={cn('relative overflow-hidden', props.class)}>
      {/* Slot machine window */}
      <div class="relative h-32 flex items-center justify-center">
        {/* Grade display */}
        <p
          class={cn(
            'text-9xl font-black tracking-tight transition-all',
            currentGradeStyle(),
            hasLanded() && props.grade && gradeGlows[props.grade],
            hasLanded() && 'animate-slot-land'
          )}
        >
          {displayGrade()}
        </p>

        {/* Blur effect on top/bottom when spinning */}
        <Show when={isActive()}>
          <div class="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-background to-transparent pointer-events-none" />
          <div class="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        </Show>
      </div>
    </div>
  )
}
