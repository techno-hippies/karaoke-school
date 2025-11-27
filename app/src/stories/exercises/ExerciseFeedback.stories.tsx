import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ExerciseFeedback } from '@/components/exercises/ExerciseFeedback'
import { Button } from '@/components/ui/button'

const meta = {
  title: 'Exercises/ExerciseFeedback',
  component: ExerciseFeedback,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.145 0 0)' },
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    animated: {
      control: 'boolean',
    },
  },
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

export const NotAnimated: Story = {
  args: {
    isCorrect: true,
    animated: false,
  },
}

/**
 * Interactive demo showing the bounce-in animation on each answer
 */
export const Interactive: Story = {
  render: function InteractiveStory() {
    const [result, setResult] = useState<boolean | null>(null)
    const [key, setKey] = useState(0)

    const handleAnswer = (correct: boolean) => {
      setResult(correct)
      setKey((k) => k + 1)
    }

    return (
      <div className="flex flex-col items-center gap-8">
        <div className="h-16 flex items-center">
          {result !== null && (
            <ExerciseFeedback
              key={key}
              isCorrect={result}
              message={result ? 'Excellent work!' : 'Keep practicing!'}
            />
          )}
        </div>
        <div className="flex gap-4">
          <Button variant="gradient-success" onClick={() => handleAnswer(true)}>
            Correct Answer
          </Button>
          <Button variant="gradient-fire" onClick={() => handleAnswer(false)}>
            Wrong Answer
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Click buttons to see animated feedback
        </p>
      </div>
    )
  },
}
