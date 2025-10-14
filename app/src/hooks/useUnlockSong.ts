/**
 * useUnlockSong Hook
 *
 * Simple hook for unlocking a song (running base-alignment).
 * This is PAID and requires credits.
 *
 * Responsibilities:
 * - Deduct credits via contract (unlockSong)
 * - Run base-alignment Lit Action
 * - Return unlock status and results
 * - Refresh credits cache after transaction
 *
 * Error Handling:
 * - Throws InsufficientCreditsError if contract rejects due to insufficient credits
 * - Component should check credits BEFORE calling this to avoid failed transactions
 * - This error is for handling cache staleness (when frontend thinks user has credits but contract disagrees)
 */

import { useState, useCallback, useRef } from 'react'
import type { PKPAuthContext } from '@/lib/lit/auth/auth-pkp'
import { useCredits } from '@/contexts/CreditsContext'

export class InsufficientCreditsError extends Error {
  constructor(message = 'Insufficient credits to unlock this song') {
    super(message)
    this.name = 'InsufficientCreditsError'
  }
}

export interface UnlockSongResult {
  success: boolean
  alignmentResult?: any
  creditsSpent?: number
  remainingBalance?: number
  txHash?: string
  error?: string
}

export interface UseUnlockSongOptions {
  geniusId: number
  pkpAuthContext: PKPAuthContext | null
  pkpInfo: any | null
  isFree?: boolean
}

export function useUnlockSong({ geniusId, pkpAuthContext, pkpInfo, isFree }: UseUnlockSongOptions) {
  const { credits, loadCredits } = useCredits()
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [result, setResult] = useState<UnlockSongResult | null>(null)

  // Prevent duplicate calls
  const isRunningRef = useRef(false)

  const unlockSong = useCallback(async (): Promise<UnlockSongResult> => {
    // Guard against duplicate calls
    if (isRunningRef.current) {
      console.log('[useUnlockSong] Already unlocking, skipping...')
      return { success: false, error: 'Already unlocking' }
    }

    if (!pkpAuthContext || !pkpInfo) {
      const error = 'PKP auth context not available'
      console.error('[useUnlockSong]', error)
      setUnlockError(error)
      return { success: false, error }
    }

    isRunningRef.current = true
    setIsUnlocking(true)
    setUnlockError(null)

    try {
      // 1. Wait for contract indexing (if song was just cataloged)
      // Base Sepolia needs time to index new catalog entries before unlock can be called
      await new Promise(resolve => setTimeout(resolve, 5000))

      // 2. Unlock song in contract (will throw InsufficientCreditsError if no credits)
      console.log('[useUnlockSong] Unlocking song in contract...', { geniusId })
      const { unlockSong: unlockSongInContract } = await import('@/lib/credits/spend')
      const unlockResult = await unlockSongInContract({
        geniusId,
        segmentCount: 1, // 1 credit per song unlock
        pkpAuthContext,
        pkpInfo,
      })

      if (!unlockResult.success) {
        throw new Error(unlockResult.error || 'Failed to unlock song in contract')
      }

      // Check if song was already owned (idempotent case)
      const wasAlreadyOwned = unlockResult.error === 'Song already unlocked'

      const txHash = unlockResult.txHash
      const creditsSpent = unlockResult.creditsSpent || 0
      const remainingBalance = unlockResult.remainingBalance || 0

      if (wasAlreadyOwned) {
        console.log('[useUnlockSong] ✅ Song already owned, skipping base-alignment')
        const successResult: UnlockSongResult = {
          success: true,
          creditsSpent: 0,
          remainingBalance,
        }
        setResult(successResult)
        return successResult
      }

      console.log('[useUnlockSong] ✅ Credits deducted', {
        spent: creditsSpent,
        remaining: remainingBalance,
        txHash,
      })

      // Refresh credits context
      await loadCredits()

      // 3. Run base-alignment
      console.log('[useUnlockSong] Running base-alignment...', { geniusId })
      const { executeBaseAlignment } = await import('@/lib/lit/actions')
      const alignmentResult = await executeBaseAlignment(
        geniusId,
        pkpAuthContext
      )

      if (!alignmentResult.success) {
        throw new Error(alignmentResult.error || 'Base alignment failed')
      }

      console.log('[useUnlockSong] ✅ Unlock complete!', {
        metadataUri: alignmentResult.metadataUri,
      })

      const successResult: UnlockSongResult = {
        success: true,
        alignmentResult: alignmentResult,
        creditsSpent,
        remainingBalance,
        txHash,
      }

      setResult(successResult)
      return successResult

    } catch (err) {
      // Re-throw InsufficientCreditsError so component can show credit dialog
      if (err instanceof InsufficientCreditsError) {
        throw err
      }

      const errorMsg = err instanceof Error ? err.message : 'Failed to unlock song'
      console.error('[useUnlockSong] ❌ Error:', errorMsg)
      setUnlockError(errorMsg)

      const errorResult: UnlockSongResult = { success: false, error: errorMsg }
      setResult(errorResult)
      return errorResult

    } finally {
      isRunningRef.current = false
      setIsUnlocking(false)
      // Always refresh credits after transaction (success or failure)
      // This ensures cache stays in sync with contract state
      await loadCredits()
    }
  }, [geniusId, pkpAuthContext, pkpInfo, isFree, loadCredits])

  return {
    unlockSong,
    isUnlocking,
    unlockError,
    result,
  }
}
