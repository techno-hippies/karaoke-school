import type { Meta, StoryObj } from '@storybook/react'
import { SayItBack } from '../components/exercises/SayItBack'

const meta: Meta<typeof SayItBack> = {
  title: 'Exercises/SayItBack',
  component: SayItBack,
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
      <div className="max-w-2xl w-full p-8">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SayItBack>

export const Initial: Story = {
  args: {
    expectedText: "我喜欢学习中文",
    onComplete: (score: number, transcript: string) =>
      console.log('Score:', score, 'Transcript:', transcript),
  },
}

export const WithCorrectTranscript: Story = {
  args: {
    expectedText: "我喜欢学习中文",
    transcript: "我喜欢学习中文",
    score: 95,
    onComplete: (score: number, transcript: string) =>
      console.log('Score:', score, 'Transcript:', transcript),
  },
}

export const WithIncorrectTranscript: Story = {
  args: {
    expectedText: "我喜欢学习中文",
    transcript: "我喜欢学习英文",
    score: 45,
    onComplete: (score: number, transcript: string) =>
      console.log('Score:', score, 'Transcript:', transcript),
  },
}

export const BorderlineScore: Story = {
  args: {
    expectedText: "这是一个测试句子",
    transcript: "这是一个测试句子",
    score: 70,
    onComplete: (score: number, transcript: string) =>
      console.log('Score:', score, 'Transcript:', transcript),
  },
}

export const LowScore: Story = {
  args: {
    expectedText: "这是一个测试句子",
    transcript: "这不是正确的句子",
    score: 25,
    onComplete: (score: number, transcript: string) =>
      console.log('Score:', score, 'Transcript:', transcript),
  },
}

export const LongText: Story = {
  args: {
    expectedText: "这是一个很长的句子，用来测试当文本内容比较多的时候，组件的显示效果如何",
    onComplete: (score: number, transcript: string) =>
      console.log('Score:', score, 'Transcript:', transcript),
  },
}

export const WithEnglishText: Story = {
  args: {
    expectedText: "Welcome to the language learning journey",
    onComplete: (score: number, transcript: string) =>
      console.log('Score:', score, 'Transcript:', transcript),
  },
}

export const EnglishWithFeedback: Story = {
  args: {
    expectedText: "The quick brown fox jumps over the lazy dog",
    transcript: "The quick brown fox jumps over the lazy dog",
    score: 88,
    onComplete: (score: number, transcript: string) =>
      console.log('Score:', score, 'Transcript:', transcript),
  },
}

export const ComplexSentence: Story = {
  args: {
    expectedText: "人工智能正在改变我们的世界，为人类带来无限可能",
    transcript: "人工智能正在改变我们的世界，为人类带来无限可能",
    score: 92,
    onComplete: (score: number, transcript: string) =>
      console.log('Score:', score, 'Transcript:', transcript),
  },
}