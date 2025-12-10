import { createSignal } from 'solid-js'
import { useAuth } from '@/contexts/AuthContext'
import {
  LIT_ACTION_IPFS_CID,
  LIT_ACTION_VOXTRAL_KEY,
  EXERCISE_EVENTS_ADDRESS,
} from '@/lib/contracts/addresses'
import { createPublicClient, http, parseAbi } from 'viem'
import { lensTestnet } from '@/lib/lit/signer-pkp'

// Global nonce tracker to prevent race conditions across concurrent grading calls
let lastKnownNonce: number | null = null
let lastNonceTimestamp = 0
const NONCE_CACHE_TTL_MS = 10_000 // 10 seconds - nonce cache expires after this

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
  const auth = useAuth()
  const [isGrading, setIsGrading] = createSignal(false)
  const [error, setError] = createSignal<Error | null>(null)

  const grade = async (params: GradingParams): Promise<GradingResult | null> => {
    try {
      setError(null)
      setIsGrading(true)

      const pkpAuthContext = auth.pkpAuthContext()
      const pkpInfo = auth.pkpInfo()

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
        await fetchAndSetNonce(jsParams)

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
        await fetchAndSetNonce(jsParams)

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
          logs: result.logs,
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

      console.log('[useLitActionGrader] Grading result:', {
        score: normalizedScore,
        rating,
        txHash: response.txHash,
        errorType: response.errorType,
      })

      // Log transaction status and update nonce tracker
      if (response.txHash) {
        console.log('[useLitActionGrader] ✅ Transaction submitted:', response.txHash)
        console.log('[useLitActionGrader] Explorer:', `https://explorer.testnet.lens.xyz/tx/${response.txHash}`)
      } else if (response.errorType) {
        console.error('[useLitActionGrader] ❌ Transaction failed:', response.errorType)

        // If we got a "nonce too low" error, extract the allowed nonce and update our tracker
        const nonceMatch = response.errorType.match(/allowed nonce range: (\d+)/)
        if (nonceMatch) {
          const correctNonce = parseInt(nonceMatch[1], 10)
          console.log(`[useLitActionGrader] Updating nonce tracker to ${correctNonce} based on error`)
          lastKnownNonce = correctNonce
          lastNonceTimestamp = Date.now()
        }
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
  }

  return { grade, isGrading, error }
}

/**
 * Fetch deterministic nonce for PKP transactions
 */
async function fetchAndSetNonce(jsParams: Record<string, any>) {
  try {
    console.log('[useLitActionGrader] Fetching deterministic nonce...')
    const publicClient = createPublicClient({
      chain: lensTestnet,
      transport: http()
    })

    // Get Trusted PKP from ExerciseEvents contract
    const trustedPKP = await publicClient.readContract({
      address: EXERCISE_EVENTS_ADDRESS as `0x${string}`,
      abi: parseAbi(['function trustedPKP() external view returns (address)']),
      functionName: 'trustedPKP',
    })

    // Get pending nonce for that PKP
    const chainNonce = await publicClient.getTransactionCount({
      address: trustedPKP,
      blockTag: 'pending'
    })

    // Optimistic nonce: use max of chain nonce or our tracked nonce + 1
    const now = Date.now()
    let nonce = Number(chainNonce)

    if (lastKnownNonce !== null && (now - lastNonceTimestamp) < NONCE_CACHE_TTL_MS) {
      const optimisticNonce = lastKnownNonce + 1
      if (optimisticNonce > nonce) {
        console.log(`[useLitActionGrader] Using optimistic nonce ${optimisticNonce} (chain says ${nonce})`)
        nonce = optimisticNonce
      }
    }

    lastKnownNonce = nonce
    lastNonceTimestamp = now

    console.log(`[useLitActionGrader] Resolved PKP: ${trustedPKP}, Nonce: ${nonce}`)
    jsParams.nonceOverride = nonce
  } catch (err) {
    console.warn('[useLitActionGrader] Failed to fetch deterministic nonce:', err)
    // Fallback to Lit Action internal handling
  }
}

/**
 * Convert pronunciation score (0-100) to FSRS rating (0-3)
 */
function scoreToRating(score: number): 'Easy' | 'Good' | 'Hard' | 'Again' {
  if (score >= 90) return 'Easy'
  if (score >= 75) return 'Good'
  if (score >= 60) return 'Hard'
  return 'Again'
}

/**
 * Normalize Lit Action score outputs.
 */
function normalizeScore(response: any): number | undefined {
  if (typeof response?.score === 'number') {
    return response.score
  }
  return undefined
}

function withTimeout<T>(value: Promise<T> | T, ms: number, message: string): Promise<T> {
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
