import { useQuery } from '@tanstack/react-query'
import { convertGroveUri } from '@/lib/lens/utils'

/**
 * Segment metadata from Grove
 * Supports both OLD format (inline lyrics) and NEW format (separate translation files)
 */
export interface SegmentMetadata {
  // Standard fields
  version: string
  type: string
  geniusId: number
  tiktokSegmentId: string
  segmentHash: string
  startTime: number
  endTime: number
  duration: number
  lyrics: {
    original: {
      language: string
      lines: Array<{
        startTime: number
        endTime: number
        words: Array<{
          word: string
          startTime: number
          endTime: number
        }>
      }>
    }
    translations?: {
      [language: string]: {
        lines: Array<{
          startTime: number
          endTime: number
          words: Array<{
            word: string
            startTime: number
            endTime: number
          }>
        }>
      }
    }
  }
  registeredBy: string
  sourceVideoUrl?: string

  // NEW FORMAT FIELDS (from karaoke-pipeline)
  segment_hash?: string
  grc20_work_id?: string
  spotify_track_id?: string
  title?: string
  artist?: string
  timing?: {
    full_segment_start_ms?: number
    full_segment_end_ms?: number
    full_segment_duration_ms?: number
    tiktok_clip_start_ms?: number
    tiktok_clip_end_ms?: number
    tiktok_clip_duration_ms?: number
    cropped_duration_ms?: number // For backwards compatibility
  }
  assets?: {
    instrumental: string
    full_instrumental?: string
    alignment: string
  }
  translations?: Array<{
    language_code: string
    grove_url: string
  }>
}

/**
 * Transform Grove segment format to frontend format
 * Handles BOTH old format (inline lyrics) and new format (separate translation files)
 */
function transformSegmentMetadata(groveData: any): SegmentMetadata {
  console.log('[transformSegmentMetadata] Input Grove data:', groveData)

  // Handle OLD format: lyrics.languages.{en,vi,zh}
  if (groveData.lyrics?.languages) {
    console.log('[transformSegmentMetadata] Detected OLD format with inline lyrics')
    const languages = groveData.lyrics.languages || {}
    const languageKeys = Object.keys(languages)

    const originalLang = languageKeys[0] || 'en'
    const original = languages[originalLang]
    const translations: any = {}
    languageKeys.slice(1).forEach((lang) => {
      translations[lang] = languages[lang]
    })

    return {
      ...groveData,
      lyrics: {
        original: original || { language: originalLang, lines: [] },
        translations: Object.keys(translations).length > 0 ? translations : undefined,
      },
    }
  }

  // Handle NEW format: timing.tiktok_clip_*, assets.instrumental, translations[]
  if (groveData.timing?.tiktok_clip_duration_ms && groveData.translations) {
    console.log('[transformSegmentMetadata] Detected NEW format with separate translation files')
    console.log('[transformSegmentMetadata] Title:', groveData.title, 'Artist:', groveData.artist)
    console.log('[transformSegmentMetadata] Clip timing:', groveData.timing.tiktok_clip_start_ms, '-', groveData.timing.tiktok_clip_end_ms)
    console.log('[transformSegmentMetadata] Instrumental URL:', groveData.assets.instrumental)
    console.log('[transformSegmentMetadata] Translations:', groveData.translations)

    // For NEW format, return as-is (app will fetch translations separately)
    // Map clip timing to expected format
    return {
      version: 'v2',
      type: 'karaoke-segment',
      geniusId: 0,
      tiktokSegmentId: groveData.spotify_track_id,
      segmentHash: groveData.segment_hash,
      startTime: groveData.timing.tiktok_clip_start_ms,
      endTime: groveData.timing.tiktok_clip_end_ms,
      duration: groveData.timing.tiktok_clip_duration_ms,
      // These are filled in by MediaPageContainer which will fetch translations
      lyrics: {
        original: { language: 'en', lines: [] },
        translations: undefined,
      },
      registeredBy: 'karaoke-pipeline',
      // Store original data for access
      ...groveData,
    }
  }

  console.warn('[transformSegmentMetadata] Unknown metadata format, returning as-is:', groveData)

  // Fallback for unknown format
  return {
    ...groveData,
    lyrics: {
      original: { language: 'en', lines: [] },
      translations: undefined,
    },
  }
}

/**
 * Fetch segment metadata from Grove storage
 *
 * @param metadataUri - Grove URI (lens://...)
 * @returns Segment metadata including lyrics and timing
 */
export function useSegmentMetadata(metadataUri?: string) {
  return useQuery({
    queryKey: ['grove-segment-metadata', metadataUri],
    queryFn: async () => {
      if (!metadataUri) {
        throw new Error('Metadata URI is required')
      }

      const httpUrl = convertGroveUri(metadataUri)
      const response = await fetch(httpUrl)

      if (!response.ok) {
        throw new Error(`Failed to fetch segment metadata: ${response.status}`)
      }

      const groveData = await response.json()
      const transformed = transformSegmentMetadata(groveData)
      return transformed
    },
    enabled: !!metadataUri,
    staleTime: 300000, // 5 minutes (segment metadata is immutable)
    refetchOnWindowFocus: false,
  })
}
