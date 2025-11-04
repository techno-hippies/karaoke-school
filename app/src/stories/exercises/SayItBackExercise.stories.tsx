import type { Meta, StoryObj } from '@storybook/react-vite'
import { SayItBackExercise } from '@/components/exercises/SayItBackExercise'

const meta = {
  title: 'Exercises/SayItBackExercise',
  component: SayItBackExercise,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SayItBackExercise>

export default meta
type Story = StoryObj<typeof meta>

export const BeforeRecording: Story = {
  args: {
    expectedText: 'I\'ve never fallen from quite this high',
    // No ttsAudioUrl - play button won't show
  },
}

export const WithPlayButton: Story = {
  args: {
    expectedText: 'I\'ve never fallen from quite this high',
    ttsAudioUrl: 'https://example.com/audio.mp3', // Placeholder - would be actual Grove URL
  },
}

export const AfterRecording: Story = {
  args: {
    expectedText: 'I\'ve never fallen from quite this high',
    transcript: 'I\'ve never fallen from quite this high',
    ttsAudioUrl: 'https://example.com/audio.mp3',
  },
}

export const PartialMatch: Story = {
  args: {
    expectedText: 'The quick brown fox jumps over the lazy dog',
    transcript: 'The quick brown fox jumps',
    ttsAudioUrl: 'https://example.com/audio.mp3',
  },
}

export const LongText: Story = {
  args: {
    expectedText: 'The five boxing wizards jump quickly through the mysterious ancient forest under the bright moonlight.',
    transcript: 'The five boxing wizards jump quickly through the mysterious ancient forest under the bright moonlight.',
    ttsAudioUrl: 'https://example.com/audio.mp3',
  },
}

export const ShortPhrase: Story = {
  args: {
    expectedText: '你好',
    transcript: '你好',
    ttsAudioUrl: 'https://example.com/audio.mp3',
  },
}
