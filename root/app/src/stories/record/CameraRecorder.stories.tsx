import type { Meta, StoryObj } from '@storybook/react'
import { CameraRecorder } from '@/components/record/CameraRecorder'

const meta: Meta<typeof CameraRecorder> = {
  title: 'Record/CameraRecorder',
  component: CameraRecorder,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: '#000000' }
      }
    }
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof CameraRecorder>

/**
 * Ready to record state
 */
export const Ready: Story = {
  args: {
    isRecording: false,
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onClose: () => console.log('Close clicked'),
  },
}

/**
 * Currently recording
 */
export const Recording: Story = {
  args: {
    isRecording: true,
    onRecord: () => console.log('Record clicked'),
    onStop: () => console.log('Stop clicked'),
    onClose: () => console.log('Close clicked'),
  },
}
