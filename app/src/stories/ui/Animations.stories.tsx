import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Trophy, Fire, Star } from '@phosphor-icons/react'

const meta: Meta = {
  title: 'UI/Animations',
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.145 0 0)' },
      },
    },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj

/**
 * Grade reveal animation with bounce and blur effect
 */
export const GradeReveal: Story = {
  render: function GradeRevealStory() {
    const [key, setKey] = useState(0)
    const [grade, setGrade] = useState<'A' | 'B' | 'C' | 'D' | 'F'>('A')

    const gradeStyles = {
      A: 'text-emerald-400 drop-shadow-[0_0_30px_rgba(52,211,153,0.6)]',
      B: 'text-green-300 drop-shadow-[0_0_25px_rgba(134,239,172,0.5)]',
      C: 'text-yellow-300 drop-shadow-[0_0_25px_rgba(253,224,71,0.5)]',
      D: 'text-orange-300 drop-shadow-[0_0_25px_rgba(253,186,116,0.5)]',
      F: 'text-red-400 drop-shadow-[0_0_25px_rgba(248,113,113,0.5)]',
    }

    const handleReveal = (newGrade: typeof grade) => {
      setGrade(newGrade)
      setKey((k) => k + 1)
    }

    return (
      <div className="flex flex-col items-center gap-8">
        <div className="h-48 flex items-center justify-center">
          <span
            key={key}
            className={`text-9xl font-black animate-grade-reveal ${gradeStyles[grade]}`}
          >
            {grade}
          </span>
        </div>
        <div className="flex gap-2">
          {(['A', 'B', 'C', 'D', 'F'] as const).map((g) => (
            <Button
              key={g}
              variant="outline"
              size="sm"
              onClick={() => handleReveal(g)}
            >
              {g}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Click a grade to see the reveal animation
        </p>
      </div>
    )
  },
}

/**
 * Bounce in animation for success/error states
 */
export const BounceIn: Story = {
  render: function BounceInStory() {
    const [key, setKey] = useState(0)
    const [isCorrect, setIsCorrect] = useState(true)

    return (
      <div className="flex flex-col items-center gap-8">
        <div className="h-32 flex items-center justify-center">
          <div key={key} className="animate-bounce-in flex items-center gap-3">
            {isCorrect ? (
              <>
                <CheckCircle
                  size={48}
                  weight="fill"
                  className="text-emerald-400"
                />
                <span className="text-2xl font-bold text-emerald-400">
                  Perfect!
                </span>
              </>
            ) : (
              <>
                <XCircle size={48} weight="fill" className="text-red-400" />
                <span className="text-2xl font-bold text-red-400">
                  Try again
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-4">
          <Button
            variant="gradient-success"
            onClick={() => {
              setIsCorrect(true)
              setKey((k) => k + 1)
            }}
          >
            Show Correct
          </Button>
          <Button
            variant="gradient-fire"
            onClick={() => {
              setIsCorrect(false)
              setKey((k) => k + 1)
            }}
          >
            Show Incorrect
          </Button>
        </div>
      </div>
    )
  },
}

/**
 * Glow pulse animation for recording/active states
 */
export const GlowPulse: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-8">
      <div className="flex gap-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full bg-[image:var(--gradient-fire)] animate-glow-pulse flex items-center justify-center">
            <Fire size={40} weight="fill" className="text-white" />
          </div>
          <span className="text-sm text-muted-foreground">Recording</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full bg-[image:var(--gradient-primary)] animate-glow-pulse flex items-center justify-center" style={{ animationDelay: '0.5s' }}>
            <Star size={40} weight="fill" className="text-white" />
          </div>
          <span className="text-sm text-muted-foreground">Active</span>
        </div>
      </div>
      <Button variant="recording" size="lg">
        Recording Button
      </Button>
    </div>
  ),
}

/**
 * Text glow for active lyrics
 */
export const TextGlow: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-6">
      <p className="text-3xl font-bold text-white animate-text-glow">
        Catch the rhythm as the beat comes in
      </p>
      <p className="text-2xl font-bold text-neutral-400">
        Match the timing, glide across the notes
      </p>
      <p className="text-lg text-neutral-600">
        (Previous line - dimmed)
      </p>
    </div>
  ),
}

/**
 * Score pop animation
 */
export const ScorePop: Story = {
  render: function ScorePopStory() {
    const [score, setScore] = useState(85)
    const [key, setKey] = useState(0)

    const addScore = () => {
      setScore((s) => Math.min(100, s + Math.floor(Math.random() * 10) + 1))
      setKey((k) => k + 1)
    }

    return (
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">
            Score
          </p>
          <span
            key={key}
            className="text-7xl font-black text-transparent bg-clip-text bg-[image:var(--gradient-gold)] animate-score-pop inline-block"
          >
            {score}%
          </span>
        </div>
        <Button variant="gradient-gold" onClick={addScore}>
          Add Points
        </Button>
      </div>
    )
  },
}

/**
 * Achievement unlock animation
 */
export const AchievementUnlock: Story = {
  render: function AchievementUnlockStory() {
    const [key, setKey] = useState(0)

    return (
      <div className="flex flex-col items-center gap-6">
        <div
          key={key}
          className="animate-bounce-in flex flex-col items-center gap-4 p-8 rounded-2xl bg-card border border-border"
        >
          <div className="w-20 h-20 rounded-full bg-[image:var(--gradient-gold)] flex items-center justify-center shadow-[var(--glow-gold)]">
            <Trophy size={40} weight="fill" className="text-black" />
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-white">Perfect Streak!</p>
            <p className="text-sm text-muted-foreground">
              5 lines in a row with 90%+ accuracy
            </p>
          </div>
        </div>
        <Button variant="gradient" onClick={() => setKey((k) => k + 1)}>
          Replay Animation
        </Button>
      </div>
    )
  },
}

/**
 * Shimmer loading effect
 */
export const ShimmerEffect: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <div className="h-4 rounded-full bg-secondary overflow-hidden">
        <div className="h-full w-full animate-shimmer" />
      </div>
      <div className="h-4 rounded-full bg-secondary overflow-hidden w-3/4">
        <div className="h-full w-full animate-shimmer" style={{ animationDelay: '0.2s' }} />
      </div>
      <div className="h-4 rounded-full bg-secondary overflow-hidden w-1/2">
        <div className="h-full w-full animate-shimmer" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  ),
}

