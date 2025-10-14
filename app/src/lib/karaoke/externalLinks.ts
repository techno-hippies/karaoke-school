/**
 * External Links Utilities
 * Constructs external song and lyrics links from song metadata
 */

export interface ExternalLink {
  label: string
  url: string
}

export interface SongMetadata {
  geniusId?: number
  title: string
  artist: string
  soundcloudPermalink?: string
  youtubeUrl?: string
  spotifyUuid?: string
  appleMusicId?: string
  appleMusicPlayerUrl?: string
}

/**
 * Create URL-friendly slug by replacing spaces with hyphens
 */
function createSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
}

/**
 * Create Genius-style lyrics slug (preserves case, replaces spaces)
 */
function createLyricsSlug(artist: string, title: string): string {
  return `${artist.replace(/\s+/g, '-')}-${title.replace(/\s+/g, '-')}-lyrics`
}

/**
 * Build external song links (SoundCloud, Maid.zone)
 * Only includes links if soundcloudPermalink is available
 */
export function buildExternalSongLinks(song: SongMetadata): ExternalLink[] {
  const links: ExternalLink[] = []

  if (song.youtubeUrl) {
    links.push({
      label: 'YouTube',
      url: song.youtubeUrl
    })
  }

  if (song.spotifyUuid) {
    links.push({
      label: 'Spotify',
      url: `https://open.spotify.com/track/${song.spotifyUuid}`
    })
  }

  if (song.appleMusicId || song.appleMusicPlayerUrl) {
    const appleUrl = song.appleMusicPlayerUrl || `https://music.apple.com/us/album/${song.appleMusicId}`
    links.push({
      label: 'Apple Music',
      url: appleUrl
    })
  }

  if (song.soundcloudPermalink) {
    links.push({
      label: 'SoundCloud',
      url: `https://soundcloud.com/${song.soundcloudPermalink}`
    })
    links.push({
      label: 'Maid.zone',
      url: `https://maid.zone/${song.soundcloudPermalink}`
    })
  }

  return links
}

/**
 * Build external lyrics links (Genius, Intellectual, Dumb)
 * Only includes links if geniusId is available
 */
export function buildExternalLyricsLinks(song: SongMetadata): ExternalLink[] {
  const links: ExternalLink[] = []

  if (song.geniusId) {
    const lyricsSlug = createLyricsSlug(song.artist, song.title)

    links.push({
      label: 'Genius',
      url: `https://genius.com/${lyricsSlug}`
    })
    links.push({
      label: 'Intellectual',
      url: `https://intellectual.insprill.net/${lyricsSlug}?id=${song.geniusId}`
    })
    links.push({
      label: 'Dumb',
      url: `https://dm.vern.cc/${lyricsSlug}`
    })
  }

  return links
}
