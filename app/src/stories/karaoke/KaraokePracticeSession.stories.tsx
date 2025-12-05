import type { Meta, StoryObj } from '@storybook/react-vite'
import { KaraokePracticeSession } from '@/components/karaoke/KaraokePracticeSession'
import type { LyricLine } from '@/types/karaoke'
import type { GradeLineParams, GradeLineResult } from '@/hooks/useKaraokeLineSession'

const meta = {
  title: 'Karaoke/KaraokePracticeSession',
  component: KaraokePracticeSession,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof KaraokePracticeSession>

export default meta

type Story = StoryObj<typeof meta>

const mockAudioUrl =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

const englishLyrics: LyricLine[] = [
  {
    lineIndex: 0,
    originalText: 'Warm up your voice for the intro',
    translations: { en: 'Warm up your voice for the intro' },
    start: 0.5,
    end: 3.0,
    words: [
      { text: 'Warm', start: 0.5, end: 1.0 },
      { text: 'up', start: 1.05, end: 1.4 },
      { text: 'your', start: 1.45, end: 1.8 },
      { text: 'voice', start: 1.85, end: 2.4 },
      { text: 'for', start: 2.45, end: 2.6 },
      { text: 'the', start: 2.65, end: 2.75 },
      { text: 'intro', start: 2.75, end: 3.0 },
    ],
  },
  {
    lineIndex: 1,
    originalText: 'Catch the rhythm as the beat comes in',
    translations: { en: 'Catch the rhythm as the beat comes in' },
    start: 3.25,
    end: 6.0,
    words: [
      { text: 'Catch', start: 3.25, end: 3.7 },
      { text: 'the', start: 3.75, end: 3.9 },
      { text: 'rhythm', start: 3.95, end: 4.5 },
      { text: 'as', start: 4.6, end: 4.8 },
      { text: 'the', start: 4.85, end: 4.95 },
      { text: 'beat', start: 5.0, end: 5.4 },
      { text: 'comes', start: 5.45, end: 5.75 },
      { text: 'in', start: 5.8, end: 6.0 },
    ],
  },
  {
    lineIndex: 2,
    originalText: 'Lean into the melody and breathe',
    translations: { en: 'Lean into the melody and breathe' },
    start: 6.3,
    end: 8.7,
    words: [
      { text: 'Lean', start: 6.3, end: 6.7 },
      { text: 'into', start: 6.75, end: 7.1 },
      { text: 'the', start: 7.15, end: 7.25 },
      { text: 'melody', start: 7.3, end: 7.9 },
      { text: 'and', start: 7.95, end: 8.15 },
      { text: 'breathe', start: 8.2, end: 8.7 },
    ],
  },
  {
    lineIndex: 3,
    originalText: 'Match the timing, glide across the notes',
    translations: { en: 'Match the timing, glide across the notes' },
    start: 9.0,
    end: 11.7,
    words: [
      { text: 'Match', start: 9.0, end: 9.4 },
      { text: 'the', start: 9.45, end: 9.55 },
      { text: 'timing,', start: 9.6, end: 10.2 },
      { text: 'glide', start: 10.25, end: 10.7 },
      { text: 'across', start: 10.75, end: 11.1 },
      { text: 'the', start: 11.15, end: 11.25 },
      { text: 'notes', start: 11.3, end: 11.7 },
    ],
  },
  {
    lineIndex: 4,
    originalText: 'Chorus hits, hold the vowels steady',
    translations: { en: 'Chorus hits, hold the vowels steady' },
    start: 12.0,
    end: 14.5,
    words: [
      { text: 'Chorus', start: 12.0, end: 12.5 },
      { text: 'hits,', start: 12.55, end: 13.0 },
      { text: 'hold', start: 13.05, end: 13.4 },
      { text: 'the', start: 13.45, end: 13.55 },
      { text: 'vowels', start: 13.6, end: 14.1 },
      { text: 'steady', start: 14.15, end: 14.5 },
    ],
  },
  {
    lineIndex: 5,
    originalText: 'Catch your breath, but never drop the flow',
    translations: { en: 'Catch your breath, but never drop the flow' },
    start: 14.9,
    end: 17.4,
    words: [
      { text: 'Catch', start: 14.9, end: 15.2 },
      { text: 'your', start: 15.25, end: 15.45 },
      { text: 'breath,', start: 15.5, end: 15.95 },
      { text: 'but', start: 16.0, end: 16.2 },
      { text: 'never', start: 16.25, end: 16.65 },
      { text: 'drop', start: 16.7, end: 16.95 },
      { text: 'the', start: 17.0, end: 17.1 },
      { text: 'flow', start: 17.15, end: 17.4 },
    ],
  },
  {
    lineIndex: 6,
    originalText: 'Outro fades, leave them wanting more',
    translations: { en: 'Outro fades, leave them wanting more' },
    start: 17.8,
    end: 20.4,
    words: [
      { text: 'Outro', start: 17.8, end: 18.2 },
      { text: 'fades,', start: 18.25, end: 18.7 },
      { text: 'leave', start: 18.75, end: 19.1 },
      { text: 'them', start: 19.15, end: 19.35 },
      { text: 'wanting', start: 19.4, end: 19.9 },
      { text: 'more', start: 19.95, end: 20.4 },
    ],
  },
]

/**
 * Mock grading function that simulates real-time line grading.
 * Returns varying scores to simulate natural karaoke performance.
 */
const mockGradeLine = async (params: GradeLineParams): Promise<GradeLineResult> => {
  // Simulate grading delay (STT + scoring)
  await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500))

  // Generate realistic-ish scores
  const baseScore = 70 + Math.random() * 25
  const scoreBp = Math.round(baseScore * 100)
  const rating = baseScore >= 85 ? 'Easy' : baseScore >= 70 ? 'Good' : baseScore >= 55 ? 'Hard' : 'Again'

  const line = englishLyrics[params.lineIndex]

  console.log(`[MockGrader] Line ${params.lineIndex}: ${scoreBp / 100}% (${rating})`, {
    sessionId: params.sessionId.slice(0, 10),
    startSession: params.startSession,
    endSession: params.endSession,
  })

  return {
    score: Math.round(scoreBp / 100),
    scoreBp,
    rating,
    expectedText: line?.originalText || 'Sample line',
    transcript: line?.originalText || 'Sample transcript',
  }
}

export const ClipPreview: Story = {
  args: {
    title: 'Say It Back',
    artist: 'Karaoke School',
    audioUrl: mockAudioUrl,
    lyrics: englishLyrics.slice(0, 4), // Preview: first 4 lines (~60s clip)
    clipHash: '0x' + '11'.repeat(32),
    emitTransactions: false,
    onSubscribe: () => console.log('subscribe clicked'),
    gradeLine: mockGradeLine,
  },
}

export const FullAccess: Story = {
  args: {
    title: 'Say It Back',
    artist: 'Karaoke School',
    audioUrl: mockAudioUrl,
    lyrics: englishLyrics, // Full song
    clipHash: '0x' + '11'.repeat(32),
    emitTransactions: false,
    gradeLine: mockGradeLine,
  },
}

export const WithTransactions: Story = {
  args: {
    title: 'Say It Back',
    artist: 'Karaoke School',
    audioUrl: mockAudioUrl,
    lyrics: englishLyrics, // Full song
    clipHash: '0x' + '11'.repeat(32),
    emitTransactions: true,
    gradeLine: mockGradeLine,
  },
}
