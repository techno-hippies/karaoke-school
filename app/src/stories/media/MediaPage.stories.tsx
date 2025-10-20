import type { Meta, StoryObj } from '@storybook/react'
import { MediaPage } from '@/components/media/MediaPage'
import type { LyricLine } from '@/types/karaoke'

const meta = {
  title: 'Media/MediaPage',
  component: MediaPage,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof MediaPage>

export default meta
type Story = StoryObj<typeof meta>

// Sample lyrics with word-level timestamps and translations
// Default: English lyrics with Mandarin translations
const sampleLyrics: LyricLine[] = [
  {
    lineIndex: 0,
    originalText: 'Hello world',
    translations: {
      cn: '你好世界',
      en: 'Hello world',
    },
    start: 0.5,
    end: 2.0,
    words: [
      { text: 'Hello', start: 0.5, end: 1.2 },
      { text: 'world', start: 1.3, end: 2.0 },
    ],
  },
  {
    lineIndex: 1,
    originalText: 'I love singing',
    translations: {
      cn: '我爱唱歌',
      en: 'I love singing',
    },
    start: 2.5,
    end: 4.2,
    words: [
      { text: 'I', start: 2.5, end: 2.8 },
      { text: 'love', start: 2.9, end: 3.3 },
      { text: 'singing', start: 3.4, end: 4.2 },
    ],
  },
  {
    lineIndex: 2,
    originalText: 'Music makes people happy',
    translations: {
      cn: '音乐让人快乐',
      en: 'Music makes people happy',
    },
    start: 4.8,
    end: 7.0,
    words: [
      { text: 'Music', start: 4.8, end: 5.5 },
      { text: 'makes', start: 5.6, end: 5.9 },
      { text: 'people', start: 6.0, end: 6.3 },
      { text: 'happy', start: 6.4, end: 7.0 },
    ],
  },
  {
    lineIndex: 3,
    originalText: 'Practice every day to improve',
    translations: {
      cn: '每天练习进步',
      en: 'Practice every day to improve',
    },
    start: 7.5,
    end: 9.8,
    words: [
      { text: 'Practice', start: 7.5, end: 8.2 },
      { text: 'every', start: 8.3, end: 8.5 },
      { text: 'day', start: 8.6, end: 8.9 },
      { text: 'to', start: 9.0, end: 9.2 },
      { text: 'improve', start: 9.3, end: 9.8 },
    ],
  },
]

const longLyrics: LyricLine[] = [
  {
    lineIndex: 0,
    originalText: 'Spring has arrived, flowers bloom',
    translations: {
      cn: '春天来了花儿开',
      en: 'Spring has arrived, flowers bloom',
    },
    start: 0.5,
    end: 3.0,
    words: [
      { text: 'Spring', start: 0.5, end: 1.0 },
      { text: 'has', start: 1.1, end: 1.3 },
      { text: 'arrived,', start: 1.4, end: 1.8 },
      { text: 'flowers', start: 1.9, end: 2.4 },
      { text: 'bloom', start: 2.5, end: 3.0 },
    ],
  },
  {
    lineIndex: 1,
    originalText: 'Little birds sing on the branches',
    translations: {
      cn: '小鸟在枝头歌唱',
      en: 'Little birds sing on the branches',
    },
    start: 3.5,
    end: 6.2,
    words: [
      { text: 'Little', start: 3.5, end: 3.9 },
      { text: 'birds', start: 4.0, end: 4.4 },
      { text: 'sing', start: 4.5, end: 4.8 },
      { text: 'on', start: 4.9, end: 5.1 },
      { text: 'the', start: 5.2, end: 5.4 },
      { text: 'branches', start: 5.5, end: 6.2 },
    ],
  },
  {
    lineIndex: 2,
    originalText: 'Sunshine warms the earth',
    translations: {
      cn: '阳光温暖大地',
      en: 'Sunshine warms the earth',
    },
    start: 6.8,
    end: 9.0,
    words: [
      { text: 'Sunshine', start: 6.8, end: 7.5 },
      { text: 'warms', start: 7.6, end: 8.1 },
      { text: 'the', start: 8.2, end: 8.4 },
      { text: 'earth', start: 8.5, end: 9.0 },
    ],
  },
  {
    lineIndex: 3,
    originalText: 'A gentle breeze blows by',
    translations: {
      cn: '微风轻轻吹过',
      en: 'A gentle breeze blows by',
    },
    start: 9.5,
    end: 12.0,
    words: [
      { text: 'A', start: 9.5, end: 9.7 },
      { text: 'gentle', start: 9.8, end: 10.2 },
      { text: 'breeze', start: 10.3, end: 10.8 },
      { text: 'blows', start: 10.9, end: 11.4 },
      { text: 'by', start: 11.5, end: 12.0 },
    ],
  },
  {
    lineIndex: 4,
    originalText: 'Children play on the grass',
    translations: {
      cn: '孩子们在草地玩耍',
      en: 'Children play on the grass',
    },
    start: 12.5,
    end: 15.5,
    words: [
      { text: 'Children', start: 12.5, end: 13.3 },
      { text: 'play', start: 13.4, end: 13.9 },
      { text: 'on', start: 14.0, end: 14.2 },
      { text: 'the', start: 14.3, end: 14.5 },
      { text: 'grass', start: 14.6, end: 15.5 },
    ],
  },
  {
    lineIndex: 5,
    originalText: 'Laughter fills the entire park',
    translations: {
      cn: '笑声充满整个公园',
      en: 'Laughter fills the entire park',
    },
    start: 16.0,
    end: 18.8,
    words: [
      { text: 'Laughter', start: 16.0, end: 16.7 },
      { text: 'fills', start: 16.8, end: 17.2 },
      { text: 'the', start: 17.3, end: 17.5 },
      { text: 'entire', start: 17.6, end: 18.0 },
      { text: 'park', start: 18.1, end: 18.8 },
    ],
  },
  {
    lineIndex: 6,
    originalText: 'This is a beautiful day',
    translations: {
      cn: '这是美好的一天',
      en: 'This is a beautiful day',
    },
    start: 19.3,
    end: 22.0,
    words: [
      { text: 'This', start: 19.3, end: 19.7 },
      { text: 'is', start: 19.8, end: 20.0 },
      { text: 'a', start: 20.1, end: 20.3 },
      { text: 'beautiful', start: 20.4, end: 21.2 },
      { text: 'day', start: 21.3, end: 22.0 },
    ],
  },
  {
    lineIndex: 7,
    originalText: "Let's cherish every moment",
    translations: {
      cn: '让我们珍惜每刻',
      en: "Let's cherish every moment",
    },
    start: 22.5,
    end: 25.2,
    words: [
      { text: "Let's", start: 22.5, end: 22.9 },
      { text: 'cherish', start: 23.0, end: 23.7 },
      { text: 'every', start: 23.8, end: 24.3 },
      { text: 'moment', start: 24.4, end: 25.2 },
    ],
  },
]

// Mock audio URL (silent audio for demo)
const mockAudioUrl =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

export const Default: Story = {
  args: {
    title: 'CUFF IT',
    artist: 'Beyoncé',
    audioUrl: mockAudioUrl,
    lyrics: sampleLyrics,
    selectedLanguage: 'cn',
    showTranslations: true,
  },
}

export const WithoutTranslations: Story = {
  args: {
    title: "I Love You, I'm Sorry",
    artist: 'Gracie Abrams',
    audioUrl: mockAudioUrl,
    lyrics: sampleLyrics,
    selectedLanguage: 'cn',
    showTranslations: false,
  },
}

export const EnglishTranslation: Story = {
  args: {
    title: 'II HANDS II HEAVEN',
    artist: 'Beyoncé',
    audioUrl: mockAudioUrl,
    lyrics: sampleLyrics,
    selectedLanguage: 'en',
    showTranslations: true,
  },
}

export const LongLyrics: Story = {
  args: {
    title: 'Spring Song',
    artist: 'Demo Artist',
    audioUrl: mockAudioUrl,
    lyrics: longLyrics,
    selectedLanguage: 'cn',
    showTranslations: true,
  },
}

export const NoWordTimestamps: Story = {
  args: {
    title: 'Simple Song',
    artist: 'Test Artist',
    audioUrl: mockAudioUrl,
    lyrics: [
      {
        lineIndex: 0,
        originalText: 'No word timestamps',
        translations: { cn: '没有单词时间戳' },
        start: 0.5,
        end: 2.0,
      },
      {
        lineIndex: 1,
        originalText: 'Only line-level sync',
        translations: { cn: '只有行级同步' },
        start: 2.5,
        end: 4.0,
      },
      {
        lineIndex: 2,
        originalText: 'Still works fine',
        translations: { cn: '仍然可以工作' },
        start: 4.5,
        end: 6.0,
      },
    ],
    selectedLanguage: 'cn',
    showTranslations: true,
  },
}
