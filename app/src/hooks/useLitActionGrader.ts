import { useCallback, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  LIT_ACTION_IPFS_CID,
  LIT_ACTION_VOXTRAL_KEY,
} from '@/lib/contracts/addresses'
import { createPublicClient, http, parseAbi } from 'viem'
import { lensTestnet } from '@/lib/lit/signer-pkp'

/**
 * Exercise Grader v1 - Grading for exercise types
 *
 * Supports:
 * - SAY_IT_BACK: Voice transcription + pronunciation scoring
 * - TRANSLATION_QUIZ: Multiple choice translation questions
 * - TRIVIA_QUIZ: Multiple choice trivia questions
 *
 * Note: Karaoke line-by-line grading uses useLineKaraokeGrader instead.
 */

// Parameter types for each exercise type
export interface SayItBackGradingParams {
  exerciseType: 'SAY_IT_BACK'
  audioDataBase64: string
  expectedText: string
  lineId: string
  lineIndex: number
  segmentHash: string
  metadataUri: string
}

export interface MultipleChoiceGradingParams {
  exerciseType: 'TRANSLATION_QUIZ' | 'TRIVIA_QUIZ'
  attemptId: number
  questionId: string
  userAnswer: string | number
  correctAnswer: string | number
  metadataUri: string
}

export type GradingParams = SayItBackGradingParams | MultipleChoiceGradingParams

export interface GradingResult {
  score: number // 0-100 (percentage)
  transcript?: string // Only for SAY_IT_BACK
  rating: 'Easy' | 'Good' | 'Hard' | 'Again' | string // FSRS rating
  performanceId: number // uint256 from Lit Action
  txHash?: string // Transaction hash if submitted to contract
  errorType?: string // Error message if submission failed
}

