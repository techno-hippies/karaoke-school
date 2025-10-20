import type { Meta, StoryObj } from '@storybook/react-vite'
import { MediaPage } from '@/components/media/MediaPage'

const meta = {
  title: 'Media/MediaPage',
  component: MediaPage,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: 'oklch(0.1821 0.0125 285.0965)' }
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof MediaPage>

export default meta
type Story = StoryObj<typeof meta>

const sampleLyrics = [
  {
    lineIndex: 0,
    originalText: 'Walking down the street today',
    translations: { cn: '今天走在街上' },
    start: 0,
    end: 2.5,
    words: [
      { text: 'Walking', start: 0, end: 0.5 },
      { text: 'down', start: 0.5, end: 0.8 },
      { text: 'the', start: 0.8, end: 1.0 },
      { text: 'street', start: 1.0, end: 1.5 },
      { text: 'today', start: 1.5, end: 2.5 },
    ],
  },
  {
    lineIndex: 1,
    originalText: 'Feeling good, feeling free',
    translations: { cn: '感觉很好，感觉自由' },
    start: 2.5,
    end: 5.0,
    words: [
      { text: 'Feeling', start: 2.5, end: 3.0 },
      { text: 'good,', start: 3.0, end: 3.5 },
      { text: 'feeling', start: 3.5, end: 4.2 },
      { text: 'free', start: 4.2, end: 5.0 },
    ],
  },
  {
    lineIndex: 2,
    originalText: 'The sun is shining bright',
    translations: { cn: '阳光明媚' },
    start: 5.0,
    end: 7.5,
  },
  {
    lineIndex: 3,
    originalText: 'Everything feels right',
    translations: { cn: '一切都感觉很好' },
    start: 7.5,
    end: 10.0,
  },
  {
    lineIndex: 4,
    originalText: 'Dancing to the beat',
    translations: { cn: '随着节拍跳舞' },
    start: 10.0,
    end: 12.5,
  },
  {
    lineIndex: 5,
    originalText: 'Moving my feet',
    translations: { cn: '移动我的脚' },
    start: 12.5,
    end: 15.0,
  },
  {
    lineIndex: 6,
    originalText: 'Nothing can bring me down',
    translations: { cn: '没有什么能让我沮丧' },
    start: 15.0,
    end: 17.5,
  },
  {
    lineIndex: 7,
    originalText: 'Living in this town',
    translations: { cn: '住在这个城镇' },
    start: 17.5,
    end: 20.0,
  },
]

export const Default: Story = {
  args: {
    title: 'Heat of the Night',
    artist: 'Scarlett X',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    lyrics: sampleLyrics,
    selectedLanguage: 'cn',
    showTranslations: true,
    onBack: () => console.log('Back clicked'),
  },
}

export const WithoutTranslations: Story = {
  args: {
    title: 'Heat of the Night',
    artist: 'Scarlett X',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    lyrics: sampleLyrics,
    showTranslations: false,
    onBack: () => console.log('Back clicked'),
  },
}
