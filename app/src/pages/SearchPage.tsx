import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchPageView, type Song } from '@/components/search/SearchPageView'
import { useKaraokeSongsSearchWithMetadata } from '@/hooks/useKaraokeSongsSearch'
import { generateSlug } from '@/hooks/useSongSlug'

// Extended Song type with slugs for routing
interface SongWithSlug extends Song {
  artistSlug: string
  songSlug: string
}

// Transform KaraokeSong to Song for SearchPageView compatibility
function transformKaraokeSongToSong(karaokeSong: any): SongWithSlug {
  // Generate slugs from title/artist for clean URL routing
  const artistSlug = generateSlug(karaokeSong.artist || 'unknown')
  const songSlug = generateSlug(karaokeSong.title || 'unknown')

  return {
    id: karaokeSong.spotifyTrackId,
    geniusId: 0, // Not used anymore
    title: karaokeSong.title,
    artist: karaokeSong.artist,
    artworkUrl: karaokeSong.artworkUrl || '',
    isProcessed: karaokeSong.hasInstrumental,
    artistSlug,
    songSlug,
  }
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
    first: 10,              // Show more results (ordered by registeredAt desc)
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
    const songWithSlug = song as SongWithSlug
    console.log('Song clicked:', song, 'navigating to:', `/${songWithSlug.artistSlug}/${songWithSlug.songSlug}`)
    // Navigate using clean slug-based URL
    navigate(`/${songWithSlug.artistSlug}/${songWithSlug.songSlug}`)
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
