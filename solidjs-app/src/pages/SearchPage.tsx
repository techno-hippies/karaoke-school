/**
 * SearchPage - Library view with organized sections
 *
 * Shows songs organized by:
 * - Featured artists (their own sections)
 * - Trending (everything else)
 */

import { type Component, createMemo } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { useKaraokeSongsSearch, type KaraokeSong } from '@/hooks/useKaraokeSongs'
import { LibraryView, type LibrarySong, type LibrarySection } from '@/components/search/LibraryView'

// Featured artists that get their own sections
const FEATURED_ARTISTS = ['Beyoncé', 'Queen', 'Taylor Swift', 'Britney Spears']

// Generate URL-friendly slug
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Extended song type with slugs for routing
interface LibrarySongWithSlug extends LibrarySong {
  artistSlug: string
  songSlug: string
}

function transformToLibrarySong(karaokeSong: KaraokeSong): LibrarySongWithSlug {
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

export const SearchPage: Component = () => {
  const navigate = useNavigate()

  const songsQuery = useKaraokeSongsSearch(
    () => '',
    () => ({ first: 50, hasInstrumental: true })
  )

  const sections = createMemo<LibrarySection[]>(() => {
    if (!songsQuery.data) return []
    const songs = songsQuery.data.map(transformToLibrarySong)
    return groupSongsIntoSections(songs)
  })

  const handleSongClick = (song: LibrarySong) => {
    const songWithSlug = song as LibrarySongWithSlug
    navigate(`/${songWithSlug.artistSlug}/${songWithSlug.songSlug}`)
  }

  return (
    <LibraryView
      sections={sections()}
      isLoading={songsQuery.isLoading}
      onSongClick={handleSongClick}
    />
  )
}
