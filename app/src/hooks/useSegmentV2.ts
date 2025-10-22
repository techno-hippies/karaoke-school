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

      const data = await response.json() as SegmentMetadata
      return data
    },
    enabled: !!metadataUri,
    staleTime: 300000, // 5 minutes (segment metadata is immutable)
    refetchOnWindowFocus: false,
  })
}