/**
 * Combined karaoke feedback showcase
 */
export const KaraokeFeedbackShowcase: Story = {
  render: function ShowcaseStory() {
    const [phase, setPhase] = useState<'idle' | 'recording' | 'result'>('idle')
    const [grade, setGrade] = useState<'A' | 'B' | 'C'>('A')

    const startRecording = () => {
      setPhase('recording')
      setTimeout(() => {
        setGrade(['A', 'B', 'C'][Math.floor(Math.random() * 3)] as 'A' | 'B' | 'C')
        setPhase('result')
      }, 2000)
    }

    const reset = () => setPhase('idle')

    const gradeConfig = {
      A: { label: 'Excellent', color: 'text-emerald-400', glow: 'drop-shadow-[0_0_30px_rgba(52,211,153,0.6)]' },
      B: { label: 'Great', color: 'text-green-300', glow: 'drop-shadow-[0_0_25px_rgba(134,239,172,0.5)]' },
      C: { label: 'Good', color: 'text-yellow-300', glow: 'drop-shadow-[0_0_25px_rgba(253,224,71,0.5)]' },
    }

    return (
      <div className="w-96 p-6 rounded-2xl bg-card border border-border">
        <div className="h-64 flex items-center justify-center">
          {phase === 'idle' && (
            <p className="text-xl text-muted-foreground text-center">
              Press Start to begin practice
            </p>
          )}
          {phase === 'recording' && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-2xl font-bold text-white animate-text-glow">
                Sing along with the music...
              </p>
              <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-[image:var(--gradient-fire)] animate-shimmer" style={{ width: '60%' }} />
              </div>
            </div>
          )}
          {phase === 'result' && (
            <div className="flex flex-col items-center gap-2 animate-bounce-in">
              <span className={`text-8xl font-black ${gradeConfig[grade].color} ${gradeConfig[grade].glow}`}>
                {grade}
              </span>
              <span className="text-xl font-semibold text-white">
                {gradeConfig[grade].label}
              </span>
            </div>
          )}
        </div>
        <Button
          variant={phase === 'recording' ? 'recording' : 'gradient'}
          size="lg"
          className="w-full"
          onClick={phase === 'result' ? reset : startRecording}
          disabled={phase === 'recording'}
        >
          {phase === 'idle' && 'Start Practice'}
          {phase === 'recording' && 'Recording...'}
          {phase === 'result' && 'Try Again'}
        </Button>
      </div>
    )
  },
}
