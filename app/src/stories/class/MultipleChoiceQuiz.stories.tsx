import type { Meta, StoryObj } from '@storybook/react'
import { MultipleChoiceQuiz } from '@/components/exercises/MultipleChoiceQuiz'

const meta: Meta<typeof MultipleChoiceQuiz> = {
  title: 'Class/MultipleChoiceQuiz',
  component: MultipleChoiceQuiz,
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
  argTypes: {
    onAnswer: { action: 'answer selected' }
  },
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

export const NotAnswered: Story = {
  args: {
    question: 'What is the capital of France?',
    options: [
      { id: '1', text: 'London', isCorrect: false },
      { id: '2', text: 'Paris', isCorrect: true },
      { id: '3', text: 'Berlin', isCorrect: false },
      { id: '4', text: 'Madrid', isCorrect: false }
    ]
  }
}

export const CorrectAnswer: Story = {
  args: {
    question: 'What is the capital of France?',
    options: [
      { id: '1', text: 'London', isCorrect: false },
      { id: '2', text: 'Paris', isCorrect: true },
      { id: '3', text: 'Berlin', isCorrect: false },
      { id: '4', text: 'Madrid', isCorrect: false }
    ],
    hasAnswered: true,
    selectedAnswerId: '2'
  }
}

export const WrongAnswer: Story = {
  args: {
    question: 'What is the capital of France?',
    options: [
      { id: '1', text: 'London', isCorrect: false },
      { id: '2', text: 'Paris', isCorrect: true },
      { id: '3', text: 'Berlin', isCorrect: false },
      { id: '4', text: 'Madrid', isCorrect: false }
    ],
    hasAnswered: true,
    selectedAnswerId: '1'
  }
}

export const WithExplanation: Story = {
  args: {
    question: 'What is the capital of France?',
    options: [
      { id: '1', text: 'London', isCorrect: false },
      { id: '2', text: 'Paris', isCorrect: true },
      { id: '3', text: 'Berlin', isCorrect: false },
      { id: '4', text: 'Madrid', isCorrect: false }
    ],
    hasAnswered: true,
    selectedAnswerId: '2',
    explanation: 'Paris has been the capital of France since 987 CE.'
  }
}

export const TwoOptions: Story = {
  args: {
    question: 'Is this a true/false question?',
    options: [
      { id: '1', text: 'True', isCorrect: true },
      { id: '2', text: 'False', isCorrect: false }
    ]
  }
}

export const Processing: Story = {
  args: {
    question: 'What is 2 + 2?',
    options: [
      { id: '1', text: '3', isCorrect: false },
      { id: '2', text: '4', isCorrect: true },
      { id: '3', text: '5', isCorrect: false }
    ],
    isProcessing: true,
    hasAnswered: true,
    selectedAnswerId: '2'
  }
}
