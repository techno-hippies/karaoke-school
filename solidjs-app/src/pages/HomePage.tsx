import { type Component, createMemo } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { LibraryView, type LibrarySection, type LibrarySong } from '@/components/library/LibraryView'
import { useKaraokeSongs, type KaraokeSong } from '@/hooks/useKaraokeSongs'

/**
 * Transform KaraokeSong[] into LibrarySection[] for display
 * Groups songs by category (for now just "All Songs" since we don't have genre data)
 */
function songsToSections(songs: KaraokeSong[]): LibrarySection[] {
  if (!songs.length) return []

  // Convert to LibrarySong format
  const librarySongs: LibrarySong[] = songs.map(song => ({
    id: song.spotifyTrackId,
    title: song.title,
    artist: song.artist,
    artworkUrl: song.artworkUrl,
  }))

  // Group by recency for now - split into "Recent" and "All"
  const recent = librarySongs.slice(0, 10)
  const rest = librarySongs.slice(10)

  const sections: LibrarySection[] = [
    {
      id: 'recent',
      title: 'Recently Added',
      songs: recent,
    },
  ]

  if (rest.length > 0) {
    sections.push({
      id: 'all',
      title: 'All Songs',
      songs: rest,
    })
  }

  return sections
}

export const HomePage: Component = () => {
  const navigate = useNavigate()

  // Fetch real songs from subgraph
  const songsQuery = useKaraokeSongs(() => ({ first: 50, hasInstrumental: true }))

  // Transform songs into sections
  const sections = createMemo(() => {
    const songs = songsQuery.data
    if (!songs) return []
    return songsToSections(songs)
  })

  const handleSongClick = (song: LibrarySong) => {
    // Navigate to song page using spotify track id
    navigate(`/song/${song.id}`)
  }

  return (
    <LibraryView
      sections={sections()}
      isLoading={songsQuery.isLoading}
      onSongClick={handleSongClick}
    />
  )
}
