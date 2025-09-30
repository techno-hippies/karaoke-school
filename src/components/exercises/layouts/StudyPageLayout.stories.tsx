import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { ExerciseHeader } from './ExerciseHeader'
import { AnimatedFooter } from '../AnimatedFooter'
import { VoiceControls } from '../VoiceControls'
import { NavigationControls } from '../NavigationControls'
import { SayItBackExercise } from '../SayItBackExercise'

const meta: Meta = {
  title: 'Exercises/Layouts/StudyPageLayout',
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0a0a0a' },
      ],
    },
  },
}

export default meta
type Story = StoryObj

// Complete Study Page - Default Story
export const Default: Story = {
  render: () => {
    const [progress, setProgress] = useState(30)
    const [isRecording, setIsRecording] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [transcript, setTranscript] = useState<string>()
    const [score, setScore] = useState<number | null>(null)
    const [attempts, setAttempts] = useState(0)

    const handleStartRecording = () => {
      setIsRecording(true)
      // Clear previous results when starting a new attempt
      if (transcript) {
        setAttempts(prev => prev + 1)
      }
      setTranscript(undefined)
      setScore(null)
    }

    const handleStopRecording = () => {
      setIsRecording(false)
      setIsProcessing(true)

      // Simulate transcription
      setTimeout(() => {
        const mockTranscripts = [
          { text: 'Hello, how are you today?', score: 95 },
          { text: 'Hello, how are you?', score: 75 },
          { text: 'Hello today', score: 45 },
        ]
        const result = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)]

        setTranscript(result.text)
        setScore(result.score)
        setIsProcessing(false)
      }, 2000)
    }

    const handleNext = () => {
      setProgress(prev => Math.min(prev + 10, 100))
      setTranscript(undefined)
      setScore(null)
      setAttempts(0)
    }

    const showResults = transcript !== undefined
    const isCorrect = score !== null && score >= 70

    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col">
        {/* Fixed Header with Progress */}
        <ExerciseHeader
          progress={progress}
          onClose={() => console.log('Close study session')}
        />

        {/* Main Content Area */}
        <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto w-full">
          <SayItBackExercise
            expectedText="Hello, how are you today?"
            transcript={transcript}
            score={score}
            isRecording={isRecording}
            isProcessing={isProcessing}
            canRecord={true}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
          />
        </div>

        {/* Fixed Animated Footer */}
        <AnimatedFooter show={true}>
          {showResults && isCorrect ? (
            <NavigationControls
              onNext={handleNext}
              onReport={(reason) => console.log('Reported:', reason)}
              exerciseKey="example-exercise"
            />
          ) : (
            <VoiceControls
              isRecording={isRecording}
              isProcessing={isProcessing}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              label={attempts > 0 ? 'Try Again' : 'Record'}
            />
          )}
        </AnimatedFooter>
      </div>
    )
  },
}

// Interactive Multi-Exercise Session
export const MultipleExercises: Story = {
  render: () => {
    const exercises = [
      'Hello, how are you today?',
      'What is your name?',
      'Where do you live?',
      'I like to learn new languages',
      'The weather is nice today',
    ]

    const [currentIndex, setCurrentIndex] = useState(0)
    const [isRecording, setIsRecording] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [transcript, setTranscript] = useState<string>()
    const [score, setScore] = useState<number | null>(null)

    const progress = ((currentIndex + 1) / exercises.length) * 100
    const currentExercise = exercises[currentIndex]

    const handleStopRecording = () => {
      setIsRecording(false)
      setIsProcessing(true)

      setTimeout(() => {
        // Simulate variable results
        const randomScore = Math.floor(Math.random() * 100)
        setTranscript(currentExercise) // Mock transcript
        setScore(randomScore)
        setIsProcessing(false)
      }, 2000)
    }

    const handleNext = () => {
      if (currentIndex < exercises.length - 1) {
        setCurrentIndex(prev => prev + 1)
        setTranscript(undefined)
        setScore(null)
      }
    }

    const showResults = transcript !== undefined
    const isCorrect = score !== null && score >= 70
    const isLastExercise = currentIndex === exercises.length - 1

    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col">
        {/* Header */}
        <ExerciseHeader
          progress={progress}
          onClose={() => console.log('Close')}
        />

        {/* Content */}
        <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto w-full">
          <div className="space-y-6">
            <SayItBackExercise
              key={currentIndex}
              expectedText={currentExercise}
              transcript={transcript}
              score={score}
              isRecording={isRecording}
              isProcessing={isProcessing}
              canRecord={true}
              onStartRecording={() => setIsRecording(true)}
              onStopRecording={handleStopRecording}
            />
          </div>
        </div>

        {/* Footer */}
        <AnimatedFooter show={true}>
          {showResults && isCorrect ? (
            <NavigationControls
              onNext={handleNext}
              label={isLastExercise ? 'Finish' : 'Next'}
              disabled={isLastExercise}
            />
          ) : (
            <VoiceControls
              isRecording={isRecording}
              isProcessing={isProcessing}
              onStartRecording={() => setIsRecording(true)}
              onStopRecording={handleStopRecording}
            />
          )}
        </AnimatedFooter>
      </div>
    )
  },
}

