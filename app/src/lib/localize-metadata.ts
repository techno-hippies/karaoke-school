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
 * Supports 12 languages: zh, vi, id, ja, ko, es, pt, ar, tr, ru, hi, th
 */
interface LocalizableMetadata {
  title?: string
  title_zh?: string
  title_vi?: string
  title_id?: string
  title_ja?: string
  title_ko?: string
  title_es?: string
  title_pt?: string
  title_ar?: string
  title_tr?: string
  title_ru?: string
  title_hi?: string
  title_th?: string
  artist?: string
  artist_zh?: string
  artist_vi?: string
  artist_id?: string
  artist_ja?: string
  artist_ko?: string
  artist_es?: string
  artist_pt?: string
  artist_ar?: string
  artist_tr?: string
  artist_ru?: string
  artist_hi?: string
  artist_th?: string
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
    case 'ja':
      return metadata.title_ja || metadata.title
    case 'ko':
      return metadata.title_ko || metadata.title
    case 'es':
      return metadata.title_es || metadata.title
    case 'pt':
      return metadata.title_pt || metadata.title
    case 'ar':
      return metadata.title_ar || metadata.title
    case 'tr':
      return metadata.title_tr || metadata.title
    case 'ru':
      return metadata.title_ru || metadata.title
    case 'hi':
      return metadata.title_hi || metadata.title
    case 'th':
      return metadata.title_th || metadata.title
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
    case 'ja':
      return metadata.artist_ja || metadata.artist
    case 'ko':
      return metadata.artist_ko || metadata.artist
    case 'es':
      return metadata.artist_es || metadata.artist
    case 'pt':
      return metadata.artist_pt || metadata.artist
    case 'ar':
      return metadata.artist_ar || metadata.artist
    case 'tr':
      return metadata.artist_tr || metadata.artist
    case 'ru':
      return metadata.artist_ru || metadata.artist
    case 'hi':
      return metadata.artist_hi || metadata.artist
    case 'th':
      return metadata.artist_th || metadata.artist
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
