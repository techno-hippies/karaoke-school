import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { ExerciseFooter } from './ExerciseFooter'

const meta: Meta<typeof ExerciseFooter> = {
  title: 'Exercises/ExerciseFooter',
  component: ExerciseFooter,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0a0a0a' },
      ],
    },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof ExerciseFooter>

// Voice Controls (before answering)
export const WithVoiceControls: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-lg">Exercise content goes here</div>
      </div>

      <ExerciseFooter
        controls={{
          type: 'voice',
          onStartRecording: () => console.log('Start recording'),
          onStopRecording: () => console.log('Stop recording'),
        }}
      />
    </div>
  ),
}

export const Recording: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-lg">Exercise content goes here</div>
      </div>

      <ExerciseFooter
        controls={{
          type: 'voice',
          isRecording: true,
          onStartRecording: () => console.log('Start recording'),
          onStopRecording: () => console.log('Stop recording'),
        }}
      />
    </div>
  ),
}

export const Processing: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-lg">Exercise content goes here</div>
      </div>

      <ExerciseFooter
        controls={{
          type: 'voice',
          isProcessing: true,
        }}
      />
    </div>
  ),
}

// After answering - Correct
export const CorrectWithNavigation: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-lg">Exercise content goes here</div>
      </div>

      <ExerciseFooter
        feedback={{ isCorrect: true }}
        controls={{
          type: 'navigation',
          onNext: () => console.log('Next exercise'),
        }}
      />
    </div>
  ),
}

// After answering - Incorrect (with retry)
export const IncorrectWithRetry: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-lg">Exercise content goes here</div>
      </div>

      <ExerciseFooter
        feedback={{ isCorrect: false }}
        controls={{
          type: 'voice',
          onStartRecording: () => console.log('Try again'),
          onStopRecording: () => console.log('Stop recording'),
        }}
      />
    </div>
  ),
}

// After 2 failed attempts (move on)
export const IncorrectMoveOn: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-lg">Exercise content goes here</div>
      </div>

      <ExerciseFooter
        feedback={{ isCorrect: false }}
        controls={{
          type: 'navigation',
          onNext: () => console.log('Move to next exercise'),
        }}
      />
    </div>
  ),
}

// With Report Flag Button
export const WithReportButton: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-lg">Exercise content goes here</div>
      </div>

      <ExerciseFooter
        feedback={{ isCorrect: true }}
        controls={{
          type: 'navigation',
          onNext: () => console.log('Next exercise'),
          onReport: (reason) => console.log('Reported:', reason),
          exerciseKey: 'exercise-123',
        }}
      />
    </div>
  ),
}

// Interactive Demo
export const InteractiveDemo: Story = {
  render: () => {
    const [state, setState] = useState<'idle' | 'recording' | 'processing' | 'correct' | 'incorrect'>('idle')

    const handleStart = () => setState('recording')
    const handleStop = () => {
      setState('processing')
      setTimeout(() => {
        // Randomly show correct or incorrect
        setState(Math.random() > 0.5 ? 'correct' : 'incorrect')
      }, 1500)
    }
    const handleNext = () => setState('idle')

    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <div className="text-white text-2xl">Interactive Footer Demo</div>
            <div className="text-neutral-400">
              {state === 'idle' && 'Click Record to start'}
              {state === 'recording' && 'Recording... Click Stop'}
              {state === 'processing' && 'Processing your answer...'}
              {state === 'correct' && 'Great job!'}
              {state === 'incorrect' && 'Not quite right'}
            </div>
          </div>
        </div>

        <ExerciseFooter
          feedback={
            state === 'correct' || state === 'incorrect'
              ? { isCorrect: state === 'correct' }
              : undefined
          }
          controls={
            state === 'correct' || state === 'incorrect'
              ? {
                  type: 'navigation',
                  onNext: handleNext,
                  onReport: (reason) => console.log('Reported:', reason),
                  exerciseKey: 'demo-exercise',
                }
              : {
                  type: 'voice',
                  isRecording: state === 'recording',
                  isProcessing: state === 'processing',
                  onStartRecording: handleStart,
                  onStopRecording: handleStop,
                }
          }
        />
      </div>
    )
  },
}
