import type { Meta, StoryObj } from '@storybook/react-vite'
import { ExerciseFeedback } from '@/components/exercises/ExerciseFeedback'

const meta = {
  title: 'Exercises/ExerciseFeedback',
  component: ExerciseFeedback,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ExerciseFeedback>

export default meta
type Story = StoryObj<typeof meta>

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

export const CustomCorrectMessage: Story = {
  args: {
    isCorrect: true,
    message: 'Perfect! You nailed it!',
  },
}

export const CustomIncorrectMessage: Story = {
  args: {
    isCorrect: false,
    message: 'Not quite. Give it another try.',
  },
}
