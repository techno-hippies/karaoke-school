import type { Meta, StoryObj } from '@storybook/react'
import { SayItBackExercise } from '@/components/exercises/SayItBackExercise'

const meta: Meta<typeof SayItBackExercise> = {
  title: 'Exercises/SayItBackExercise',
  component: SayItBackExercise,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl mx-auto">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SayItBackExercise>

export const NotStarted: Story = {
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