export function useLitActionGrader() {
  const { pkpAuthContext, pkpInfo } = useAuth()
  const [isGrading, setIsGrading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const grade = useCallback(
    async (params: GradingParams): Promise<GradingResult | null> => {
      try {
        setError(null)
        setIsGrading(true)

        if (!pkpAuthContext || !pkpInfo) {
          throw new Error('PKP not ready')
        }

        const { getLitClient } = await import('@/lib/lit')
        const litClient = await getLitClient()

        console.log('[useLitActionGrader] Executing Lit Action:', LIT_ACTION_IPFS_CID)
        console.log('[useLitActionGrader] Exercise type:', params.exerciseType)
        console.log('[useLitActionGrader] User address:', pkpInfo.ethAddress)

        // Build jsParams based on exercise type
        const jsParams: Record<string, any> = {
          exerciseType: params.exerciseType,
          userAddress: pkpInfo.ethAddress,
          metadataUri: params.metadataUri,
          testMode: false, // Always use real contract submission
        }

        if (params.exerciseType === 'SAY_IT_BACK') {
          // SAY_IT_BACK specific parameters
          jsParams.audioDataBase64 = params.audioDataBase64
          jsParams.expectedText = params.expectedText
          jsParams.lineId = params.lineId
          jsParams.lineIndex = params.lineIndex
          jsParams.segmentHash = params.segmentHash
          jsParams.attemptId = Date.now()
          jsParams.language = 'en'
          jsParams.voxtralEncryptedKey = LIT_ACTION_VOXTRAL_KEY

          // Fetch deterministic nonce to prevent collisions
          try {
            console.log('[useLitActionGrader] Fetching deterministic nonce for SAY_IT_BACK...');
            const publicClient = createPublicClient({
              chain: lensTestnet,
              transport: http()
            });

            // Get Trusted PKP from ExerciseEvents contract
            const EXERCISE_EVENTS_ADDRESS = '0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832';
            const trustedPKP = await publicClient.readContract({
              address: EXERCISE_EVENTS_ADDRESS as `0x${string}`,
              abi: parseAbi(['function trustedPKP() external view returns (address)']),
              functionName: 'trustedPKP',
              authorizationList: undefined,
            });

            // Get pending nonce for that PKP
            const nonce = await publicClient.getTransactionCount({
              address: trustedPKP,
              blockTag: 'pending'
            });

            console.log(`[useLitActionGrader] Resolved PKP: ${trustedPKP}, Nonce: ${nonce}`);
            jsParams.nonceOverride = Number(nonce);
          } catch (err) {
            console.warn('[useLitActionGrader] Failed to fetch deterministic nonce:', err);
            // Fallback to Lit Action internal handling
          }

          console.log('[useLitActionGrader] SAY_IT_BACK params:', {
            lineId: params.lineId,
            lineIndex: params.lineIndex,
            segmentHash: params.segmentHash,
            audioSize: params.audioDataBase64.length,
            nonceOverride: jsParams.nonceOverride
          })
        } else {
          // Multiple choice specific parameters
          jsParams.attemptId = params.attemptId
          jsParams.questionId = params.questionId
          jsParams.userAnswer = params.userAnswer
          jsParams.correctAnswer = params.correctAnswer

          // Fetch deterministic nonce to prevent collisions
          try {
            console.log('[useLitActionGrader] Fetching deterministic nonce for MULTIPLE_CHOICE...');
            const publicClient = createPublicClient({
              chain: lensTestnet,
              transport: http()
            });

            // Get Trusted PKP from ExerciseEvents contract
            const EXERCISE_EVENTS_ADDRESS = '0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832';
            const trustedPKP = await publicClient.readContract({
              address: EXERCISE_EVENTS_ADDRESS as `0x${string}`,
              abi: parseAbi(['function trustedPKP() external view returns (address)']),
              functionName: 'trustedPKP',
              authorizationList: undefined,
            });

            // Get pending nonce for that PKP
            const nonce = await publicClient.getTransactionCount({
              address: trustedPKP,
              blockTag: 'pending'
            });

            console.log(`[useLitActionGrader] Resolved PKP: ${trustedPKP}, Nonce: ${nonce}`);
            jsParams.nonceOverride = Number(nonce);
          } catch (err) {
            console.warn('[useLitActionGrader] Failed to fetch deterministic nonce:', err);
            // Fallback to Lit Action internal handling
          }

          console.log('[useLitActionGrader] Multiple choice params:', {
            questionId: params.questionId,
            userAnswer: params.userAnswer,
            correctAnswer: params.correctAnswer,
            nonceOverride: jsParams.nonceOverride
          })
        }

        const result = await withTimeout(
          litClient.executeJs({
            ipfsId: LIT_ACTION_IPFS_CID,
            authContext: pkpAuthContext,
            jsParams,
          }),
          30_000,
          'Lit Action execution timed out'
        )

        if (!result.response) {
          throw new Error('No response from Lit Action')
        }

        console.log('[useLitActionGrader] Raw Lit response:', result.response)

        const response = typeof result.response === 'string'
          ? JSON.parse(result.response)
          : result.response

        if (!response.success) {
          console.error('[useLitActionGrader] Lit Action returned error:', {
            errorType: response.errorType,
            error: response.error,
            logs: result.logs, // Log any console.log output from inside the Lit Action
            fullResponse: response
          })
          throw new Error(response.errorType || response.error || 'Grading failed')
        }

        // Exercise grader returns score (0-100) + rating.
        const normalizedScore = normalizeScore(response)
        const rating =
          response.rating ||
          response.grade ||
          scoreToRating(typeof normalizedScore === 'number' ? normalizedScore : 0)
        const performanceId =
          typeof response.performanceId === 'string'
            ? Number(response.performanceId)
            : response.performanceId || response.attemptId || Date.now()

        // Use rating from response, or convert score to rating as fallback
        console.log('[useLitActionGrader] Grading result:', {
          score: normalizedScore,
          rating,
          txHash: response.txHash,
          errorType: response.errorType,
        })

        // Log transaction status
        if (response.txHash) {
          console.log('[useLitActionGrader] ✅ Transaction submitted:', response.txHash)
          console.log('[useLitActionGrader] Explorer:', `https://explorer.testnet.lens.xyz/tx/${response.txHash}`)
        } else if (response.errorType) {
          console.error('[useLitActionGrader] ❌ Transaction failed:', response.errorType)
        } else {
          console.warn('[useLitActionGrader] ⚠️  No transaction hash returned')
        }

        const gradingResult: GradingResult = {
          score: normalizedScore ?? 0,
          transcript: response.transcript,
          rating,
          performanceId: typeof performanceId === 'number' && !Number.isNaN(performanceId) ? performanceId : Date.now(),
          txHash: response.txHash,
          errorType: response.errorType,
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
 * - 90-100: Easy (3) - Excellent
 * - 75-89:  Good (2) - Good with minor errors
 * - 60-74:  Hard (1) - Difficult but recognizable
 * - 0-59:   Again (0) - Failed
 */
function scoreToRating(score: number): 'Easy' | 'Good' | 'Hard' | 'Again' {
  if (score >= 90) return 'Easy'
  if (score >= 75) return 'Good'
  if (score >= 60) return 'Hard'
  return 'Again'
}

/**
 * Normalize Lit Action score outputs.
 * Exercise grader returns score (0-100).
 */
function normalizeScore(response: any): number | undefined {
  if (typeof response?.score === 'number') {
    return response.score
  }
  return undefined
}

function withTimeout<T>(value: Promise<T> | T, ms: number, message: string): Promise<T> {
  // If value is already resolved (non-promise), wrap in a resolved promise.
  const valuePromise = value instanceof Promise ? value : Promise.resolve(value)

  let timer: ReturnType<typeof setTimeout> | null = null

  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message))
    }, ms)
  })

  return Promise.race([
    valuePromise.then((result) => {
      if (timer) clearTimeout(timer)
      return result
    }).catch((err) => {
      if (timer) clearTimeout(timer)
      throw err
    }),
    timeoutPromise,
  ])
}