// Show Correct Answer Flow
export const CorrectAnswerFlow: Story = {
  render: () => {
    const [transcript] = useState<string>('Hello, how are you today?')
    const [score] = useState<number>(95) // Correct score
    const [progress, setProgress] = useState(30)

    const handleNext = () => {
      setProgress(prev => Math.min(prev + 10, 100))
      console.log('Next exercise')
    }

    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col">
        <ExerciseHeader progress={progress} onClose={() => console.log('Close')} />

        <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto w-full">
          <SayItBackExercise
            expectedText="Hello, how are you today?"
            transcript={transcript}
            score={score}
            canRecord={true}
            onStartRecording={() => {}}
            onStopRecording={() => {}}
          />
        </div>

        <AnimatedFooter show={true}>
          <NavigationControls
            onNext={handleNext}
            onReport={(reason) => console.log('Reported:', reason)}
            exerciseKey="example-exercise"
          />
        </AnimatedFooter>
      </div>
    )
  },
}

// Show Incorrect Answer Flow
export const IncorrectAnswerFlow: Story = {
  render: () => {
    const [isRecording, setIsRecording] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [transcript, setTranscript] = useState<string>('Hello today')
    const [score, setScore] = useState<number>(40) // Incorrect score
    const [attempts, setAttempts] = useState(1)

    const handleRetry = () => {
      setTranscript(undefined)
      setScore(null)
      setAttempts(prev => prev + 1)
    }

    const showResults = transcript !== undefined

    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col">
        <ExerciseHeader progress={30} onClose={() => console.log('Close')} />

        <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto w-full">
          <SayItBackExercise
            expectedText="Hello, how are you today?"
            transcript={transcript}
            score={score}
            attempts={attempts}
            isRecording={isRecording}
            isProcessing={isProcessing}
            canRecord={true}
            onStartRecording={() => setIsRecording(true)}
            onStopRecording={() => {
              setIsRecording(false)
              // Show incorrect result again
            }}
          />
        </div>

        <AnimatedFooter show={true}>
          <VoiceControls
            isRecording={isRecording}
            isProcessing={isProcessing}
            onStartRecording={() => {
              setIsRecording(true)
              handleRetry()
            }}
            onStopRecording={() => {
              setIsRecording(false)
              setIsProcessing(true)
            }}
            label="Try Again"
          />
        </AnimatedFooter>
      </div>
    )
  },
}

// Mobile View
export const MobileView: Story = {
  render: () => {
    const [isRecording, setIsRecording] = useState(false)

    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col w-[375px]">
        <ExerciseHeader progress={50} onClose={() => console.log('Close')} />

        <div className="flex-1 pt-24 pb-32 px-6 max-w-2xl mx-auto w-full">
          <SayItBackExercise
            expectedText="Hello, how are you?"
            isRecording={isRecording}
            canRecord={true}
            onStartRecording={() => setIsRecording(true)}
            onStopRecording={() => setIsRecording(false)}
          />
        </div>

        <AnimatedFooter show={true}>
          <VoiceControls
            isRecording={isRecording}
            onStartRecording={() => setIsRecording(true)}
            onStopRecording={() => setIsRecording(false)}
          />
        </AnimatedFooter>
      </div>
    )
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}
