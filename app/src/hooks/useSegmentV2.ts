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
  clipId: string // Spotify track ID or clip identifier
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
  spotify_track_id?: string
  title?: string
  artist?: string
  coverUri?: string // Album artwork/cover image (Grove URI)
  timing?: {
    full_duration_ms?: number
    free_clip_start_ms?: number
    free_clip_end_ms?: number
    free_clip_duration_ms?: number
  }
  assets?: {
    instrumental: string
    full_instrumental?: string
    fullInstrumental?: string // camelCase variant from newer schema
    alignment: string
  }
  translations?: Array<{
    language_code: string
    grove_url: string
  }>
  karaoke_lines?: Array<{
    line_index: number
    start_ms: number | string
    end_ms: number | string
    original_text?: string
    text?: string
    [key: string]: unknown
  }>
  full_karaoke_lines?: Array<{
    line_index: number
    start_ms: number | string
    end_ms: number | string
    original_text?: string
    text?: string
    [key: string]: unknown
  }>
}

/**
 * Transform Grove segment format to frontend format
 * Handles BOTH old format (inline lyrics) and new format (separate translation files)
 */
function transformSegmentMetadata(groveData: any): SegmentMetadata {
  // Handle OLD format: lyrics.languages.{en,vi,zh}
  if (groveData.lyrics?.languages) {
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

  // Handle LEGACY format: timing.free_clip_*, assets.instrumental, translations[]
  // (Previously used tiktok_clip_* naming)
  if ((groveData.timing?.free_clip_duration_ms || groveData.timing?.tiktok_clip_duration_ms) && groveData.translations) {
    const freeClipStart = groveData.timing.free_clip_start_ms ?? groveData.timing.tiktok_clip_start_ms
    const freeClipEnd = groveData.timing.free_clip_end_ms ?? groveData.timing.tiktok_clip_end_ms
    const freeClipDuration = groveData.timing.free_clip_duration_ms ?? groveData.timing.tiktok_clip_duration_ms

    return {
      version: 'v2',
      type: 'karaoke-segment',
      geniusId: 0,
      clipId: groveData.spotify_track_id,
      segmentHash: groveData.segment_hash,
      startTime: freeClipStart,
      endTime: freeClipEnd,
      duration: freeClipDuration,
      lyrics: {
        original: { language: 'en', lines: [] },
        translations: undefined,
      },
      registeredBy: 'karaoke-pipeline',
      ...groveData,
    }
  }

  // Handle KARAOKE-CLIP format (v2.0.0): type='karaoke-clip', timing.clipStartMs/clipEndMs, assets.clipInstrumental
  if (groveData.type === 'karaoke-clip' && groveData.timing?.clipEndMs !== undefined) {

    // Use actual karaoke_lines if present, otherwise fallback to lyricsPreview
    const karaoke_lines = groveData.karaoke_lines || groveData.lyricsPreview?.map((line: any) => ({
      line_index: line.index,
      start_ms: line.startMs,
      end_ms: line.endMs,
      original_text: line.text,
      text: line.text,
    })) || []

    const freeClipDuration = groveData.timing.clipEndMs - groveData.timing.clipStartMs

    return {
      version: groveData.version || 'v2.0.0',
      type: 'karaoke-clip',
      geniusId: 0,
      clipId: groveData.spotifyTrackId,
      segmentHash: groveData.clipHash,
      startTime: groveData.timing.clipStartMs,
      endTime: groveData.timing.clipEndMs,
      duration: freeClipDuration,
      lyrics: {
        original: { language: 'en', lines: [] },
        translations: undefined,
      },
      registeredBy: 'karaoke-pipeline',
      // Map to expected field names
      spotify_track_id: groveData.spotifyTrackId,
      title: groveData.title,
      artist: groveData.artist,
      coverUri: groveData.coverUri,
      thumbnailUri: groveData.thumbnailUri,
      timing: {
        free_clip_start_ms: groveData.timing.clipStartMs,
        free_clip_end_ms: groveData.timing.clipEndMs,
        free_clip_duration_ms: freeClipDuration,
        full_duration_ms: groveData.timing.fullDurationMs,
      },
      assets: {
        instrumental: groveData.assets?.clipInstrumental,
        full_instrumental: groveData.assets?.fullInstrumental,
        alignment: groveData.assets?.alignment,
      },
      karaoke_lines,
      // Pass through encryption data
      encryption: groveData.encryption,
      // Original data for reference
      ...groveData,
    }
  }

  console.warn('[useSegmentV2] Unknown metadata format, returning as-is')

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

