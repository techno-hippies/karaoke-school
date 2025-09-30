import type { Meta, StoryObj } from '@storybook/react'
import { useState, useEffect } from 'react'
import { Progress } from './progress'

const meta: Meta<typeof Progress> = {
  title: 'UI/Progress',
  component: Progress,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#171717' }, // neutral-900
        { name: 'light', value: '#ffffff' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Progress>

// Basic States
export const Empty: Story = {
  args: {
    value: 0,
  },
}

export const Quarter: Story = {
  args: {
    value: 25,
  },
}

export const Half: Story = {
  args: {
    value: 50,
  },
}

export const ThreeQuarters: Story = {
  args: {
    value: 75,
  },
}

export const Complete: Story = {
  args: {
    value: 100,
  },
}

// Custom Styling
export const CustomHeight: Story = {
  args: {
    value: 60,
    className: 'h-4',
  },
}

export const CustomColor: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-neutral-400 mb-2">Success (Green)</p>
        <Progress
          value={75}
          className="[&>div]:bg-green-500"
        />
      </div>
      <div>
        <p className="text-sm text-neutral-400 mb-2">Warning (Yellow)</p>
        <Progress
          value={50}
          className="[&>div]:bg-yellow-500"
        />
      </div>
      <div>
        <p className="text-sm text-neutral-400 mb-2">Danger (Red)</p>
        <Progress
          value={25}
          className="[&>div]:bg-red-500"
        />
      </div>
    </div>
  ),
}

// Study Page Context
export const StudyProgress: Story = {
  render: () => {
    const totalExercises = 10
    const [completed, setCompleted] = useState(3)
    const progress = (completed / totalExercises) * 100

    return (
      <div className="w-full space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-400">
            {completed} of {totalExercises} exercises
          </span>
          <span className="text-white font-medium">
            {Math.round(progress)}%
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setCompleted(Math.max(0, completed - 1))}
            disabled={completed === 0}
            className="px-3 py-1 bg-neutral-700 text-white rounded disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setCompleted(Math.min(totalExercises, completed + 1))}
            disabled={completed === totalExercises}
            className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Next Exercise
          </button>
        </div>
      </div>
    )
  },
}

// Animated Progress
export const AnimatedProgress: Story = {
  render: () => {
    const [progress, setProgress] = useState(0)

    useEffect(() => {
      const timer = setTimeout(() => setProgress(66), 500)
      return () => clearTimeout(timer)
    }, [])

    return (
      <div className="space-y-2">
        <p className="text-sm text-neutral-400">
          Progress animates smoothly from 0 to 66%
        </p>
        <Progress value={progress} className="w-full" />
      </div>
    )
  },
}

// Loading States
export const LoadingSimulation: Story = {
  render: () => {
    const [progress, setProgress] = useState(0)
    const [isLoading, setIsLoading] = useState(false)

    const startLoading = () => {
      setIsLoading(true)
      setProgress(0)

      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval)
            setIsLoading(false)
            return 100
          }
          return prev + 10
        })
      }, 300)
    }

    return (
      <div className="space-y-4">
        <Progress value={progress} className="h-2" />
        <div className="text-center">
          <p className="text-sm text-neutral-400 mb-3">
            {isLoading ? `Loading... ${progress}%` : progress === 100 ? 'Complete!' : 'Ready'}
          </p>
          <button
            onClick={startLoading}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : progress === 100 ? 'Reload' : 'Start'}
          </button>
        </div>
      </div>
    )
  },
}

// Multiple Progress Bars
export const MultipleProgressBars: Story = {
  render: () => (
    <div className="space-y-6 w-full">
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-neutral-300">Vocabulary</span>
          <span className="text-sm text-neutral-500">12/20</span>
        </div>
        <Progress value={60} className="h-2" />
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-neutral-300">Grammar</span>
          <span className="text-sm text-neutral-500">8/15</span>
        </div>
        <Progress value={53} className="h-2" />
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-neutral-300">Pronunciation</span>
          <span className="text-sm text-neutral-500">5/10</span>
        </div>
        <Progress value={50} className="h-2" />
      </div>
    </div>
  ),
}

// Header Context (as it would appear in study page)
export const InHeaderContext: Story = {
  render: () => (
    <div className="w-[640px] bg-neutral-900 border-b border-neutral-700 p-6">
      <div className="flex items-center gap-4">
        {/* Close button */}
        <button className="text-neutral-400 hover:text-white">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Progress bar */}
        <div className="flex-1">
          <Progress value={45} className="h-2" />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
}
