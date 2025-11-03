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
  coverUri?: string // Album artwork/cover image (Grove URI)
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
    console.log('[transformSegmentMetadata] Full groveData keys:', Object.keys(groveData))
    console.log('[transformSegmentMetadata] ⚠️  coverUri in data?', groveData.coverUri ? 'YES' : 'NO')
    console.log('[transformSegmentMetadata] ⚠️  coverUri value:', groveData.coverUri)

    // For NEW format, return as-is (app will fetch translations separately)
    // Map clip timing to expected format
    const transformed = {
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

    console.log('[transformSegmentMetadata] ⚠️  Final coverUri:', transformed.coverUri)
    console.log('[transformSegmentMetadata] ⚠️  Final transformed keys:', Object.keys(transformed))
    return transformed
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

      console.log('[useSegmentMetadata] Fetching metadata from:', metadataUri)
      const httpUrl = convertGroveUri(metadataUri)
      console.log('[useSegmentMetadata] Converted to HTTP URL:', httpUrl)
      const response = await fetch(httpUrl)

      if (!response.ok) {
        throw new Error(`Failed to fetch segment metadata: ${response.status}`)
      }

      const groveData = await response.json()
      console.log('[useSegmentMetadata] ⚠️  Raw Grove data:', groveData)
      console.log('[useSegmentMetadata] ⚠️  Keys in Grove data:', Object.keys(groveData))
      const transformed = transformSegmentMetadata(groveData)
      console.log('[useSegmentMetadata] ⚠️  Transformed data:', transformed)
      return transformed
    },
    enabled: !!metadataUri,
    staleTime: 300000, // 5 minutes (segment metadata is immutable)
    refetchOnWindowFocus: false,
  })
}

/**
 * Fetch English translation text from Grove
 * Used when segment metadata has separate translation files (new format)
 */
export function useEnglishTranslation(translationUri?: string) {
  return useQuery({
    queryKey: ['english-translation', translationUri],
    queryFn: async () => {
      if (!translationUri) {
        throw new Error('Translation URI is required')
      }

      const httpUrl = convertGroveUri(translationUri)
      const response = await fetch(httpUrl)

      if (!response.ok) {
        throw new Error(`Failed to fetch translation: ${response.status}`)
      }

      const data = await response.json()

      // Extract text from lines: join all words from all lines
      if (data.lines && Array.isArray(data.lines)) {
        const text = data.lines
          .map((line: any) => {
            if (line.words && Array.isArray(line.words)) {
              return line.words.map((w: any) => w.word || w.text).join(' ')
            }
            return line.translatedText || line.originalText || ''
          })
          .join(' ')
          .substring(0, 100)

        return text
      }

      return ''
    },
    enabled: !!translationUri,
    staleTime: 300000, // 5 minutes (immutable)
    refetchOnWindowFocus: false,
  })
}
