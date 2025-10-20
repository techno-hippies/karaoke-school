import type { Meta, StoryObj } from '@storybook/react'
import { VoiceControls } from '@/components/exercises/VoiceControls'
import { useState } from 'react'

const meta: Meta<typeof VoiceControls> = {
  title: 'Exercises/VoiceControls',
  component: VoiceControls,
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
      <div className="w-full max-w-2xl mx-auto">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof VoiceControls>

/**
 * Default idle state with "Record" label
 */
export const Idle: Story = {
  args: {
    isRecording: false,
    isProcessing: false,
    label: 'Record',
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}

/**
 * Recording in progress - shows pulsing red "Stop" button
 */
export const Recording: Story = {
  args: {
    isRecording: true,
    isProcessing: false,
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}

/**
 * Processing/transcribing - shows disabled button with spinner
 */
export const Processing: Story = {
  args: {
    isRecording: false,
    isProcessing: true,
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}

/**
 * Custom label for retry attempts
 */
export const TryAgain: Story = {
  args: {
    isRecording: false,
    isProcessing: false,
    label: 'Try Again',
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}

/**
 * Interactive demo showing state transitions
 */
export const Interactive: Story = {
  render: () => {
    const [isRecording, setIsRecording] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)

    const handleStartRecording = () => {
      setIsRecording(true)
    }

    const handleStopRecording = () => {
      setIsRecording(false)
      setIsProcessing(true)

      // Simulate processing
      setTimeout(() => {
        setIsProcessing(false)
      }, 2000)
    }

    return (
      <div className="space-y-6">
        <VoiceControls
          isRecording={isRecording}
          isProcessing={isProcessing}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
        />

        <div className="text-center text-muted-foreground text-sm">
          {isProcessing && 'Processing audio...'}
          {isRecording && 'Recording... Click stop when done'}
          {!isRecording && !isProcessing && 'Click to start recording'}
        </div>
      </div>
    )
  },
}

/**
 * In exercise context (with padding)
 */
export const InExerciseContext: Story = {
  render: () => (
    <div className="min-h-[400px] flex flex-col bg-background">
      {/* Exercise content */}
      <div className="flex-1 p-6">
        <div className="space-y-3">
          <div className="text-muted-foreground text-base font-medium">
            Say it back:
          </div>
          <div className="text-xl font-medium text-foreground leading-relaxed">
            Hello, how are you?
          </div>
        </div>
      </div>

      {/* Voice controls at bottom */}
      <div className="p-6 border-t border-border bg-secondary/20">
        <VoiceControls
          label="Record"
          onStartRecording={() => console.log('Start recording')}
          onStopRecording={() => console.log('Stop recording')}
        />
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
}
