import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchPageView, type Song } from '@/components/search/SearchPageView'
import { useKaraokeSongsSearchWithMetadata } from '@/hooks/useKaraokeSongsSearch'

// Transform KaraokeSong to Song for SearchPageView compatibility
function transformKaraokeSongToSong(karaokeSong: { grc20WorkId: string; title: string; artist: string; artworkUrl: string; hasInstrumental: boolean; spotifyTrackId?: string; totalSegments?: number; hasAlignments?: boolean; translationCount?: number; performanceCount?: number }): Song {
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
    artworkUrl: karaokeSong.artworkUrl,
    isProcessed: karaokeSong.hasInstrumental,
    // Additional data for enhanced display
    spotifyTrackId: karaokeSong.spotifyTrackId,
    totalSegments: karaokeSong.totalSegments,
    hasInstrumental: karaokeSong.hasInstrumental,
    hasAlignments: karaokeSong.hasAlignments,
    translationCount: karaokeSong.translationCount,
    performanceCount: karaokeSong.performanceCount,
  }
}

export function SearchPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')

  // Use the new hook to fetch real karaoke songs with segments
  const { 
    data: karaokeSongs, 
    isLoading
  } = useKaraokeSongsSearchWithMetadata(searchTerm, {
    hasInstrumental: true,  // Only show songs with instrumentals
    first: 20,             // Limit to 20 results
  })

  // Transform to Song format for SearchPageView
  const trendingSongs = !searchTerm.trim() && !isLoading
    ? karaokeSongs?.map(transformKaraokeSongToSong) || []
    : []

  const searchResults = searchTerm.trim() && !isLoading
    ? karaokeSongs?.map(transformKaraokeSongToSong) || []
    : []

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
