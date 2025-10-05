import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { SayItBackExercise } from './SayItBackExercise'
import { ExerciseFooter } from './ExerciseFooter'

const meta: Meta<typeof SayItBackExercise> = {
  title: 'Exercises/SayItBackExercise',
  component: SayItBackExercise,
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
type Story = StoryObj<typeof SayItBackExercise>

// Basic States - Ready to Record
export const ReadyToRecord: Story = {
  render: () => {
    const [isRecording, setIsRecording] = useState(false)

    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col">
        <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto">
          <SayItBackExercise expectedText="Hello, how are you?" />
        </div>

        <ExerciseFooter
          controls={{
            type: 'voice',
            isRecording,
            onStartRecording: () => setIsRecording(true),
            onStopRecording: () => setIsRecording(false),
          }}
        />
      </div>
    )
  },
}

export const Recording: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto">
        <SayItBackExercise expectedText="Hello, how are you?" />
      </div>

      <ExerciseFooter
        controls={{
          type: 'voice',
          isRecording: true,
          onStartRecording: () => console.log('Start'),
          onStopRecording: () => console.log('Stop'),
        }}
      />
    </div>
  ),
}

export const Processing: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto">
        <SayItBackExercise expectedText="Hello, how are you?" />
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

// Result States
export const CorrectAnswer: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto">
        <SayItBackExercise
          expectedText="Good morning"
          score={100}
        />
      </div>

      <ExerciseFooter
        feedback={{ isCorrect: true }}
        controls={{
          type: 'navigation',
          onNext: () => console.log('Next exercise'),
          onReport: (reason) => console.log('Reported:', reason),
          exerciseKey: 'say-it-back-001',
        }}
      />
    </div>
  ),
}

export const PartiallyCorrect: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto">
        <SayItBackExercise
          expectedText="Hello how are you"
          score={75}
        />
      </div>

      <ExerciseFooter
        feedback={{ isCorrect: true }}
        controls={{
          type: 'navigation',
          onNext: () => console.log('Next exercise'),
          onReport: (reason) => console.log('Reported:', reason),
          exerciseKey: 'say-it-back-002',
        }}
      />
    </div>
  ),
}

export const IncorrectFirstAttempt: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto">
        <SayItBackExercise
          expectedText="Good morning"
          transcript="Good evening"
          score={50}
          attempts={1}
        />
      </div>

      <ExerciseFooter
        feedback={{ isCorrect: false }}
        controls={{
          type: 'voice',
          onStartRecording: () => console.log('Try again'),
          onStopRecording: () => console.log('Stop'),
        }}
      />
    </div>
  ),
}

export const IncorrectSecondAttempt: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto">
        <SayItBackExercise
          expectedText="Hello how are you"
          transcript="Goodbye"
          score={0}
          attempts={2}
        />
      </div>

      <ExerciseFooter
        feedback={{ isCorrect: false }}
        controls={{
          type: 'navigation',
          onNext: () => console.log('Move on to next'),
          onReport: (reason) => console.log('Reported:', reason),
          exerciseKey: 'say-it-back-003',
        }}
      />
    </div>
  ),
}

// Interactive Flow (demonstrates 2-attempt flow)
export const InteractiveFlow: Story = {
  render: () => {
    const [isRecording, setIsRecording] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [transcript, setTranscript] = useState<string>()
    const [score, setScore] = useState<number | null>(null)
    const [attempts, setAttempts] = useState(0)

    const handleStartRecording = () => {
      setIsRecording(true)
      // Clear previous results if starting fresh
      if (score !== null && score >= 70) {
        setTranscript(undefined)
        setScore(null)
        setAttempts(0)
      }
    }

    const handleStopRecording = () => {
      setIsRecording(false)
      setIsProcessing(true)

      // Simulate API call
      setTimeout(() => {
        // Simulate random transcription
        const transcriptions = [
          { text: 'Hello how are you today', score: 100 },
          { text: 'Hello how are you', score: 75 },
          { text: 'Hello today', score: 50 },
          { text: 'Goodbye', score: 0 },
        ]
        const result = transcriptions[Math.floor(Math.random() * transcriptions.length)]

        setTranscript(result.text)
        setScore(result.score)
        setAttempts(prev => prev + 1)
        setIsProcessing(false)
      }, 2000)
    }

    const handleNext = () => {
      // Reset for next exercise
      setTranscript(undefined)
      setScore(null)
      setAttempts(0)
    }

    const isCorrect = score !== null && score >= 70
    const showFeedback = score !== null
    const canRetry = attempts < 2 && !isCorrect

    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col">
        <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto">
          <SayItBackExercise
            expectedText="Hello, how are you today?"
            transcript={transcript}
            score={score}
            attempts={attempts}
          />
        </div>

        <ExerciseFooter
          feedback={showFeedback ? { isCorrect } : undefined}
          controls={
            isCorrect || attempts >= 2
              ? {
                  type: 'navigation',
                  onNext: handleNext,
                  onReport: (reason) => console.log('Reported:', reason),
                  exerciseKey: 'interactive-demo',
                }
              : {
                  type: 'voice',
                  isRecording,
                  isProcessing,
                  onStartRecording: handleStartRecording,
                  onStopRecording: handleStopRecording,
                }
          }
        />
      </div>
    )
  },
}

