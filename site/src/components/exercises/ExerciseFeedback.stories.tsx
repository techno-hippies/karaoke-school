import type { Meta, StoryObj } from '@storybook/react'
import { ExerciseFeedback } from './ExerciseFeedback'

const meta: Meta<typeof ExerciseFeedback> = {
  title: 'Exercises/ExerciseFeedback',
  component: ExerciseFeedback,
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
      <div className="w-full max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof ExerciseFeedback>

// Basic States
export const Correct: Story = {
  args: {
    isCorrect: true,
  },
}

export const Incorrect: Story = {
  args: {
    isCorrect: false,
  },
}

// Custom Messages
export const CustomCorrectMessage: Story = {
  args: {
    isCorrect: true,
    message: 'Perfect! Well done!',
  },
}

export const CustomIncorrectMessage: Story = {
  args: {
    isCorrect: false,
    message: 'Not quite, give it another try',
  },
}
