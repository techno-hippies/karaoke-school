import type { Meta, StoryObj } from '@storybook/react-vite'
import { ExerciseHeader } from '@/components/exercises/ExerciseHeader'

const meta = {
  title: 'Exercises/ExerciseHeader',
  component: ExerciseHeader,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ExerciseHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Beginning: Story = {
  args: {
    progress: 10,
    onClose: () => console.log('Close clicked'),
  },
}

export const Middle: Story = {
  args: {
    progress: 50,
    onClose: () => console.log('Close clicked'),
  },
}

export const AlmostDone: Story = {
  args: {
    progress: 90,
    onClose: () => console.log('Close clicked'),
  },
}

export const Complete: Story = {
  args: {
    progress: 100,
    onClose: () => console.log('Close clicked'),
  },
}

export const NoCloseButton: Story = {
  args: {
    progress: 50,
    showCloseButton: false,
    onClose: () => console.log('Close clicked'),
  },
}
