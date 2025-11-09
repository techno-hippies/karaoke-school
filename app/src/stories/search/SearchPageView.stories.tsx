import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { SearchPageView, type Song } from '@/components/search/SearchPageView'

const meta = {
  title: 'Search/SearchPageView',
  component: SearchPageView,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SearchPageView>

export default meta
type Story = StoryObj<typeof meta>

const MOCK_TRENDING_SONGS: Song[] = [
  {
    id: '1',
    geniusId: 378195,
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    artworkUrl: 'https://placehold.co/400x400/8b5cf6/ffffff?text=Blinding+Lights',
    isProcessed: true,
  },
  {
    id: '2',
    geniusId: 5503092,
    title: 'As It Was',
    artist: 'Harry Styles',
    artworkUrl: 'https://placehold.co/400x400/ec4899/ffffff?text=As+It+Was',
    isProcessed: true,
  },
  {
    id: '3',
    geniusId: 6723822,
    title: 'Anti-Hero',
    artist: 'Taylor Swift',
    artworkUrl: 'https://placehold.co/400x400/f59e0b/ffffff?text=Anti-Hero',
    isProcessed: true,
  },
  {
    id: '4',
    geniusId: 2396871,
    title: 'Levitating',
    artist: 'Dua Lipa',
    artworkUrl: 'https://placehold.co/400x400/3b82f6/ffffff?text=Levitating',
    isProcessed: true,
  },
  {
    id: '5',
    geniusId: 7438658,
    title: 'Flowers',
    artist: 'Miley Cyrus',
    artworkUrl: 'https://placehold.co/400x400/10b981/ffffff?text=Flowers',
    isProcessed: true,
  },
  {
    id: '6',
    geniusId: 3039923,
    title: 'Watermelon Sugar',
    artist: 'Harry Styles',
    artworkUrl: 'https://placehold.co/400x400/ef4444/ffffff?text=Watermelon',
    isProcessed: true,
  },
  {
    id: '7',
    geniusId: 2774676,
    title: 'Dance Monkey',
    artist: 'Tones and I',
    artworkUrl: 'https://placehold.co/400x400/06b6d4/ffffff?text=Dance+Monkey',
    isProcessed: true,
  },
  {
    id: '8',
    geniusId: 5436727,
    title: 'Heat Waves',
    artist: 'Glass Animals',
    artworkUrl: 'https://placehold.co/400x400/f97316/ffffff?text=Heat+Waves',
    isProcessed: true,
  },
]

// Interactive wrapper for stories
function InteractiveSearch(props: Partial<typeof meta.component>) {
  const [searchResults, setSearchResults] = useState<Song[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async (query: string) => {
    setIsSearching(true)

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Filter mock data
    const results = MOCK_TRENDING_SONGS.filter(song =>
      song.title.toLowerCase().includes(query.toLowerCase()) ||
      song.artist.toLowerCase().includes(query.toLowerCase())
    )

    setSearchResults(results)
    setIsSearching(false)
  }

  const handleClearSearch = () => {
    setSearchResults([])
  }

  const handleSongClick = (song: Song) => {
    alert(`Clicked: ${song.title} by ${song.artist}`)
  }

  return (
    <SearchPageView
      trendingSongs={MOCK_TRENDING_SONGS}
      searchResults={searchResults}
      isSearching={isSearching}
      onSearch={handleSearch}
      onClearSearch={handleClearSearch}
      onSongClick={handleSongClick}
      {...props}
    />
  )
}

export const Default: Story = {
  render: () => <InteractiveSearch />,
}

export const WithSearchResults: Story = {
  render: () => <InteractiveSearch initialSearchQuery="harry" />,
  play: async () => {
    // This will auto-trigger search since initialSearchQuery is set
  },
}

export const Searching: Story = {
  args: {
    trendingSongs: MOCK_TRENDING_SONGS,
    searchResults: [],
    isSearching: true,
    onSearch: () => {},
    onClearSearch: () => {},
    onSongClick: () => {},
  },
}

export const NoResults: Story = {
  args: {
    trendingSongs: MOCK_TRENDING_SONGS,
    searchResults: [],
    isSearching: false,
    initialSearchQuery: 'zzzzz',
    onSearch: () => {},
    onClearSearch: () => {},
    onSongClick: () => {},
  },
  render: (args) => {
    return (
      <SearchPageView
        {...args}
        initialSearchQuery="nonexistent song"
      />
    )
  },
}

export const EmptyTrending: Story = {
  args: {
    trendingSongs: [],
    searchResults: [],
    isSearching: false,
    onSearch: () => {},
    onClearSearch: () => {},
    onSongClick: () => {},
  },
}

export const Mobile: Story = {
  render: () => <InteractiveSearch />,
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

export const ManyResults: Story = {
  args: {
    trendingSongs: [
      ...MOCK_TRENDING_SONGS,
      ...MOCK_TRENDING_SONGS.map((song, i) => ({
        ...song,
        id: `${song.id}-dup-${i}`,
      })),
    ],
    searchResults: [],
    isSearching: false,
    onSearch: () => {},
    onClearSearch: () => {},
    onSongClick: () => {},
  },
}
