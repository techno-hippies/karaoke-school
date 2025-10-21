import { useReadContract } from 'wagmi'
import type { Address } from 'viem'
import { CONTRACTS } from '@/lib/contracts/addresses'
import { ABIS } from '@/lib/contracts/abis'

export interface Segment {
  geniusId: number
  tiktokSegmentId: string
  startTime: number
  endTime: number
  duration: number
  vocalsUri: string
  instrumentalUri: string
  alignmentUri: string
  coverUri: string
  processed: boolean
  enabled: boolean
  createdAt: bigint
  processedAt: bigint
}

/**
 * Get a segment by its hash
 */
export function useSegment(segmentHash?: `0x${string}`) {
  return useReadContract({
    address: CONTRACTS.SegmentRegistryV1 as Address,
    abi: ABIS.SegmentRegistryV1,
    functionName: 'getSegment',
    args: segmentHash ? [segmentHash] : undefined,
    query: {
      enabled: !!segmentHash,
    },
  })
}

/**
 * Get all segments for a song by genius ID
 */
export function useSegmentsBySong(geniusId?: number) {
  return useReadContract({
    address: CONTRACTS.SegmentRegistryV1 as Address,
    abi: ABIS.SegmentRegistryV1,
    functionName: 'getSegmentsBySong',
    args: geniusId ? [geniusId] : undefined,
    query: {
      enabled: !!geniusId && geniusId > 0,
    },
  })
}

/**
 * Check if a segment exists
 */
export function useSegmentExists(segmentHash?: `0x${string}`) {
  return useReadContract({
    address: CONTRACTS.SegmentRegistryV1 as Address,
    abi: ABIS.SegmentRegistryV1,
    functionName: 'segmentExists',
    args: segmentHash ? [segmentHash] : undefined,
    query: {
      enabled: !!segmentHash,
    },
  })
}

/**
 * Get total number of segments
 */
export function useTotalSegments() {
  return useReadContract({
    address: CONTRACTS.SegmentRegistryV1 as Address,
    abi: ABIS.SegmentRegistryV1,
    functionName: 'getTotalSegments',
  })
}
