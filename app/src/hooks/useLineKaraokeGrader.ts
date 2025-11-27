import { useCallback, useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getLitClient } from '@/lib/lit'
import { LIT_KARAOKE_LINE_CID, LIT_KARAOKE_LINE_VOXTRAL_KEY } from '@/lib/contracts/addresses'
import { SUBGRAPH_URL } from '@/lib/graphql/client'
import { withTimeout } from '@/lib/with-timeout'
import type { GradeLineParams, GradeLineResult } from '@/hooks/useKaraokeLineSession'

export interface LineGradeResult extends GradeLineResult {
  // Alias for backwards compatibility
}

const ratingLabel = (r: number): LineGradeResult['rating'] => {
  if (r >= 3) return 'Easy'
  if (r >= 2) return 'Good'
  if (r >= 1) return 'Hard'
  return 'Again'
}

export interface UseLineKaraokeGraderOptions {
  /** Whether the CID is properly configured - if false, component should show error */
  validateOnMount?: boolean
}

export function useLineKaraokeGrader(options: UseLineKaraokeGraderOptions = {}) {
  const { validateOnMount = true } = options
  const { pkpAuthContext, pkpInfo } = useAuth()
  const [isGrading, setIsGrading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)

  // Validate configuration on mount
  useEffect(() => {
    if (!validateOnMount) {
      setIsReady(true)
      return
    }

    if (!LIT_KARAOKE_LINE_CID) {
      setConfigError('Karaoke line grader not configured. Set VITE_KARAOKE_LINE_CID environment variable.')
      setIsReady(false)
      return
    }

    if (!LIT_KARAOKE_LINE_VOXTRAL_KEY) {
      setConfigError('Voxtral key not configured for line grader. Set LIT_KARAOKE_LINE_VOXTRAL_KEY.')
      setIsReady(false)
      return
    }

    setConfigError(null)
    setIsReady(true)
  }, [validateOnMount])

  const gradeLine = useCallback(async (params: GradeLineParams): Promise<LineGradeResult | null> => {
    if (!pkpAuthContext || !pkpInfo) {
      setError(new Error('PKP not ready - please authenticate first'))
      return null
    }

    if (!LIT_KARAOKE_LINE_CID) {
      setError(new Error('Karaoke line Lit Action CID not configured (set VITE_KARAOKE_LINE_CID)'))
      return null
    }

    if (!LIT_KARAOKE_LINE_VOXTRAL_KEY) {
      setError(new Error('Missing encrypted Voxtral key for line grader'))
      return null
    }

    try {
      setIsGrading(true)
      setError(null)

      const litClient = await getLitClient()

      // Use the sessionId passed from the session hook - DO NOT generate a new one
      const jsParams: Record<string, unknown> = {
        sessionId: params.sessionId,
        clipHash: params.clipHash,
        performer: pkpInfo.ethAddress,
        lineIndex: params.lineIndex,
        expectedLineCount: params.expectedLineCount,
        // Session lifecycle flags - controlled by session hook
        startSession: params.startSession,
        endSession: params.endSession,
        sessionCompleted: params.sessionCompleted,
        // Audio data
        audioDataBase64: params.audioDataBase64,
        // Optional overrides
        subgraphUrl: SUBGRAPH_URL,
        metadataUriOverride: params.metadataUriOverride,
        skipTx: params.skipTx ?? false,
        testMode: false,
        // Encrypted API key
        voxtralEncryptedKey: LIT_KARAOKE_LINE_VOXTRAL_KEY,
      }

      console.log(`[useLineKaraokeGrader] Grading line ${params.lineIndex} in session ${params.sessionId.slice(0, 10)}...`, {
        startSession: params.startSession,
        endSession: params.endSession,
        skipTx: params.skipTx,
      })

      const result = await withTimeout(
        litClient.executeJs({
          ipfsId: LIT_KARAOKE_LINE_CID,
          authContext: pkpAuthContext,
          jsParams,
        }),
        45_000, // Increased timeout for blockchain tx
        'Lit Action execution timed out'
      )

      const response = typeof result.response === 'string'
        ? JSON.parse(result.response)
        : result.response

      if (!response?.success) {
        const errMsg = response?.error || response?.errorType || 'Line grading failed'
        throw new Error(errMsg)
      }

      const scoreBp = Number(response.scoreBp || 0)
      const rating = ratingLabel(Number(response.rating))

      console.log(`[useLineKaraokeGrader] Line ${params.lineIndex} graded: ${scoreBp / 100}% (${rating})`, {
        startTxHash: response.startTxHash,
        lineTxHash: response.lineTxHash,
        endTxHash: response.endTxHash,
      })

      return {
        score: Math.round(scoreBp / 100),
        scoreBp,
        rating,
        transcript: response.transcript,
        expectedText: response.expectedText,
        startTxHash: response.startTxHash,
        lineTxHash: response.lineTxHash,
        endTxHash: response.endTxHash,
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err))
      console.error(`[useLineKaraokeGrader] Line ${params.lineIndex} failed:`, error.message)
      setError(error)
      return null
    } finally {
      setIsGrading(false)
    }
  }, [pkpAuthContext, pkpInfo])

  return {
    gradeLine,
    isGrading,
    error,
    isReady,
    configError,
    /** Whether the PKP is authenticated and ready for grading */
    isPKPReady: Boolean(pkpAuthContext && pkpInfo),
  }
}
