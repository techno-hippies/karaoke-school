import { useCallback, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LIT_ACTION_IPFS_CID, LIT_ACTION_VOXTRAL_KEY } from '@/lib/contracts/addresses'

/**
 * Exercise Grader v1 - Unified grading for all exercise types
 *
 * Supports:
 * - SAY_IT_BACK: Voice transcription + pronunciation scoring
 * - TRANSLATION_QUIZ: Multiple choice translation questions
 * - TRIVIA_QUIZ: Multiple choice trivia questions
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
  rating: 'Easy' | 'Good' | 'Hard' | 'Again' // FSRS rating
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

          console.log('[useLitActionGrader] SAY_IT_BACK params:', {
            lineId: params.lineId,
            lineIndex: params.lineIndex,
            segmentHash: params.segmentHash,
            audioSize: params.audioDataBase64.length,
          })
        } else {
          // Multiple choice specific parameters
          jsParams.attemptId = params.attemptId
          jsParams.questionId = params.questionId
          jsParams.userAnswer = params.userAnswer
          jsParams.correctAnswer = params.correctAnswer

          console.log('[useLitActionGrader] Multiple choice params:', {
            questionId: params.questionId,
            userAnswer: params.userAnswer,
            correctAnswer: params.correctAnswer,
          })
        }

        const result = await litClient.executeJs({
          ipfsId: LIT_ACTION_IPFS_CID,
          authContext: pkpAuthContext,
          jsParams,
        })

        if (!result.response) {
          throw new Error('No response from Lit Action')
        }

        const response = typeof result.response === 'string'
          ? JSON.parse(result.response)
          : result.response

        if (!response.success) {
          console.error('[useLitActionGrader] Lit Action returned error:', {
            errorType: response.errorType,
            error: response.error,
            fullResponse: response
          })
          throw new Error(response.errorType || response.error || 'Grading failed')
        }

        // Use rating from response, or convert score to rating as fallback
        const rating = response.rating || scoreToRating(response.score)

        console.log('[useLitActionGrader] Grading result:', {
          score: response.score,
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
          score: response.score,
          transcript: response.transcript,
          rating,
          performanceId: response.performanceId || response.attemptId || Date.now(),
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
