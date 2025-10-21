import type { Meta, StoryObj } from '@storybook/react-vite'
import { VoiceControls } from '@/components/exercises/VoiceControls'

const meta = {
  title: 'Exercises/VoiceControls',
  component: VoiceControls,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '500px' }}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof VoiceControls>

export default meta
type Story = StoryObj<typeof meta>

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
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}

export const CustomLabel: Story = {
  args: {
    isRecording: false,
    isProcessing: false,
    label: 'Speak now',
    onStartRecording: () => console.log('Start recording'),
    onStopRecording: () => console.log('Stop recording'),
  },
}
