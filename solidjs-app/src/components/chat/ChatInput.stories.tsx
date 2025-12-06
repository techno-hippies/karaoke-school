import type { Meta, StoryObj } from 'storybook-solidjs'
import { ChatInput } from './ChatInput'

const meta: Meta<typeof ChatInput> = {
  title: 'Chat/ChatInput',
  component: ChatInput,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div class="w-full max-w-2xl mx-auto bg-background">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    placeholder: {
      control: 'text',
    },
    disabled: {
      control: 'boolean',
    },
    isRecording: {
      control: 'boolean',
    },
    recordingDuration: {
      control: 'number',
    },
    isProcessing: {
      control: 'boolean',
    },
  },
}

export default meta
type Story = StoryObj<typeof ChatInput>

// Default empty state
export const Default: Story = {
  args: {
    placeholder: 'Type a message...',
    onSend: (message) => console.log('Send:', message),
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}

// With custom placeholder
export const CustomPlaceholder: Story = {
  args: {
    placeholder: 'Ask Scarlett anything about music...',
    onSend: (message) => console.log('Send:', message),
  },
}

// Disabled state
export const Disabled: Story = {
  args: {
    placeholder: 'Type a message...',
    disabled: true,
  },
}

// Recording state - short duration
export const RecordingShort: Story = {
  args: {
    isRecording: true,
    recordingDuration: 3,
    onStopRecording: () => console.log('Stop recording'),
  },
}

// Recording state - longer duration
export const RecordingLong: Story = {
  args: {
    isRecording: true,
    recordingDuration: 45,
    onStopRecording: () => console.log('Stop recording'),
  },
}

// Recording state - very long
export const RecordingVeryLong: Story = {
  args: {
    isRecording: true,
    recordingDuration: 125,
    onStopRecording: () => console.log('Stop recording'),
  },
}

// Processing/transcribing state
export const Processing: Story = {
  args: {
    isProcessing: true,
  },
}

// Recording disabled
export const RecordingDisabled: Story = {
  args: {
    isRecording: true,
    recordingDuration: 10,
    disabled: true,
    onStopRecording: () => console.log('Stop recording'),
  },
}

// Interactive example showing state transitions
export const Interactive: Story = {
  render: () => {
    // Note: In a real story, you'd use SolidJS signals
    // This is just for documentation purposes
    return (
      <div class="space-y-4">
        <p class="text-sm text-muted-foreground px-4">
          Try typing in the input. The button changes from mic (voice) to send when there's text.
        </p>
        <ChatInput
          placeholder="Type to see button change..."
          onSend={(message) => {
            console.log('Sent:', message)
            alert(`Message sent: ${message}`)
          }}
          onStartRecording={() => console.log('Would start recording')}
          onStopRecording={() => console.log('Would stop recording')}
        />
      </div>
    )
  },
}

// All states showcase
export const AllStates: Story = {
  render: () => (
    <div class="space-y-8">
      <div>
        <h3 class="text-sm font-medium text-muted-foreground mb-2 px-4">Default (empty)</h3>
        <ChatInput
          placeholder="Type a message..."
          onSend={(m) => console.log(m)}
          onStartRecording={() => {}}
        />
      </div>

      <div>
        <h3 class="text-sm font-medium text-muted-foreground mb-2 px-4">Recording</h3>
        <ChatInput
          isRecording={true}
          recordingDuration={12}
          onStopRecording={() => {}}
        />
      </div>

      <div>
        <h3 class="text-sm font-medium text-muted-foreground mb-2 px-4">Processing</h3>
        <ChatInput isProcessing={true} />
      </div>

      <div>
        <h3 class="text-sm font-medium text-muted-foreground mb-2 px-4">Disabled</h3>
        <ChatInput
          placeholder="Chat is disabled..."
          disabled={true}
        />
      </div>
    </div>
  ),
}
