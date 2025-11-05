import { useCallback, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LIT_ACTION_IPFS_CID, LIT_ACTION_VOXTRAL_KEY } from '@/lib/contracts/addresses'

/**
 * Call deployed Lit Action to grade a karaoke performance
 *
 * Flow:
 * 1. Lit Action receives base64-encoded user audio
 * 2. Transcribes user audio via Voxtral STT
 * 3. Calculates pronunciation score (Levenshtein distance)
 * 4. Converts score to FSRS rating
 * 5. Returns transcript + score + rating
 * 6. PKP signs PerformanceGrader transaction
 * 7. Emits LinePerformanceGraded event
 *
 * @param userAudioBase64 Base64-encoded user audio data (NOT a URI)
 * @param referenceAudioUri Grove URI of instrumental/reference (for future use)
 * @param expectedText Expected lyrics for scoring context
 * @param segmentHash Bytes32 segment hash identifier
 * @param metadataUri Optional Grove URI for performance metadata storage
 * @returns { score, transcript, rating, performanceId, error, isGrading }
 */
export interface GradingResult {
  score: number // 0-100 (percentage)
  transcript: string
  rating: 'Easy' | 'Good' | 'Hard' | 'Again' // FSRS rating
  performanceId: number // uint256 from Lit Action
  txHash?: string // Transaction hash if submitted to contract via PKP
  errorType?: string // Error message if submission failed
}

export function useLitActionGrader() {
  const { pkpAuthContext, pkpInfo } = useAuth()

  const [isGrading, setIsGrading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const grade = useCallback(
    async (
      userAudioBase64: string,
      _referenceAudioUri: string,  // Reference audio URI for future use
      expectedText: string,
      segmentHash: string,
      metadataUri?: string,  // Optional Grove URI for storage
      lineId?: string,  // UUID from karaoke_lines table
      lineIndex?: number  // Position within segment (0-based)
    ): Promise<GradingResult | null> => {
      try {
        setError(null)
        setIsGrading(true)

        if (!pkpAuthContext || !pkpInfo) {
          throw new Error('PKP not ready')
        }

        // Execute deployed Lit Action via IPFS CID
        const { getLitClient } = await import('@/lib/lit')
        const litClient = await getLitClient()

        console.log('[useLitActionGrader] Executing Lit Action:', LIT_ACTION_IPFS_CID)
        console.log('[useLitActionGrader] User address:', pkpInfo.ethAddress)
        console.log('[useLitActionGrader] Segment hash:', segmentHash)

        // Pass encrypted Voxtral API key from addresses.ts
        // Key is encrypted for this specific Lit Action CID
        const result = await litClient.executeJs({
          ipfsId: LIT_ACTION_IPFS_CID,
          authContext: pkpAuthContext,
          jsParams: {
            userAddress: pkpInfo.ethAddress,
            segmentHash,
            performanceId: Date.now(),
            audioDataBase64: userAudioBase64,  // Actual base64 audio data
            expectedText: expectedText,
            metadataUri: metadataUri || `grove://${Date.now()}`,  // Fallback if not provided
            language: 'en',
            voxtralEncryptedKey: LIT_ACTION_VOXTRAL_KEY,  // Pass encrypted key for decryption in Lit Action
            lineId: lineId || undefined,  // Already bytes32 from keccak256(spotifyTrackId-lineIndex)
            lineIndex: lineIndex ?? 0,  // Default to 0 for backward compatibility
          },
        })

        if (!result.response) {
          throw new Error('No response from Lit Action')
        }

        const response = typeof result.response === 'string' ? JSON.parse(result.response) : result.response

        if (!response.success) {
          throw new Error(response.errorType || 'Grading failed')
        }

        // Convert score to FSRS rating
        const rating = scoreToRating(response.score)

        console.log('[useLitActionGrader] Grading result:', {
          score: response.score,
          transcript: response.transcript,
          rating,
          txHash: response.txHash,
          errorType: response.errorType,
        })

        // Log transaction status
        if (response.txHash) {
          console.log('[useLitActionGrader] ✅ Transaction submitted:', response.txHash)
        } else if (response.errorType) {
          console.error('[useLitActionGrader] ❌ Transaction failed:', response.errorType)
        } else {
          console.warn('[useLitActionGrader] ⚠️  No transaction hash returned (test mode or error)')
        }

        const gradingResult: GradingResult = {
          score: response.score,
          transcript: response.transcript,
          rating,
          performanceId: response.performanceId,
          txHash: response.txHash,  // Pass transaction hash through
          errorType: response.errorType,  // Pass any transaction errors
        }

        setIsGrading(false)
        return gradingResult
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Grading failed')
        setError(error)
        console.error('[useLitActionGrader] Grading error:', error)
        setIsGrading(false)
        return null
      }
    },
    [pkpAuthContext, pkpInfo]
  )

  return { grade, isGrading, error }
}

/**
 * Convert pronunciation score (0-100) to FSRS rating (0-3)
 *
 * Thresholds:
 * - 90-100: Easy (3) - Excellent pronunciation
 * - 75-89:  Good (2) - Good pronunciation with minor errors
 * - 60-74:  Hard (1) - Difficult, many errors but recognizable
 * - 0-59:   Again (0) - Failed, not recognizable
 */
function scoreToRating(score: number): 'Easy' | 'Good' | 'Hard' | 'Again' {
  if (score >= 90) return 'Easy'
  if (score >= 75) return 'Good'
  if (score >= 60) return 'Hard'
  return 'Again'
}

/**
 * Helper to emit PerformanceGraded event to contract
 *
 * TODO: Use PKP wallet client to call PerformanceGrader.gradePerformance()
 */
export async function emitPerformanceGraded(
  walletClient: any,
  performanceGraderAddress: string,
  performanceId: number,
  segmentHash: string,
  performer: string,
  score: number,
  metadataUri: string
): Promise<string | null> {
  try {
    // TODO: Convert to proper viem types
    const tx = await walletClient.writeContract({
      address: performanceGraderAddress,
      abi: [
        {
          name: 'gradePerformance',
          type: 'function',
          inputs: [
            { name: 'performanceId', type: 'uint256' },
            { name: 'segmentHash', type: 'bytes32' },
            { name: 'performer', type: 'address' },
            { name: 'score', type: 'uint16' },
            { name: 'metadataUri', type: 'string' },
          ],
        },
      ],
      functionName: 'gradePerformance',
      args: [
        performanceId,
        segmentHash,
        performer,
        Math.round(score * 100), // Convert to basis points (75 -> 7500)
        metadataUri,
      ],
    })

    console.log('[emitPerformanceGraded] Event emitted, tx:', tx)
    return tx
  } catch (error) {
    console.error('[emitPerformanceGraded] Failed to emit event:', error)
    return null
  }
}
