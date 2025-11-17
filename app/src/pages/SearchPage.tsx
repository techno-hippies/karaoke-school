import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchPageView, type Song } from '@/components/search/SearchPageView'
import { useKaraokeSongsSearchWithMetadata } from '@/hooks/useKaraokeSongsSearch'

// Transform KaraokeSong to Song for SearchPageView compatibility
function transformKaraokeSongToSong(karaokeSong: any): Song {
  // Create a consistent numeric ID from the GRC-20 work ID
  const workIdHash = Math.abs(karaokeSong.grc20WorkId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0))

  return {
    id: karaokeSong.grc20WorkId,
    geniusId: workIdHash, // Generate consistent numeric ID from string
    title: karaokeSong.title,
    artist: karaokeSong.artist,
    artworkUrl: karaokeSong.artworkUrl || '',
    isProcessed: karaokeSong.hasInstrumental,
  } as Song
}

// Client-side fuzzy search function
function searchSongs(songs: Song[], query: string): Song[] {
  if (!query.trim()) return []

  const searchLower = query.toLowerCase().trim()

  return songs.filter(song => {
    const titleMatch = song.title.toLowerCase().includes(searchLower)
    const artistMatch = song.artist.toLowerCase().includes(searchLower)
    return titleMatch || artistMatch
  })
}

export function SearchPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')

  console.log('[SearchPage] Rendering search page')

  // Fetch ALL songs with metadata upfront (client-side filtering)
  const {
    data: karaokeSongs,
    isLoading
  } = useKaraokeSongsSearchWithMetadata('', {
    hasInstrumental: true,  // Only show songs with instrumentals
    first: 5,               // Limit initial display
  })

  console.log('[SearchPage] Search state:', {
    searchTerm,
    karaokeSongs: karaokeSongs?.length || 0,
    isLoading
  })

  // Transform all songs
  const allSongs = useMemo(() =>
    karaokeSongs?.map(transformKaraokeSongToSong) || [],
    [karaokeSongs]
  )

  // Client-side search filtering
  const searchResults = useMemo(() =>
    searchTerm.trim() ? searchSongs(allSongs, searchTerm) : [],
    [allSongs, searchTerm]
  )

  // Show all songs when no search term
  const trendingSongs = !searchTerm.trim() ? allSongs : []

  const handleSearch = async (query: string) => {
    setSearchTerm(query)
  }

  const handleClearSearch = () => {
    setSearchTerm('')
  }

  const handleSongClick = (song: Song) => {
    console.log('Song clicked:', song)
    // Navigate directly to song page (matches /song/:workId route)
    navigate(`/song/${song.id}`)
  }

  return (
    <SearchPageView
      trendingSongs={trendingSongs}
      searchResults={searchResults}
      isSearching={isLoading}
      onSearch={handleSearch}
      onClearSearch={handleClearSearch}
      onSongClick={handleSongClick}
    />
  )
}
