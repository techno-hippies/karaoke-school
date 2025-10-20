import type { Meta, StoryObj } from '@storybook/react-vite'
import { ClassPage } from '@/components/class/ClassPage'

const meta = {
  title: 'Class/ClassPage',
  component: ClassPage,
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
} satisfies Meta<typeof ClassPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    newCount: 5,
    learningCount: 12,
    dueCount: 8,
    studySongs: [
      {
        id: '1',
        title: 'Heat of the Night',
        artist: 'Scarlett X',
        artworkUrl: 'https://placebear.com/400/400',
        isNative: true,
      },
      {
        id: '2',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        artworkUrl: 'https://placebear.com/g/400/400',
      },
      {
        id: '3',
        title: 'Down Home Blues',
        artist: 'Ethel Waters',
        artworkUrl: 'https://placebear.com/401/401',
      },
    ],
    likedSongs: [
      {
        id: '4',
        title: 'Shape of You',
        artist: 'Ed Sheeran',
        artworkUrl: 'https://placebear.com/g/401/401',
        isNative: true,
      },
      {
        id: '5',
        title: 'Someone Like You',
        artist: 'Adele',
        artworkUrl: 'https://placebear.com/402/402',
      },
    ],
    onSongClick: (id) => console.log('Song clicked:', id),
    onPlayClick: (id) => console.log('Play clicked:', id),
    onStudy: () => console.log('Study clicked'),
  },
}

export const EmptyState: Story = {
  args: {
    newCount: 0,
    learningCount: 0,
    dueCount: 0,
    studySongs: [],
    likedSongs: [],
    onSongClick: (id) => console.log('Song clicked:', id),
    onPlayClick: (id) => console.log('Play clicked:', id),
    onStudy: () => console.log('Study clicked'),
  },
}

export const OnlyStudySongs: Story = {
  args: {
    newCount: 5,
    learningCount: 12,
    dueCount: 17,
    studySongs: [
      {
        id: '1',
        title: 'Heat of the Night',
        artist: 'Scarlett X',
        artworkUrl: 'https://placebear.com/407/407',
        isNative: true,
      },
      {
        id: '2',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        artworkUrl: 'https://placebear.com/g/407/407',
      },
    ],
    likedSongs: [],
    onSongClick: (id) => console.log('Song clicked:', id),
    onPlayClick: (id) => console.log('Play clicked:', id),
    onStudy: () => console.log('Study clicked'),
  },
}

export const OnlyLikedSongs: Story = {
  args: {
    newCount: 0,
    learningCount: 0,
    dueCount: 0,
    studySongs: [],
    likedSongs: [
      {
        id: '1',
        title: 'Shape of You',
        artist: 'Ed Sheeran',
        artworkUrl: 'https://placebear.com/403/403',
        isNative: true,
      },
      {
        id: '2',
        title: 'Someone Like You',
        artist: 'Adele',
        artworkUrl: 'https://placebear.com/g/403/403',
      },
    ],
    onSongClick: (id) => console.log('Song clicked:', id),
    onPlayClick: (id) => console.log('Play clicked:', id),
    onStudy: () => console.log('Study clicked'),
  },
}

export const ManySongs: Story = {
  args: {
    newCount: 25,
    learningCount: 99,
    dueCount: 45,
    studySongs: [
      {
        id: '1',
        title: 'Heat of the Night',
        artist: 'Scarlett X',
        artworkUrl: 'https://placebear.com/408/408',
        isNative: true,
      },
      {
        id: '2',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        artworkUrl: 'https://placebear.com/g/408/408',
      },
      {
        id: '3',
        title: 'Down Home Blues',
        artist: 'Ethel Waters',
        artworkUrl: 'https://placebear.com/409/409',
        isNative: true,
      },
    ],
    likedSongs: [
      {
        id: '4',
        title: 'Shape of You',
        artist: 'Ed Sheeran',
        artworkUrl: 'https://placebear.com/405/405',
        isNative: true,
      },
      {
        id: '5',
        title: 'Someone Like You',
        artist: 'Adele',
        artworkUrl: 'https://placebear.com/g/405/405',
      },
      {
        id: '6',
        title: 'Rolling in the Deep',
        artist: 'Adele',
        artworkUrl: 'https://placebear.com/406/406',
      },
    ],
    onSongClick: (id) => console.log('Song clicked:', id),
    onPlayClick: (id) => console.log('Play clicked:', id),
    onStudy: () => console.log('Study clicked'),
  },
}
