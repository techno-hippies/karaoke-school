import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { LibraryView, type LibrarySong, type LibrarySection } from '@/components/search/LibraryView'
import { useKaraokeSongsSearchWithMetadata } from '@/hooks/useKaraokeSongsSearch'
import { generateSlug } from '@/hooks/useSongSlug'

// Extended song type with slugs for routing
interface LibrarySongWithSlug extends LibrarySong {
  artistSlug: string
  songSlug: string
}

// Featured artists that get their own sections
const FEATURED_ARTISTS = ['Beyoncé', 'Queen']

function transformToLibrarySong(karaokeSong: any): LibrarySongWithSlug {
  const artistSlug = generateSlug(karaokeSong.artist || 'unknown')
  const songSlug = generateSlug(karaokeSong.title || 'unknown')

  return {
    id: karaokeSong.spotifyTrackId,
    title: karaokeSong.title,
    artist: karaokeSong.artist,
    artworkUrl: karaokeSong.artworkUrl || '',
    artistSlug,
    songSlug,
  }
}

function groupSongsIntoSections(songs: LibrarySongWithSlug[]): LibrarySection[] {
  const sections: LibrarySection[] = []
  const usedSongIds = new Set<string>()

  // Create sections for featured artists
  for (const artistName of FEATURED_ARTISTS) {
    const artistSongs = songs.filter(
      (s) => s.artist.toLowerCase() === artistName.toLowerCase()
    )
    if (artistSongs.length > 0) {
      sections.push({
        id: generateSlug(artistName),
        title: artistName,
        songs: artistSongs,
        showArtist: false,
      })
      artistSongs.forEach((s) => usedSongIds.add(s.id))
    }
  }

  // Remaining songs go to Trending
  const trendingSongs = songs.filter((s) => !usedSongIds.has(s.id))
  if (trendingSongs.length > 0) {
    sections.push({
      id: 'trending',
      title: 'Trending',
      songs: trendingSongs,
      showArtist: true,
    })
  }

  return sections
}

export function SearchPage() {
  const navigate = useNavigate()

  const { data: karaokeSongs, isLoading } = useKaraokeSongsSearchWithMetadata('', {
    hasInstrumental: true,
    first: 50,
  })

  const sections = useMemo(() => {
    if (!karaokeSongs) return []
    const songs = karaokeSongs.map(transformToLibrarySong)
    return groupSongsIntoSections(songs)
  }, [karaokeSongs])

  const handleSongClick = (song: LibrarySong) => {
    const songWithSlug = song as LibrarySongWithSlug
    navigate(`/${songWithSlug.artistSlug}/${songWithSlug.songSlug}`)
  }

  return (
    <LibraryView
      sections={sections}
      isLoading={isLoading}
      onSongClick={handleSongClick}
    />
  )
}
