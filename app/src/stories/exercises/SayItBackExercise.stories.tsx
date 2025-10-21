import type { Meta, StoryObj } from '@storybook/react-vite'
import { SayItBackExercise } from '@/components/exercises/SayItBackExercise'

const meta = {
  title: 'Exercises/SayItBackExercise',
  component: SayItBackExercise,
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
} satisfies Meta<typeof SayItBackExercise>

export default meta
type Story = StoryObj<typeof meta>

export const BeforeRecording: Story = {
  args: {
    expectedText: 'Hello, how are you?',
  },
}

export const AfterRecording: Story = {
  args: {
    expectedText: 'Hello, how are you?',
    transcript: 'Hello, how are you?',
  },
}

export const PartialMatch: Story = {
  args: {
    expectedText: 'The quick brown fox jumps over the lazy dog',
    transcript: 'The quick brown fox jumps',
  },
}

export const LongText: Story = {
  args: {
    expectedText: 'The five boxing wizards jump quickly through the mysterious ancient forest under the bright moonlight.',
    transcript: 'The five boxing wizards jump quickly through the mysterious ancient forest under the bright moonlight.',
  },
}

export const ShortPhrase: Story = {
  args: {
    expectedText: '你好',
    transcript: '你好',
  },
}
