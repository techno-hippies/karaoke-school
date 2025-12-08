/**
 * SearchPage - Library view with organized sections
 *
 * Shows songs organized by:
 * - Featured artists (their own sections)
 * - Trending (everything else)
 */

import { type Component, createMemo } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { useKaraokeSongsWithMetadata, type KaraokeSong } from '@/hooks/useKaraokeSongs'
import { useTranslation } from '@/lib/i18n'
import { getLocalizedTitle, getLocalizedArtist } from '@/lib/localize-metadata'
import { LibraryView, type LibrarySong, type LibrarySection } from '@/components/search/LibraryView'
import type { UILanguage } from '@/lib/i18n'

// Featured artists that get their own sections (English names for matching)
const FEATURED_ARTISTS = ['Beyoncé', 'Queen', 'Taylor Swift', 'Britney Spears']

// Localized section titles for featured artists
const FEATURED_ARTISTS_LOCALIZED: Record<string, Record<UILanguage, string>> = {
  'Beyoncé': { en: 'Beyoncé', zh: '碧昂丝', vi: 'Beyoncé', id: 'Beyoncé' },
  'Queen': { en: 'Queen', zh: '皇后乐队', vi: 'Queen', id: 'Queen' },
  'Taylor Swift': { en: 'Taylor Swift', zh: '泰勒·斯威夫特', vi: 'Taylor Swift', id: 'Taylor Swift' },
  'Britney Spears': { en: 'Britney Spears', zh: '布兰妮·斯皮尔斯', vi: 'Britney Spears', id: 'Britney Spears' },
}

// Generate URL-friendly slug (always use English name)
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
  artistEnglish: string // Keep English name for section matching
}

function transformToLibrarySong(karaokeSong: KaraokeSong, uiLanguage: UILanguage): LibrarySongWithSlug {
  // Always use English for slugs (URL routing)
  const artistSlug = generateSlug(karaokeSong.artist || 'unknown')
  const songSlug = generateSlug(karaokeSong.title || 'unknown')

  // Get localized display names
  const localizedTitle = getLocalizedTitle(karaokeSong, uiLanguage) || karaokeSong.title
  const localizedArtist = getLocalizedArtist(karaokeSong, uiLanguage) || karaokeSong.artist

  return {
    id: karaokeSong.spotifyTrackId,
    title: localizedTitle,
    artist: localizedArtist,
    artworkUrl: karaokeSong.artworkUrl || '',
    artistSlug,
    songSlug,
    artistEnglish: karaokeSong.artist, // Keep English for section matching
  }
}

function groupSongsIntoSections(songs: LibrarySongWithSlug[], uiLanguage: UILanguage): LibrarySection[] {
  const sections: LibrarySection[] = []
  const usedSongIds = new Set<string>()

  // Create sections for featured artists
  for (const artistName of FEATURED_ARTISTS) {
    const artistSongs = songs.filter(
      (s) => s.artistEnglish.toLowerCase() === artistName.toLowerCase()
    )
    if (artistSongs.length > 0) {
      // Get localized section title
      const sectionTitle = FEATURED_ARTISTS_LOCALIZED[artistName]?.[uiLanguage] || artistName
      sections.push({
        id: generateSlug(artistName),
        title: sectionTitle,
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
  const { uiLanguage } = useTranslation()

  // Use enriched query that fetches Grove metadata (includes localized names)
  const songsQuery = useKaraokeSongsWithMetadata(
    () => ({ first: 50, hasInstrumental: true })
  )

  const sections = createMemo<LibrarySection[]>(() => {
    if (!songsQuery.data) return []
    const songs = songsQuery.data.map(song => transformToLibrarySong(song, uiLanguage()))
    return groupSongsIntoSections(songs, uiLanguage())
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
