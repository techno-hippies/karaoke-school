import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchPageView, type Song } from '@/components/search/SearchPageView'

// Mock trending songs
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
]

export function SearchPage() {
  const navigate = useNavigate()
  const [searchResults, setSearchResults] = useState<Song[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async (query: string) => {
    setIsSearching(true)

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Mock search results - filter trending songs by query
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
    console.log('Song clicked:', song)
    // Navigate to song detail page
    navigate(`/song/${song.geniusId}`)
  }

  return (
    <SearchPageView
      trendingSongs={MOCK_TRENDING_SONGS}
      searchResults={searchResults}
      isSearching={isSearching}
      onSearch={handleSearch}
      onClearSearch={handleClearSearch}
      onSongClick={handleSongClick}
    />
  )
}
