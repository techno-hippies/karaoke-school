/**
 * Localize Metadata Helper
 *
 * Selects the appropriate song title and artist name based on UI language.
 * Falls back to English if translation not available.
 */

import type { UILanguage } from './i18n'

/**
 * Minimal interface for metadata with localized fields
 * Works with both SongMetadata and SegmentMetadata
 */
interface LocalizableMetadata {
  title?: string
  title_zh?: string
  title_vi?: string
  title_id?: string
  artist?: string
  artist_zh?: string
  artist_vi?: string
  artist_id?: string
}

/**
 * Get localized song title based on UI language
 */
export function getLocalizedTitle(
  metadata: LocalizableMetadata | undefined,
  uiLanguage: UILanguage
): string | undefined {
  if (!metadata) return undefined

  switch (uiLanguage) {
    case 'zh':
      return metadata.title_zh || metadata.title
    case 'vi':
      return metadata.title_vi || metadata.title
    case 'id':
      return metadata.title_id || metadata.title
    default:
      return metadata.title
  }
}

/**
 * Get localized artist name based on UI language
 */
export function getLocalizedArtist(
  metadata: LocalizableMetadata | undefined,
  uiLanguage: UILanguage
): string | undefined {
  if (!metadata) return undefined

  switch (uiLanguage) {
    case 'zh':
      return metadata.artist_zh || metadata.artist
    case 'vi':
      return metadata.artist_vi || metadata.artist
    case 'id':
      return metadata.artist_id || metadata.artist
    default:
      return metadata.artist
  }
}

/**
 * Get both localized title and artist
 */
export function getLocalizedSongInfo(
  metadata: LocalizableMetadata | undefined,
  uiLanguage: UILanguage
): { title?: string; artist?: string } {
  return {
    title: getLocalizedTitle(metadata, uiLanguage),
    artist: getLocalizedArtist(metadata, uiLanguage),
  }
}
