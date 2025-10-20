import type { Meta, StoryObj } from '@storybook/react-vite'
import { AudioPlayerFooter } from '@/components/media/AudioPlayerFooter'

const meta = {
  title: 'Media/AudioPlayerFooter',
  component: AudioPlayerFooter,
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
  argTypes: {
    title: {
      control: 'text',
    },
    artist: {
      control: 'text',
    },
    artworkUrl: {
      control: 'text',
    },
    isPlaying: {
      control: 'boolean',
    },
    progress: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
    },
  },
} satisfies Meta<typeof AudioPlayerFooter>

export default meta
type Story = StoryObj<typeof meta>

export const Playing: Story = {
  args: {
    title: 'Heat of the Night',
    artist: 'Scarlett X',
    artworkUrl: 'https://placebear.com/400/400',
    isPlaying: true,
    progress: 45,
    onPlayPause: () => console.log('Play/Pause clicked'),
    onSeek: (position) => console.log('Seek to:', position),
  },
}

export const Paused: Story = {
  args: {
    title: 'Heat of the Night',
    artist: 'Scarlett X',
    artworkUrl: 'https://placebear.com/g/400/400',
    isPlaying: false,
    progress: 45,
    onPlayPause: () => console.log('Play/Pause clicked'),
    onSeek: (position) => console.log('Seek to:', position),
  },
}

export const WithoutArtwork: Story = {
  args: {
    title: 'Down Home Blues',
    artist: 'Ethel Waters',
    isPlaying: true,
    progress: 20,
    onPlayPause: () => console.log('Play/Pause clicked'),
    onSeek: (position) => console.log('Seek to:', position),
  },
}

export const JustStarted: Story = {
  args: {
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    artworkUrl: 'https://placebear.com/401/401',
    isPlaying: true,
    progress: 0,
    onPlayPause: () => console.log('Play/Pause clicked'),
    onSeek: (position) => console.log('Seek to:', position),
  },
}

export const AlmostFinished: Story = {
  args: {
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    artworkUrl: 'https://placebear.com/402/402',
    isPlaying: true,
    progress: 95,
    onPlayPause: () => console.log('Play/Pause clicked'),
    onSeek: (position) => console.log('Seek to:', position),
  },
}

export const LongTitles: Story = {
  args: {
    title: 'The Night We Met (From "13 Reasons Why" Soundtrack)',
    artist: 'Lord Huron & The Amazing String Orchestra',
    artworkUrl: 'https://placebear.com/g/402/402',
    isPlaying: true,
    progress: 60,
    onPlayPause: () => console.log('Play/Pause clicked'),
    onSeek: (position) => console.log('Seek to:', position),
  },
}

export const EmptyState: Story = {
  args: {
    onPlayPause: () => console.log('Play/Pause clicked'),
    onSeek: (position) => console.log('Seek to:', position),
  },
}
