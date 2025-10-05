import type { Meta, StoryObj } from '@storybook/react-vite'
import { AudioButton } from '@/components/media/audio-button'

const meta = {
  title: 'Media/AudioButton',
  component: AudioButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    isPlaying: {
      control: 'boolean',
    },
    isLoading: {
      control: 'boolean',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof AudioButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onClick: () => console.log('Play clicked'),
  },
}

export const Playing: Story = {
  args: {
    isPlaying: true,
    onClick: () => console.log('Pause clicked'),
  },
}

export const Loading: Story = {
  args: {
    isLoading: true,
  },
}

export const Small: Story = {
  args: {
    size: 'sm',
    onClick: () => console.log('Play clicked'),
  },
}

export const Medium: Story = {
  args: {
    size: 'md',
    onClick: () => console.log('Play clicked'),
  },
}

export const Large: Story = {
  args: {
    size: 'lg',
    onClick: () => console.log('Play clicked'),
  },
}
