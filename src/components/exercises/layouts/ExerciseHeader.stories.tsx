import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { ExerciseHeader } from './ExerciseHeader'

const meta: Meta<typeof ExerciseHeader> = {
  title: 'Exercises/Layouts/ExerciseHeader',
  component: ExerciseHeader,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#171717' }, // neutral-900
      ],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    progress: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description: 'Progress percentage (0-100)',
    },
    onClose: { action: 'closed' },
  },
}

export default meta
type Story = StoryObj<typeof ExerciseHeader>

// Basic States
export const Empty: Story = {
  args: {
    progress: 0,
    onClose: () => console.log('Close clicked'),
  },
}

export const Started: Story = {
  args: {
    progress: 15,
    onClose: () => console.log('Close clicked'),
  },
}

export const HalfComplete: Story = {
  args: {
    progress: 50,
    onClose: () => console.log('Close clicked'),
  },
}

export const AlmostDone: Story = {
  args: {
    progress: 85,
    onClose: () => console.log('Close clicked'),
  },
}

export const Complete: Story = {
  args: {
    progress: 100,
    onClose: () => console.log('Close clicked'),
  },
}

// Without Close Button
export const NoCloseButton: Story = {
  args: {
    progress: 50,
    showCloseButton: false,
    onClose: () => console.log('Close clicked'),
  },
}

// Interactive Demo
export const Interactive: Story = {
  render: () => {
    const [progress, setProgress] = useState(0)
    const [isVisible, setIsVisible] = useState(true)

    const handleNext = () => {
      if (progress < 100) {
        setProgress(prev => Math.min(100, prev + 10))
      }
    }

    const handleClose = () => {
      setIsVisible(false)
      setTimeout(() => setIsVisible(true), 1000)
    }

    return (
      <div className="min-h-screen bg-neutral-900">
        {isVisible && (
          <ExerciseHeader
            progress={progress}
            onClose={handleClose}
          />
        )}

        {/* Page content simulation */}
        <div className="pt-24 px-6 max-w-2xl mx-auto">
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold text-white">
                Interactive Exercise Header Demo
              </h1>
              <p className="text-neutral-400">
                Progress: {progress}% ({Math.round(progress / 10)}/10 exercises)
              </p>
            </div>

            <button
              onClick={handleNext}
              disabled={progress === 100}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-center"
            >
              Next Exercise
            </button>

            {/* Simulated exercise content */}
            <div className="mt-8 p-6 bg-neutral-800 rounded-lg">
              <p className="text-white text-lg mb-4">Sample Exercise Content</p>
              <p className="text-neutral-400">
                This demonstrates how the header appears above your exercise content.
                The header is fixed at the top and includes a progress bar showing
                your advancement through the exercise set.
              </p>
            </div>

            {!isVisible && (
              <div className="text-center text-yellow-400 animate-pulse">
                Header closed! Reappearing in 1 second...
              </div>
            )}
          </div>
        </div>
      </div>
    )
  },
}

// Study Session Context
export const StudySessionContext: Story = {
  render: () => {
    const [currentExercise, setCurrentExercise] = useState(1)
    const totalExercises = 10
    const progress = (currentExercise / totalExercises) * 100

    return (
      <div className="min-h-screen bg-neutral-900">
        <ExerciseHeader
          progress={progress}
          onClose={() => console.log('Close study session')}
        />

        {/* Exercise content */}
        <div className="pt-24 pb-32 px-6 max-w-2xl mx-auto">
          <div className="space-y-8">
            {/* Exercise card */}
            <div className="bg-neutral-800 rounded-xl p-8 border border-neutral-700">
              <div className="space-y-6">
                <div className="text-sm text-neutral-400">
                  Question {currentExercise} of {totalExercises}
                </div>

                <div className="space-y-4">
                  <h2 className="text-xl font-medium text-white">
                    What does "buenos días" mean in English?
                  </h2>

                  <div className="space-y-2">
                    {['Good morning', 'Good afternoon', 'Good night', 'Goodbye'].map((option, i) => (
                      <button
                        key={i}
                        className="w-full p-4 text-left bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <button
              onClick={() => setCurrentExercise(prev => Math.min(totalExercises, prev + 1))}
              disabled={currentExercise === totalExercises}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    )
  },
}

// Multiple Exercise Types
export const WithExerciseTypeIndicator: Story = {
  render: () => {
    const [exerciseType, setExerciseType] = useState<'vocabulary' | 'grammar' | 'pronunciation'>('vocabulary')
    const exercises = {
      vocabulary: { current: 3, total: 10 },
      grammar: { current: 5, total: 8 },
      pronunciation: { current: 2, total: 6 },
    }

    const current = exercises[exerciseType]
    const progress = (current.current / current.total) * 100

    return (
      <div className="min-h-screen bg-neutral-900">
        <ExerciseHeader
          progress={progress}
          onClose={() => console.log('Close')}
        />

        <div className="pt-24 px-6 max-w-2xl mx-auto">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white capitalize mb-2">
                {exerciseType} Exercises
              </h2>
              <p className="text-neutral-400">
                {current.current} of {current.total} completed
              </p>
            </div>

            {/* Exercise type selector */}
            <div className="flex gap-2 justify-center">
              {(['vocabulary', 'grammar', 'pronunciation'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setExerciseType(type)}
                  className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                    exerciseType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="p-6 bg-neutral-800 rounded-lg text-white">
              Sample {exerciseType} exercise content here...
            </div>
          </div>
        </div>
      </div>
    )
  },
}

// Responsive Behavior
export const ResponsiveDemo: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900">
      <ExerciseHeader
        progress={45}
        onClose={() => console.log('Close')}
      />

      <div className="pt-24 px-6 max-w-2xl mx-auto">
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">Responsive Behavior</h2>
          <p className="text-neutral-400">
            The header maintains max-width of 2xl (672px) and centers on larger screens.
            Try resizing your browser window to see how it adapts.
          </p>
          <div className="p-4 bg-neutral-800 rounded text-white">
            Content is constrained to the same max-width for visual consistency.
          </div>
        </div>
      </div>
    </div>
  ),
}

// Edge Cases
export const LongSession: Story = {
  render: () => {
    const [current, setCurrent] = useState(142)
    const total = 500
    const progress = (current / total) * 100

    return (
      <div className="min-h-screen bg-neutral-900">
        <ExerciseHeader
          progress={progress}
          onClose={() => console.log('Close')}
        />

        <div className="pt-24 px-6 max-w-2xl mx-auto">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-white">
              Marathon Study Session
            </h2>
            <p className="text-neutral-400">
              {current} of {total} exercises ({Math.round(progress)}%)
            </p>
            <button
              onClick={() => setCurrent(prev => Math.min(total, prev + 50))}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Skip 50 Exercises
            </button>
          </div>
        </div>
      </div>
    )
  },
}
