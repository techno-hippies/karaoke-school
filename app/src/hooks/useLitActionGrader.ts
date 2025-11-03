import { useCallback, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LIT_ACTION_IPFS_CID } from '@/lib/contracts/addresses'

/**
 * Call deployed Lit Action to grade a karaoke performance
 *
 * Flow:
 * 1. Lit Action receives user audio + reference audio
 * 2. Transcribes user audio via Voxstral STT
 * 3. Calculates pronunciation score (Levenshtein distance)
 * 4. Converts score to FSRS rating
 * 5. Returns transcript + score + rating
 * 6. PKP signs PerformanceGrader transaction
 * 7. Emits PerformanceGraded event
 *
 * @param userAudioUri Grove URI of user's recording
 * @param referenceAudioUri Grove URI of instrumental/reference
 * @param expectedText Expected lyrics for scoring context
 * @returns { score, transcript, rating, txHash, error, isGrading }
 */
export interface GradingResult {
  score: number // 0-100 (percentage)
  transcript: string
  rating: 'Easy' | 'Good' | 'Hard' | 'Again' // FSRS rating
  performanceId: number // uint256 from Lit Action
  txHash?: string // If event was emitted
}

export function useLitActionGrader() {
  const { pkpAuthContext, pkpInfo } = useAuth()

  const [isGrading, setIsGrading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const grade = useCallback(
    async (
      userAudioUri: string,
      _referenceAudioUri: string,  // Reference audio URI for future use
      expectedText: string,
      segmentHash: string
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

        // Get and validate Voxstral API key
        const voxstralApiKey = import.meta.env.VITE_VOXSTRAL_API_KEY
        if (!voxstralApiKey) {
          throw new Error('Voxstral API key not configured in environment (VITE_VOXSTRAL_API_KEY)')
        }

        // Encrypt the API key with access control: only decrypt when running THIS Lit Action
        const encryptedParams = await litClient.encryptString(
          {
            accessControlConditions: [
              {
                conditionType: 'evmBasic',
                contractAddress: '',
                standardContractType: '',
                chain: 'ethereum',
                method: '',
                parameters: [':currentActionIpfsId'],
                returnValueTest: {
                  comparator: '=',
                  value: LIT_ACTION_IPFS_CID,
                },
              },
            ],
            toEncrypt: voxstralApiKey,
          }
        )

        const result = await litClient.executeJs({
          ipfsId: LIT_ACTION_IPFS_CID,
          authContext: pkpAuthContext,
          jsParams: {
            userAddress: pkpInfo.ethAddress,
            segmentHash,
            performanceId: Date.now(),
            audioDataBase64: userAudioUri,
            expectedText: expectedText,
            metadataUri: userAudioUri,
            language: 'en',
            // Encrypted API key (decrypted securely within Lit Action's TEE)
            accessControlConditions: encryptedParams.accessControlConditions,
            ciphertext: encryptedParams.ciphertext,
            dataToEncryptHash: encryptedParams.dataToEncryptHash,
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
        })

        const gradingResult: GradingResult = {
          score: response.score,
          transcript: response.transcript,
          rating,
          performanceId: response.performanceId,
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
