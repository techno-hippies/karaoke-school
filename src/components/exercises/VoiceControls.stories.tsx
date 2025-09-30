import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { VoiceControls } from './VoiceControls'

const meta: Meta<typeof VoiceControls> = {
  title: 'Exercises/VoiceControls',
  component: VoiceControls,
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
      <div className="w-full max-w-md p-6">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof VoiceControls>

// Basic States
export const Idle: Story = {
  args: {
    isRecording: false,
    isProcessing: false,
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}

export const Recording: Story = {
  args: {
    isRecording: true,
    isProcessing: false,
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}

export const Processing: Story = {
  args: {
    isRecording: false,
    isProcessing: true,
  },
}

// Interactive Full Flow (auto-submits on stop)
export const InteractiveFullFlow: Story = {
  render: () => {
    const [isRecording, setIsRecording] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [result, setResult] = useState<string | null>(null)

    const handleStartRecording = () => {
      setIsRecording(true)
      setResult(null)
    }

    const handleStopRecording = () => {
      setIsRecording(false)
      setIsProcessing(true)
      // Auto-submit and simulate API call
      setTimeout(() => {
        setIsProcessing(false)
        setResult('Transcript: "Hello, how are you?" (85% match)')
      }, 2000)
    }

    const handleRetry = () => {
      setResult(null)
      setIsProcessing(false)
      setIsRecording(false)
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-2">
            Interactive Voice Recording Flow
          </h3>
          <p className="text-sm text-neutral-400">
            {isRecording && 'Recording... Click stop when done'}
            {!isRecording && !isProcessing && !result && 'Click to start recording'}
            {isProcessing && 'Processing your recording...'}
            {result && 'Processing complete!'}
          </p>
        </div>

        {!result ? (
          <VoiceControls
            isRecording={isRecording}
            isProcessing={isProcessing}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
          />
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-900/20 border border-green-600 rounded-lg">
              <p className="text-green-400 text-sm font-medium mb-1">Result:</p>
              <p className="text-green-300">{result}</p>
            </div>
            <button
              onClick={handleRetry}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    )
  },
}

// State Transitions
export const StateTransitions: Story = {
  render: () => {
    const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle')

    const getStateProps = () => {
      switch (state) {
        case 'idle':
          return {
            isRecording: false,
            isProcessing: false,
          }
        case 'recording':
          return {
            isRecording: true,
            isProcessing: false,
          }
        case 'processing':
          return {
            isRecording: false,
            isProcessing: true,
          }
      }
    }

    return (
      <div className="space-y-6">
        <div className="text-center space-y-3">
          <h3 className="text-lg font-semibold text-white">State Transitions Demo</h3>
          <p className="text-sm text-neutral-400">Current state: <span className="text-white font-mono">{state}</span></p>
        </div>

        <VoiceControls
          {...getStateProps()}
          onStartRecording={() => setState('recording')}
          onStopRecording={() => setState('processing')}
        />

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setState('idle')}
            className={`px-3 py-2 rounded text-sm ${
              state === 'idle' ? 'bg-blue-600 text-white' : 'bg-neutral-700 text-neutral-300'
            }`}
          >
            → Idle
          </button>
          <button
            onClick={() => setState('recording')}
            className={`px-3 py-2 rounded text-sm ${
              state === 'recording' ? 'bg-blue-600 text-white' : 'bg-neutral-700 text-neutral-300'
            }`}
          >
            → Recording
          </button>
          <button
            onClick={() => setState('processing')}
            className={`px-3 py-2 rounded text-sm ${
              state === 'processing' ? 'bg-blue-600 text-white' : 'bg-neutral-700 text-neutral-300'
            }`}
          >
            → Processing
          </button>
        </div>
      </div>
    )
  },
}

// In Exercise Context
export const InExerciseContext: Story = {
  render: () => {
    const [isRecording, setIsRecording] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)

    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col">
        {/* Exercise content */}
        <div className="flex-1 px-6 py-8 max-w-2xl mx-auto">
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-neutral-400 text-sm mb-2">Say it back:</p>
              <h2 className="text-2xl font-medium text-white">
                Hello, how are you today?
              </h2>
            </div>

            <div className="p-6 bg-neutral-800 rounded-lg">
              <p className="text-neutral-400 text-sm">
                Record yourself saying the phrase above. Try to match the pronunciation as closely as possible.
              </p>
            </div>
          </div>
        </div>

        {/* Footer with controls */}
        <div className="fixed bottom-0 left-0 right-0 bg-neutral-800 border-t border-neutral-700">
          <div className="max-w-2xl mx-auto px-6 py-4">
            <VoiceControls
              isRecording={isRecording}
              isProcessing={isProcessing}
              onStartRecording={() => setIsRecording(true)}
              onStopRecording={() => {
                setIsRecording(false)
                setIsProcessing(true)
                setTimeout(() => {
                  setIsProcessing(false)
                  alert('Processing complete! 85% match')
                }, 2000)
              }}
            />
          </div>
        </div>
      </div>
    )
  },
  parameters: {
    layout: 'fullscreen',
  },
}

// Mobile View
export const MobileView: Story = {
  render: () => (
    <div className="w-[375px] p-4">
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-white font-medium mb-2">Mobile View</h3>
          <p className="text-sm text-neutral-400">Big circular button scales well</p>
        </div>
        <VoiceControls
          isRecording={false}
          isProcessing={false}
          onStartRecording={() => console.log('Start')}
          onStopRecording={() => console.log('Stop')}
        />
      </div>
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}
