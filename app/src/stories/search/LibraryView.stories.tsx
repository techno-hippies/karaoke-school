import type { Meta, StoryObj } from '@storybook/react-vite'
import { LibraryView, type LibrarySection } from '@/components/search/LibraryView'

const meta = {
  title: 'Search/LibraryView',
  component: LibraryView,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof LibraryView>

export default meta
type Story = StoryObj<typeof meta>

const BEYONCE_SONGS = [
  { id: 'b1', title: 'Halo', artist: 'Beyoncé', artworkUrl: 'https://placehold.co/400x400/f59e0b/ffffff?text=Halo' },
  { id: 'b2', title: 'Single Ladies', artist: 'Beyoncé', artworkUrl: 'https://placehold.co/400x400/f59e0b/ffffff?text=Single' },
  { id: 'b3', title: 'Crazy in Love', artist: 'Beyoncé', artworkUrl: 'https://placehold.co/400x400/f59e0b/ffffff?text=Crazy' },
  { id: 'b4', title: 'Formation', artist: 'Beyoncé', artworkUrl: 'https://placehold.co/400x400/f59e0b/ffffff?text=Formation' },
  { id: 'b5', title: 'Love on Top', artist: 'Beyoncé', artworkUrl: 'https://placehold.co/400x400/f59e0b/ffffff?text=Love' },
  { id: 'b6', title: 'Run the World', artist: 'Beyoncé', artworkUrl: 'https://placehold.co/400x400/f59e0b/ffffff?text=Run' },
]

const QUEEN_SONGS = [
  { id: 'q1', title: 'Bohemian Rhapsody', artist: 'Queen', artworkUrl: 'https://placehold.co/400x400/8b5cf6/ffffff?text=Bohemian' },
  { id: 'q2', title: 'We Will Rock You', artist: 'Queen', artworkUrl: 'https://placehold.co/400x400/8b5cf6/ffffff?text=Rock' },
  { id: 'q3', title: 'Don\'t Stop Me Now', artist: 'Queen', artworkUrl: 'https://placehold.co/400x400/8b5cf6/ffffff?text=Don\'t+Stop' },
  { id: 'q4', title: 'Somebody to Love', artist: 'Queen', artworkUrl: 'https://placehold.co/400x400/8b5cf6/ffffff?text=Somebody' },
  { id: 'q5', title: 'Under Pressure', artist: 'Queen', artworkUrl: 'https://placehold.co/400x400/8b5cf6/ffffff?text=Pressure' },
]

const TRENDING_SONGS = [
  { id: 't1', title: 'Blinding Lights', artist: 'The Weeknd', artworkUrl: 'https://placehold.co/400x400/ec4899/ffffff?text=Blinding' },
  { id: 't2', title: 'As It Was', artist: 'Harry Styles', artworkUrl: 'https://placehold.co/400x400/3b82f6/ffffff?text=As+It+Was' },
  { id: 't3', title: 'Anti-Hero', artist: 'Taylor Swift', artworkUrl: 'https://placehold.co/400x400/10b981/ffffff?text=Anti-Hero' },
  { id: 't4', title: 'Flowers', artist: 'Miley Cyrus', artworkUrl: 'https://placehold.co/400x400/ef4444/ffffff?text=Flowers' },
  { id: 't5', title: 'Levitating', artist: 'Dua Lipa', artworkUrl: 'https://placehold.co/400x400/06b6d4/ffffff?text=Levitating' },
  { id: 't6', title: 'Heat Waves', artist: 'Glass Animals', artworkUrl: 'https://placehold.co/400x400/f97316/ffffff?text=Heat' },
]

const MOCK_SECTIONS: LibrarySection[] = [
  { id: 'beyonce', title: 'Beyoncé', songs: BEYONCE_SONGS, showArtist: false },
  { id: 'queen', title: 'Queen', songs: QUEEN_SONGS, showArtist: false },
  { id: 'trending', title: 'Trending', songs: TRENDING_SONGS, showArtist: true },
]

export const Default: Story = {
  args: {
    sections: MOCK_SECTIONS,
    onSongClick: (song) => alert(`Clicked: ${song.title}`),
  },
}

export const Loading: Story = {
  args: {
    sections: [],
    isLoading: true,
  },
}

export const SingleSection: Story = {
  args: {
    sections: [{ id: 'trending', title: 'Trending', songs: TRENDING_SONGS }],
  },
}

export const ManySections: Story = {
  args: {
    sections: [
      { id: 'beyonce', title: 'Beyoncé', songs: BEYONCE_SONGS, showArtist: false },
      { id: 'queen', title: 'Queen', songs: QUEEN_SONGS, showArtist: false },
      { id: 'trending', title: 'Trending', songs: TRENDING_SONGS, showArtist: true },
      { id: 'taylor', title: 'Taylor Swift', showArtist: false, songs: [
        { id: 'ts1', title: 'Shake It Off', artist: 'Taylor Swift', artworkUrl: 'https://placehold.co/400x400/a855f7/ffffff?text=Shake' },
        { id: 'ts2', title: 'Blank Space', artist: 'Taylor Swift', artworkUrl: 'https://placehold.co/400x400/a855f7/ffffff?text=Blank' },
        { id: 'ts3', title: 'Love Story', artist: 'Taylor Swift', artworkUrl: 'https://placehold.co/400x400/a855f7/ffffff?text=Love' },
      ]},
      { id: 'adele', title: 'Adele', showArtist: false, songs: [
        { id: 'a1', title: 'Rolling in the Deep', artist: 'Adele', artworkUrl: 'https://placehold.co/400x400/64748b/ffffff?text=Rolling' },
        { id: 'a2', title: 'Someone Like You', artist: 'Adele', artworkUrl: 'https://placehold.co/400x400/64748b/ffffff?text=Someone' },
        { id: 'a3', title: 'Hello', artist: 'Adele', artworkUrl: 'https://placehold.co/400x400/64748b/ffffff?text=Hello' },
      ]},
    ],
  },
}

export const Mobile: Story = {
  args: {
    sections: MOCK_SECTIONS,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

export const NoArtwork: Story = {
  args: {
    sections: [
      {
        id: 'no-art',
        title: 'No Artwork',
        songs: [
          { id: 'na1', title: 'Mystery Song', artist: 'Unknown Artist' },
          { id: 'na2', title: 'Hidden Track', artist: 'Anonymous' },
          { id: 'na3', title: 'Lost Recording', artist: 'Forgotten Band' },
        ],
      },
    ],
  },
}
