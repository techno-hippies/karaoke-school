/**
 * useCatalogSong Hook
 *
 * Simple hook for running match-and-segment on a song.
 * This is FREE and runs automatically on page load.
 *
 * Responsibilities:
 * - Check if song is already cataloged in contract
 * - Run match-and-segment Lit Action if needed
 * - Return cataloging status and results
 */

import { useState, useCallback, useRef } from 'react'
import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'
import { BASE_SEPOLIA_CONTRACTS } from '@/config/contracts'
import { KARAOKE_CATALOG_ABI } from '@/config/abis/karaokeCatalog'
import type { PKPAuthContext } from '@/lib/lit/auth/auth-pkp'

export interface CatalogSongResult {
  success: boolean
  txHash?: string
  sections?: Array<{ type: string; startTime: number; endTime: number; duration: number }>
  soundcloudPermalink?: string
  songDuration?: number
  hasFullAudio?: boolean
  error?: string
}

export interface UseCatalogSongOptions {
  geniusId: number
  pkpAuthContext: PKPAuthContext | null
  artist: string
  title: string
}

export function useCatalogSong({ geniusId, pkpAuthContext, artist, title }: UseCatalogSongOptions) {
  const [isCataloging, setIsCataloging] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [result, setResult] = useState<CatalogSongResult | null>(null)

  // Prevent duplicate calls
  const isRunningRef = useRef(false)

  const catalogSong = useCallback(async (): Promise<CatalogSongResult> => {
    // Guard against duplicate calls
    if (isRunningRef.current) {
      console.log('[useCatalogSong] Already cataloging, skipping...')
      return { success: false, error: 'Already cataloging' }
    }

    if (!pkpAuthContext) {
      const error = 'PKP auth context not available'
      console.error('[useCatalogSong]', error)
      setCatalogError(error)
      return { success: false, error }
    }

    isRunningRef.current = true
    setIsCataloging(true)
    setCatalogError(null)

    try {
      // 1. Check if already cataloged
      console.log('[useCatalogSong] Checking if song exists in contract...', { geniusId })
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      })

      const songExists = await publicClient.readContract({
        address: BASE_SEPOLIA_CONTRACTS.karaokeCatalog,
        abi: KARAOKE_CATALOG_ABI,
        functionName: 'songExistsByGeniusId',
        args: [geniusId],
      }) as boolean

      if (songExists) {
        console.log('[useCatalogSong] ✅ Song already cataloged, fetching hasFullAudio...')

        // Fetch song data to get hasFullAudio value
        const songData = await publicClient.readContract({
          address: BASE_SEPOLIA_CONTRACTS.karaokeCatalog,
          abi: KARAOKE_CATALOG_ABI,
          functionName: 'getSongByGeniusId',
          args: [geniusId],
        }) as any

        const result: CatalogSongResult = {
          success: true,
          hasFullAudio: songData.hasFullAudio
        }
        setResult(result)
        return result
      }

      // 2. Run match-and-segment
      console.log('[useCatalogSong] Running match-and-segment...', { geniusId, artist, title })
      const { executeMatchAndSegment } = await import('@/lib/lit/actions')
      const matchResult = await executeMatchAndSegment(geniusId, pkpAuthContext)

      console.log('[useCatalogSong] Match result:', matchResult)

      if (!matchResult.success) {
        throw new Error(matchResult.error || 'Match-and-segment failed')
      }

      console.log('[useCatalogSong] ✅ Catalog complete!', {
        txHash: matchResult.txHash,
        contractError: matchResult.contractError,
        sections: matchResult.sections?.length || 0,
      })

      const successResult: CatalogSongResult = {
        success: true,
        txHash: matchResult.txHash,
        sections: matchResult.sections,
        soundcloudPermalink: matchResult.soundcloudPermalink,
        songDuration: matchResult.songDuration,
        hasFullAudio: matchResult.hasFullAudio,
      }

      setResult(successResult)
      return successResult

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to catalog song'
      console.error('[useCatalogSong] ❌ Error:', errorMsg)
      setCatalogError(errorMsg)

      const errorResult: CatalogSongResult = { success: false, error: errorMsg }
      setResult(errorResult)
      return errorResult

    } finally {
      isRunningRef.current = false
      setIsCataloging(false)
    }
  }, [geniusId, pkpAuthContext, artist, title])

  return {
    catalogSong,
    isCataloging,
    catalogError,
    result,
  }
}
