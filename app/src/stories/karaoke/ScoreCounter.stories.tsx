import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, useEffect } from 'react'
import { ScoreCounter } from '@/components/karaoke/ScoreCounter'
import { Button } from '@/components/ui/button'

const meta = {
  title: 'Karaoke/ScoreCounter',
  component: ScoreCounter,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0a0a0a' }],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    score: {
      control: { type: 'number', min: 0, max: 10000 },
    },
    animationDuration: {
      control: { type: 'number', min: 100, max: 2000 },
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof ScoreCounter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    score: 1250,
    label: 'SCORE',
    size: 'md',
    animationDuration: 400,
  },
}

export const Small: Story = {
  args: {
    score: 850,
    label: 'SCORE',
    size: 'sm',
  },
}

export const Large: Story = {
  args: {
    score: 9999,
    label: 'SCORE',
    size: 'lg',
  },
}

/**
 * Interactive demo showing the rolling number animation
 * when points are added after each "line" is graded.
 */
export const Interactive: Story = {
  render: function InteractiveStory() {
    const [score, setScore] = useState(0)

    const addPoints = (points: number) => {
      setScore((prev) => prev + points)
    }

    const reset = () => setScore(0)

    return (
      <div className="flex flex-col items-center gap-8">
        <ScoreCounter score={score} size="lg" />

        <div className="flex flex-col gap-3">
          <p className="text-sm text-white/50 text-center">
            Simulate line grades:
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => addPoints(100)}
              className="text-emerald-400 border-emerald-400/50"
            >
              PERFECT +100
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addPoints(75)}
              className="text-green-300 border-green-300/50"
            >
              GREAT +75
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addPoints(50)}
              className="text-yellow-300 border-yellow-300/50"
            >
              GOOD +50
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>
    )
  },
}

/**
 * Simulates a real karaoke session with automatic scoring
 */
export const SimulatedSession: Story = {
  render: function SimulatedSessionStory() {
    const [score, setScore] = useState(0)
    const [lineIndex, setLineIndex] = useState(0)
    const [isRunning, setIsRunning] = useState(false)
    const [lastGrade, setLastGrade] = useState<string | null>(null)

    const totalLines = 7

    useEffect(() => {
      if (!isRunning || lineIndex >= totalLines) {
        if (lineIndex >= totalLines) setIsRunning(false)
        return
      }

      const timer = setTimeout(() => {
        // Simulate varying grades
        const grades = [
          { label: 'PERFECT', points: 100, color: 'text-emerald-400' },
          { label: 'GREAT', points: 75, color: 'text-green-300' },
          { label: 'GOOD', points: 50, color: 'text-yellow-300' },
        ]
        const grade = grades[Math.floor(Math.random() * grades.length)]

        setScore((prev) => prev + grade.points)
        setLastGrade(grade.label)
        setLineIndex((prev) => prev + 1)
      }, 1500)

      return () => clearTimeout(timer)
    }, [isRunning, lineIndex])

    const start = () => {
      setScore(0)
      setLineIndex(0)
      setLastGrade(null)
      setIsRunning(true)
    }

    return (
      <div className="flex flex-col items-center gap-6 p-8 rounded-2xl bg-black/50 border border-white/10">
        <ScoreCounter score={score} size="lg" />

        {lastGrade && (
          <span
            key={lineIndex}
            className="text-xl font-bold text-emerald-400 animate-bounce-in"
          >
            {lastGrade}!
          </span>
        )}

        <div className="flex items-center gap-2 text-sm text-white/50">
          <span>Line {Math.min(lineIndex, totalLines)}/{totalLines}</span>
          {isRunning && <span className="animate-pulse">Singing...</span>}
        </div>

        <Button
          variant="gradient"
          onClick={start}
          disabled={isRunning}
        >
          {lineIndex >= totalLines ? 'Play Again' : isRunning ? 'In Progress...' : 'Start Session'}
        </Button>
      </div>
    )
  },
}

/**
 * Shows all size variants side by side
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-12">
      <div className="flex flex-col items-center gap-2">
        <ScoreCounter score={1234} size="sm" />
        <span className="text-xs text-white/40">Small</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <ScoreCounter score={1234} size="md" />
        <span className="text-xs text-white/40">Medium</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <ScoreCounter score={1234} size="lg" />
        <span className="text-xs text-white/40">Large</span>
      </div>
    </div>
  ),
}

/**
 * Without label for minimal display
 */
export const NoLabel: Story = {
  args: {
    score: 5000,
    label: '',
    size: 'lg',
  },
}
