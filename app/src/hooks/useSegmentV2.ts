import { useQuery } from '@tanstack/react-query'
import { convertGroveUri } from '@/lib/lens/utils'

/**
 * Segment metadata from Grove
 */
export interface SegmentMetadata {
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
}

/**
 * Transform Grove segment format to frontend format
 * Converts lyrics.languages.{en,vi,zh} to lyrics.original + lyrics.translations
 */
function transformSegmentMetadata(groveData: any): SegmentMetadata {
  // Extract languages from Grove format
  const languages = groveData.lyrics?.languages || {}
  const languageKeys = Object.keys(languages)

  // First language is original (typically 'en')
  const originalLang = languageKeys[0] || 'en'
  const original = languages[originalLang]

  // Remaining languages are translations
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