// Different Difficulty Levels
export const ShortPhrase: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto">
        <SayItBackExercise expectedText="Hello" />
      </div>

      <ExerciseFooter
        controls={{
          type: 'voice',
          onStartRecording: () => console.log('Start'),
          onStopRecording: () => console.log('Stop'),
        }}
      />
    </div>
  ),
}

export const MediumPhrase: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto">
        <SayItBackExercise expectedText="Good morning, how are you?" />
      </div>

      <ExerciseFooter
        controls={{
          type: 'voice',
          onStartRecording: () => console.log('Start'),
          onStopRecording: () => console.log('Stop'),
        }}
      />
    </div>
  ),
}

export const LongPhrase: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto">
        <SayItBackExercise expectedText="Could you please tell me how to get to the nearest subway station from here?" />
      </div>

      <ExerciseFooter
        controls={{
          type: 'voice',
          onStartRecording: () => console.log('Start'),
          onStopRecording: () => console.log('Stop'),
        }}
      />
    </div>
  ),
}

// Full Page Context with Header
export const InStudyPageContext: Story = {
  render: () => {
    const [isRecording, setIsRecording] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [transcript, setTranscript] = useState<string>()
    const [score, setScore] = useState<number | null>(null)

    const handleStopRecording = () => {
      setIsRecording(false)
      setIsProcessing(true)
      setTimeout(() => {
        setTranscript('Hello how are you')
        setScore(75)
        setIsProcessing(false)
      }, 2000)
    }

    const handleNext = () => {
      setTranscript(undefined)
      setScore(null)
    }

    const isCorrect = score !== null && score >= 70

    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col">
        {/* Header */}
        <div className="fixed top-0 left-0 right-0 z-10 bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-700">
          <div className="w-full max-w-2xl mx-auto px-6 py-4">
            <div className="text-neutral-400 text-sm">
              Exercise 1 of 10
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto">
          <SayItBackExercise
            expectedText="Hello, how are you?"
            transcript={transcript}
            score={score}
          />
        </div>

        {/* Footer */}
        <ExerciseFooter
          feedback={score !== null ? { isCorrect } : undefined}
          controls={
            isCorrect
              ? {
                  type: 'navigation',
                  onNext: handleNext,
                  onReport: (reason) => console.log('Reported:', reason),
                  exerciseKey: 'study-page-demo',
                }
              : {
                  type: 'voice',
                  isRecording,
                  isProcessing,
                  onStartRecording: () => setIsRecording(true),
                  onStopRecording: handleStopRecording,
                }
          }
        />
      </div>
    )
  },
}

// Multi-language Examples
export const SpanishPhrase: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto">
        <SayItBackExercise expectedText="Buenos días, ¿cómo estás?" />
      </div>

      <ExerciseFooter
        controls={{
          type: 'voice',
          onStartRecording: () => console.log('Start'),
          onStopRecording: () => console.log('Stop'),
        }}
      />
    </div>
  ),
}

export const FrenchPhrase: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto">
        <SayItBackExercise expectedText="Bonjour, comment allez-vous?" />
      </div>

      <ExerciseFooter
        controls={{
          type: 'voice',
          onStartRecording: () => console.log('Start'),
          onStopRecording: () => console.log('Stop'),
        }}
      />
    </div>
  ),
}

// Edge Cases
export const WithSpecialCharacters: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto">
        <SayItBackExercise expectedText="It's a beautiful day, isn't it?" />
      </div>

      <ExerciseFooter
        controls={{
          type: 'voice',
          onStartRecording: () => console.log('Start'),
          onStopRecording: () => console.log('Stop'),
        }}
      />
    </div>
  ),
}

export const WithNumbers: Story = {
  render: () => (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto">
        <SayItBackExercise expectedText="I have 3 apples and 2 oranges" />
      </div>

      <ExerciseFooter
        controls={{
          type: 'voice',
          onStartRecording: () => console.log('Start'),
          onStopRecording: () => console.log('Stop'),
        }}
      />
    </div>
  ),
}
