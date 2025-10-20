import type { Meta, StoryObj } from '@storybook/react'
import { VideoPoster } from '../../components/karaoke/VideoPoster'

const meta: Meta<typeof VideoPoster> = {
  title: 'Karaoke/VideoPoster',
  component: VideoPoster,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: '#000000' }
      }
    }
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof VideoPoster>

const sampleKaraokeLines = [
  {
    text: "The club isn't the best place to find a lover",
    start: 0,
    end: 4,
    words: [
      { text: "The", start: 0, end: 0.3 },
      { text: "club", start: 0.3, end: 0.8 },
      { text: "isn't", start: 0.8, end: 1.2 },
      { text: "the", start: 1.2, end: 1.4 },
      { text: "best", start: 1.4, end: 1.8 },
      { text: "place", start: 1.8, end: 2.3 },
      { text: "to", start: 2.3, end: 2.5 },
      { text: "find", start: 2.5, end: 2.9 },
      { text: "a", start: 2.9, end: 3.0 },
      { text: "lover", start: 3.0, end: 4.0 }
    ]
  },
  {
    text: "So the bar is where I go",
    start: 4.5,
    end: 7.5,
    words: [
      { text: "So", start: 4.5, end: 4.8 },
      { text: "the", start: 4.8, end: 5.0 },
      { text: "bar", start: 5.0, end: 5.5 },
      { text: "is", start: 5.5, end: 5.8 },
      { text: "where", start: 5.8, end: 6.3 },
      { text: "I", start: 6.3, end: 6.5 },
      { text: "go", start: 6.5, end: 7.5 }
    ]
  }
]

/**
 * Default state - posting a recorded karaoke video
 */
export const Default: Story = {
  args: {
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    karaokeLines: sampleKaraokeLines,
    onBack: () => console.log('Back clicked'),
    onPost: () => console.log('Post clicked'),
  },
}

/**
 * Without karaoke lyrics
 */
export const NoLyrics: Story = {
  args: {
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    onBack: () => console.log('Back clicked'),
    onPost: () => console.log('Post clicked'),
  },
}

/**
 * No video recorded state
 */
export const NoVideo: Story = {
  args: {
    videoUrl: undefined,
    onBack: () => console.log('Back clicked'),
    onPost: () => console.log('Post clicked'),
  },
}
