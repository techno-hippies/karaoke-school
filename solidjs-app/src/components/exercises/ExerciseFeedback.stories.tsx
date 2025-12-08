import type { Meta, StoryObj } from 'storybook-solidjs'
import { ExerciseFeedback } from './ExerciseFeedback'

const meta: Meta<typeof ExerciseFeedback> = {
  title: 'Exercises/ExerciseFeedback',
  component: ExerciseFeedback,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div class="w-[400px] p-6 bg-background">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ExerciseFeedback>

export const Correct: Story = {
  args: {
    isCorrect: true,
  },
}

export const CorrectWithMessage: Story = {
  args: {
    isCorrect: true,
    message: 'Excellent!',
  },
}

export const Incorrect: Story = {
  args: {
    isCorrect: false,
  },
}

export const IncorrectWithMessage: Story = {
  args: {
    isCorrect: false,
    message: 'Try again.',
  },
}

export const Animated: Story = {
  args: {
    isCorrect: true,
    animated: true,
  },
}
