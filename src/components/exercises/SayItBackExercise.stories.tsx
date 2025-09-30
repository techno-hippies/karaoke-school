import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { SayItBackExercise } from './SayItBackExercise'

const meta: Meta<typeof SayItBackExercise> = {
  title: 'Exercises/SayItBackExercise',
  component: SayItBackExercise,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0a0a0a' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SayItBackExercise>

// Basic States
export const Default: Story = {
  args: {
    expectedText: 'Hello, how are you?',
    canRecord: true,
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}

export const Recording: Story = {
  args: {
    expectedText: 'Hello, how are you?',
    isRecording: true,
    canRecord: true,
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}

export const Processing: Story = {
  args: {
    expectedText: 'Hello, how are you?',
    isProcessing: true,
    canRecord: true,
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}

export const NotReady: Story = {
  args: {
    expectedText: 'Hello, how are you?',
    canRecord: false,
    statusMessage: 'Connecting to speech recognition...',
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}

// Result States
export const CorrectAnswer: Story = {
  args: {
    expectedText: 'Good morning',
    transcript: 'Good morning',
    score: 100,
    canRecord: true,
  },
}

export const PartiallyCorrect: Story = {
  args: {
    expectedText: 'Hello how are you',
    transcript: 'Hello how you',
    score: 75,
    canRecord: true,
  },
}

export const Incorrect: Story = {
  args: {
    expectedText: 'Good morning',
    transcript: 'Good evening',
    score: 50,
    attempts: 1,
    canRecord: true,
  },
}

export const VeryIncorrect: Story = {
  args: {
    expectedText: 'Hello how are you',
    transcript: 'Goodbye',
    score: 0,
    attempts: 2,
    canRecord: true,
  },
}

// Interactive Flow
export const InteractiveFlow: Story = {
  render: () => {
    const [isRecording, setIsRecording] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [transcript, setTranscript] = useState<string>()
    const [score, setScore] = useState<number | null>(null)
    const [attempts, setAttempts] = useState(0)

    const handleStartRecording = () => {
      setIsRecording(true)
      // Clear previous results
      setTranscript(undefined)
      setScore(null)
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

    const handleReset = () => {
      setTranscript(undefined)
      setScore(null)
      setAttempts(0)
    }

    return (
      <div className="space-y-6">
        <SayItBackExercise
          expectedText="Hello, how are you today?"
          transcript={transcript}
          score={score}
          attempts={attempts}
          isRecording={isRecording}
          isProcessing={isProcessing}
          canRecord={true}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
        />

        {transcript && (
          <button
            onClick={handleReset}
            className="w-full px-6 py-3 bg-neutral-700 text-white rounded-lg hover:bg-neutral-600"
          >
            Reset Exercise
          </button>
        )}
      </div>
    )
  },
}

// Different Difficulty Levels
export const ShortPhrase: Story = {
  args: {
    expectedText: 'Hello',
    canRecord: true,
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}

export const MediumPhrase: Story = {
  args: {
    expectedText: 'Good morning, how are you?',
    canRecord: true,
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}

export const LongPhrase: Story = {
  args: {
    expectedText: 'Could you please tell me how to get to the nearest subway station from here?',
    canRecord: true,
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}

// Full Page Context
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
            isRecording={isRecording}
            isProcessing={isProcessing}
            canRecord={true}
            onStartRecording={() => setIsRecording(true)}
            onStopRecording={handleStopRecording}
          />
        </div>

        {/* Footer */}
        {score && score >= 70 && (
          <div className="fixed bottom-0 left-0 right-0 bg-neutral-800 border-t border-neutral-700">
            <div className="max-w-2xl mx-auto px-6 py-4">
              <button className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Next Exercise
              </button>
            </div>
          </div>
        )}
      </div>
    )
  },
  parameters: {
    layout: 'fullscreen',
  },
}

// Multi-language Examples
export const SpanishPhrase: Story = {
  args: {
    expectedText: 'Buenos días, ¿cómo estás?',
    canRecord: true,
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}

export const FrenchPhrase: Story = {
  args: {
    expectedText: 'Bonjour, comment allez-vous?',
    canRecord: true,
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}

// Edge Cases
export const WithSpecialCharacters: Story = {
  args: {
    expectedText: "It's a beautiful day, isn't it?",
    canRecord: true,
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}

export const WithNumbers: Story = {
  args: {
    expectedText: 'I have 3 apples and 2 oranges',
    canRecord: true,
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}
