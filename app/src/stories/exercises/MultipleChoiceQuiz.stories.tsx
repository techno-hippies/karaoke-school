import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { MultipleChoiceQuiz, type MultipleChoiceOption } from '@/components/exercises/MultipleChoiceQuiz'

const meta = {
  title: 'Exercises/MultipleChoiceQuiz',
  component: MultipleChoiceQuiz,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '600px', padding: '40px' }}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof MultipleChoiceQuiz>

export default meta
type Story = StoryObj<typeof meta>

const sampleOptions: MultipleChoiceOption[] = [
  { id: '1', text: 'Paris', isCorrect: true },
  { id: '2', text: 'London', isCorrect: false },
  { id: '3', text: 'Berlin', isCorrect: false },
  { id: '4', text: 'Madrid', isCorrect: false },
]

export const Unanswered: Story = {
  args: {
    question: 'What is the capital of France?',
    options: sampleOptions,
    onAnswer: (id, isCorrect) => console.log('Selected:', id, 'Correct:', isCorrect),
  },
}

export const CorrectAnswer: Story = {
  args: {
    question: 'What is the capital of France?',
    options: sampleOptions,
    hasAnswered: true,
    selectedAnswerId: '1',
    onAnswer: (id, isCorrect) => console.log('Selected:', id, 'Correct:', isCorrect),
  },
}

export const WrongAnswer: Story = {
  args: {
    question: 'What is the capital of France?',
    options: sampleOptions,
    hasAnswered: true,
    selectedAnswerId: '2',
    onAnswer: (id, isCorrect) => console.log('Selected:', id, 'Correct:', isCorrect),
  },
}

export const WithExplanation: Story = {
  args: {
    question: 'What is the capital of France?',
    options: sampleOptions,
    hasAnswered: true,
    selectedAnswerId: '1',
    explanation: 'Paris is the capital and most populous city of France, with an estimated population of 2,102,650 residents.',
    onAnswer: (id, isCorrect) => console.log('Selected:', id, 'Correct:', isCorrect),
  },
}

export const LongQuestion: Story = {
  args: {
    question: 'Which of the following programming languages was created by Guido van Rossum and first released in 1991?',
    options: [
      { id: '1', text: 'JavaScript', isCorrect: false },
      { id: '2', text: 'Python', isCorrect: true },
      { id: '3', text: 'Ruby', isCorrect: false },
      { id: '4', text: 'Java', isCorrect: false },
    ],
    onAnswer: (id, isCorrect) => console.log('Selected:', id, 'Correct:', isCorrect),
  },
}

export const LongAnswers: Story = {
  args: {
    question: 'What is object-oriented programming?',
    options: [
      { id: '1', text: 'A programming paradigm based on the concept of objects, which can contain data and code', isCorrect: true },
      { id: '2', text: 'A type of programming that only uses functions', isCorrect: false },
      { id: '3', text: 'Programming that focuses on databases', isCorrect: false },
      { id: '4', text: 'A style of programming that avoids all state', isCorrect: false },
    ],
    onAnswer: (id, isCorrect) => console.log('Selected:', id, 'Correct:', isCorrect),
  },
}

const LoadingStateTemplate = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [answered, setAnswered] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleAnswer = (id: string, isCorrect: boolean) => {
    setProcessing(true)
    setSelectedId(id)
    setMessage(null)

    setTimeout(() => {
      setProcessing(false)
      setAnswered(true)
      setMessage(isCorrect ? 'Correct!' : 'Incorrect — Paris is the capital city.')
    }, 1200)
  }

  return (
    <MultipleChoiceQuiz
      question="What is the capital of France?"
      options={sampleOptions}
      onAnswer={handleAnswer}
      isProcessing={processing}
      hasAnswered={answered}
      selectedAnswerId={selectedId}
      explanation={message ?? undefined}
      exerciseType="TRIVIA_QUIZ"
    />
  )
}

export const LoadingState: Story = {
  render: () => <LoadingStateTemplate />,
}
