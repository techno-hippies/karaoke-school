import type { Meta, StoryObj } from 'storybook-solidjs'
import { SayItBackExercise } from './SayItBackExercise'

const meta: Meta<typeof SayItBackExercise> = {
  title: 'Exercises/SayItBackExercise',
  component: SayItBackExercise,
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
type Story = StoryObj<typeof SayItBackExercise>

export const Default: Story = {
  args: {
    expectedText: '我喜欢学习中文',
  },
}

export const WithAudio: Story = {
  args: {
    expectedText: '我喜欢学习中文',
    ttsAudioUrl: 'https://example.com/audio.mp3',
  },
}

export const CorrectAnswer: Story = {
  args: {
    expectedText: '我喜欢学习中文',
    transcript: '我喜欢学习中文',
    score: 95,
    gradeMessage: 'Excellent!',
    isCorrect: true,
  },
}

export const GoodAnswer: Story = {
  args: {
    expectedText: '我喜欢学习中文',
    transcript: '我喜欢学中文',
    score: 75,
    gradeMessage: 'Great job!',
    isCorrect: true,
  },
}

export const HardAnswer: Story = {
  args: {
    expectedText: '我喜欢学习中文',
    transcript: '我学习中文',
    score: 55,
    gradeMessage: 'Nice try!',
    isCorrect: true,
  },
}

export const IncorrectAnswer: Story = {
  args: {
    expectedText: '我喜欢学习中文',
    transcript: '你好世界',
    score: 20,
    gradeMessage: 'Try again',
    isCorrect: false,
  },
}

export const LongText: Story = {
  args: {
    expectedText: 'The quick brown fox jumps over the lazy dog while contemplating the meaning of life',
    transcript: 'The quick brown fox jumps over the lazy dog',
    score: 70,
    gradeMessage: 'Great job!',
    isCorrect: true,
  },
}
