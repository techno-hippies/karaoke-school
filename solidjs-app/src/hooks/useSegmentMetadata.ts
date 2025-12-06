import { createQuery } from '@tanstack/solid-query'
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
  clipId: string
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
  coverUri?: string
  thumbnailUri?: string
  timing?: {
    full_duration_ms?: number
    free_clip_start_ms?: number
    free_clip_end_ms?: number
    free_clip_duration_ms?: number
  }
  assets?: {
    instrumental: string
    full_instrumental?: string
    fullInstrumental?: string
    alignment: string
  }
  translations?: Array<{
    language_code: string
    grove_url: string
    clip_grove_url?: string
  }>
  karaoke_lines?: Array<{
    line_index: number
    start_ms: number | string
    end_ms: number | string
    original_text?: string
    text?: string
    zh_text?: string
    vi_text?: string
    id_text?: string
    words?: Array<{
      text?: string
      word?: string
      start_ms?: number
      end_ms?: number
      start?: number
      end?: number
    }>
    [key: string]: unknown
  }>
  full_karaoke_lines?: Array<{
    line_index: number
    start_ms: number | string
    end_ms: number | string
    original_text?: string
    text?: string
    zh_text?: string
    vi_text?: string
    id_text?: string
    words?: Array<{
      text?: string
      word?: string
      start_ms?: number
      end_ms?: number
      start?: number
      end?: number
    }>
    [key: string]: unknown
  }>
  encryption?: {
    encryptionMetadataUri?: string
  }
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

  // Handle KARAOKE-CLIP format (v2.0.0): type='karaoke-clip', timing.clipStartMs/clipEndMs
  if (groveData.type === 'karaoke-clip' && groveData.timing?.clipEndMs !== undefined) {
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
      full_karaoke_lines: groveData.full_karaoke_lines,
      encryption: groveData.encryption,
      ...groveData,
    }
  }

  console.warn('[useSegmentMetadata] Unknown metadata format, returning as-is')

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
 * @param metadataUri - Accessor returning Grove URI (lens://...)
 * @returns Segment metadata including lyrics and timing
 */
export function useSegmentMetadata(metadataUri: () => string | undefined) {
  return createQuery(() => ({
    queryKey: ['grove-segment-metadata', metadataUri()],
    queryFn: async () => {
      const uri = metadataUri()
      if (!uri) {
        throw new Error('Metadata URI is required')
      }

      const httpUrl = convertGroveUri(uri)
      const response = await fetch(httpUrl)

      if (!response.ok) {
        throw new Error(`Failed to fetch segment metadata: ${response.status}`)
      }

      const groveData = await response.json()
      const transformed = transformSegmentMetadata(groveData)
      return transformed
    },
    enabled: !!metadataUri(),
    staleTime: 300000, // 5 minutes (segment metadata is immutable)
    refetchOnWindowFocus: false,
  }))
}
