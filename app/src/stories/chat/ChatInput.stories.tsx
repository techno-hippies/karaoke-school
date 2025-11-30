import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, useEffect, useRef } from 'react'
import { ChatInput } from '@/components/chat/ChatInput'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'

const meta = {
  title: 'Chat/ChatInput',
  component: ChatInput,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="h-screen flex flex-col">
        <div className="flex-1 bg-background" />
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChatInput>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default - empty shows voice/waveform icon
 */
export const Default: Story = {
  args: {
    onSend: (msg) => console.log('Sent:', msg),
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
    placeholder: 'Type a message...',
  },
}

/**
 * Recording state - shows recording UI with timer and waveform
 */
export const Recording: Story = {
  args: {
    onSend: (msg) => console.log('Sent:', msg),
    onStopRecording: () => console.log('Stop recording'),
    isRecording: true,
    recordingDuration: 5,
  },
}

/**
 * Processing state - shows transcribing spinner
 */
export const Processing: Story = {
  args: {
    isProcessing: true,
  },
}

/**
 * Disabled state
 */
export const Disabled: Story = {
  args: {
    onSend: (msg) => console.log('Sent:', msg),
    disabled: true,
  },
}

/**
 * Custom placeholder
 */
export const CustomPlaceholder: Story = {
  args: {
    onSend: (msg) => console.log('Sent:', msg),
    onStartRecording: () => console.log('Start recording'),
    placeholder: 'Ask me anything about English...',
  },
}

/**
 * Interactive recording demo - click mic to record, click stop to finish
 */
function InteractiveRecordingDemo() {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder()
  const [duration, setDuration] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastRecording, setLastRecording] = useState<{ size: number; base64Length: number } | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Duration timer
  useEffect(() => {
    if (isRecording) {
      setDuration(0)
      intervalRef.current = setInterval(() => {
        setDuration((d) => d + 1)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRecording])

  const handleStartRecording = async () => {
    console.log('Starting recording...')
    await startRecording()
  }

  const handleStopRecording = async () => {
    console.log('Stopping recording...')
    setIsProcessing(true)

    try {
      const result = await stopRecording()
      if (result) {
        console.log('Recording result:', {
          blobSize: result.blob.size,
          base64Length: result.base64.length,
        })
        setLastRecording({
          size: result.blob.size,
          base64Length: result.base64.length,
        })
      }
    } catch (err) {
      console.error('Recording error:', err)
    } finally {
      // Simulate transcription delay
      setTimeout(() => {
        setIsProcessing(false)
      }, 1500)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Info panel */}
      <div className="flex-1 bg-background p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-lg font-semibold">Interactive Recording Demo</h2>
          <p className="text-sm text-muted-foreground">
            Click the mic button to start recording, then click stop when done.
            The recording will be converted to base64 for STT processing.
          </p>

          {lastRecording && (
            <div className="p-4 rounded-lg bg-secondary">
              <h3 className="text-sm font-medium mb-2">Last Recording:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Blob size: {(lastRecording.size / 1024).toFixed(2)} KB</li>
                <li>Base64 length: {lastRecording.base64Length.toLocaleString()} chars</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Chat input */}
      <ChatInput
        onSend={(msg) => console.log('Sent:', msg)}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        isRecording={isRecording}
        recordingDuration={duration}
        isProcessing={isProcessing}
      />
    </div>
  )
}

export const InteractiveRecording: Story = {
  render: () => <InteractiveRecordingDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Interactive demo with real microphone recording. Click mic to start, stop to finish.',
      },
    },
  },
}

/**
 * Mobile viewport - tests keyboard handling
 */
export const Mobile: Story = {
  args: {
    onSend: (msg) => console.log('Sent:', msg),
    onStartRecording: () => console.log('Start recording'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

/**
 * Mobile Recording - recording UI on mobile viewport
 */
export const MobileRecording: Story = {
  args: {
    isRecording: true,
    recordingDuration: 12,
    onStopRecording: () => console.log('Stop'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}
