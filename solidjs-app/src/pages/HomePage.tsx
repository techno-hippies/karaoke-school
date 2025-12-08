import { type Component, createMemo } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { LibraryView, type LibrarySection, type LibrarySong } from '@/components/library/LibraryView'
import { useKaraokeSongs } from '@/hooks/useKaraokeSongs'
import { useTranslation } from '@/lib/i18n'

export const HomePage: Component = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Fetch real songs from subgraph
  const songsQuery = useKaraokeSongs(() => ({ first: 50, hasInstrumental: true }))

  // Transform songs into sections
  const sections = createMemo(() => {
    const songs = songsQuery.data
    if (!songs?.length) return []

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

    const result: LibrarySection[] = [
      {
        id: 'recent',
        title: t('home.recentlyAdded'),
        songs: recent,
      },
    ]

    if (rest.length > 0) {
      result.push({
        id: 'all',
        title: t('home.allSongs'),
        songs: rest,
      })
    }

    return result
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
