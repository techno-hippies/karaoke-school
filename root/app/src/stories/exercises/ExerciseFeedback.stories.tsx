import type { Meta, StoryObj } from '@storybook/react'
import { ExerciseFeedback } from '@/components/exercises/ExerciseFeedback'

const meta: Meta<typeof ExerciseFeedback> = {
  title: 'Exercises/ExerciseFeedback',
  component: ExerciseFeedback,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      }
    }
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl mx-auto">
        <Story />
      </div>
    )
  ]
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default correct feedback
 */
export const Correct: Story = {
  args: {
    variant: 'correct',
  },
}

/**
 * Default incorrect feedback
 */
export const Incorrect: Story = {
  args: {
    variant: 'incorrect',
  },
}

/**
 * Correct with custom message
 */
export const CorrectCustomMessage: Story = {
  args: {
    variant: 'correct',
    message: 'Perfect pronunciation!',
  },
}

/**
 * Incorrect with custom message
 */
export const IncorrectCustomMessage: Story = {
  args: {
    variant: 'incorrect',
    message: 'Not quite right',
  },
}

/**
 * In exercise context with additional feedback details
 */
export const WithFeedbackDetails: Story = {
  render: () => (
    <div className="space-y-4">
      <ExerciseFeedback variant="incorrect" />

      {/* Separate feedback details */}
      <div className="space-y-2">
        <div className="text-muted-foreground">You said:</div>
        <div className="text-foreground font-medium">Good evening</div>
      </div>

      <div className="space-y-2">
        <div className="text-muted-foreground">Expected:</div>
        <div className="text-foreground font-medium">Good morning</div>
      </div>
    </div>
  ),
}

/**
 * Comparison: Both variants side by side
 */
export const Comparison: Story = {
  render: () => (
    <div className="space-y-4">
      <ExerciseFeedback variant="correct" />
      <ExerciseFeedback variant="incorrect" />
    </div>
  ),
}
