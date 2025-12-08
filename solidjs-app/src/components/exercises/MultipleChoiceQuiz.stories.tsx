import type { Meta, StoryObj } from 'storybook-solidjs'
import { MultipleChoiceQuiz } from './MultipleChoiceQuiz'

const meta: Meta<typeof MultipleChoiceQuiz> = {
  title: 'Exercises/MultipleChoiceQuiz',
  component: MultipleChoiceQuiz,
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
type Story = StoryObj<typeof MultipleChoiceQuiz>

const translationOptions = [
  { id: '1', text: 'I love learning Chinese', isCorrect: true },
  { id: '2', text: 'I like studying Chinese', isCorrect: false },
  { id: '3', text: 'I enjoy Chinese lessons', isCorrect: false },
  { id: '4', text: 'I want to learn Chinese', isCorrect: false },
]

const triviaOptions = [
  { id: '1', text: 'Taylor Swift', isCorrect: false },
  { id: '2', text: 'Britney Spears', isCorrect: true },
  { id: '3', text: 'Christina Aguilera', isCorrect: false },
  { id: '4', text: 'Beyoncé', isCorrect: false },
]

export const Translation: Story = {
  args: {
    question: '我喜欢学习中文',
    options: translationOptions,
    exerciseType: 'TRANSLATION_MULTIPLE_CHOICE',
  },
}

export const Trivia: Story = {
  args: {
    question: 'Who sang "Toxic" in 2004?',
    options: triviaOptions,
    exerciseType: 'TRIVIA_MULTIPLE_CHOICE',
  },
}

export const CorrectAnswer: Story = {
  args: {
    question: '我喜欢学习中文',
    options: translationOptions,
    exerciseType: 'TRANSLATION_MULTIPLE_CHOICE',
    hasAnswered: true,
    selectedAnswerId: '1',
  },
}

export const IncorrectAnswer: Story = {
  args: {
    question: '我喜欢学习中文',
    options: translationOptions,
    exerciseType: 'TRANSLATION_MULTIPLE_CHOICE',
    hasAnswered: true,
    selectedAnswerId: '2',
  },
}

export const IncorrectWithExplanation: Story = {
  args: {
    question: 'Who sang "Toxic" in 2004?',
    options: triviaOptions,
    exerciseType: 'TRIVIA_MULTIPLE_CHOICE',
    hasAnswered: true,
    selectedAnswerId: '1',
    explanation: '"Toxic" was released by Britney Spears in January 2004 as part of her album "In the Zone". The song became one of her signature hits and won a Grammy Award.',
  },
}

export const Processing: Story = {
  args: {
    question: '我喜欢学习中文',
    options: translationOptions,
    exerciseType: 'TRANSLATION_MULTIPLE_CHOICE',
    isProcessing: true,
    selectedAnswerId: '1',
  },
}
