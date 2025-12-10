/**
 * Karaoke Line Grader Hook
 *
 * Executes Lit Actions for line-by-line karaoke grading.
 * Used by useKaraokeLineSession for real-time grading during karaoke practice.
 */

import { createSignal, createEffect } from 'solid-js'
import { createPublicClient, http } from 'viem'
import { useAuth } from '@/contexts/AuthContext'
import {
  LIT_KARAOKE_LINE_CID,
  LIT_KARAOKE_LINE_DEEPINFRA_KEY,
  EXERCISE_EVENTS_PKP_ADDRESS,
} from '@/lib/contracts/addresses'
import { lensTestnet } from '@/lib/lit/signer-pkp'
import { SUBGRAPH_URL } from '@/lib/graphql/client'
import type { GradeLineParams, GradeLineResult } from './useKaraokeLineSession'

// ============================================================
// NONCE COORDINATION
// ============================================================
// Global nonce tracker to prevent race conditions across concurrent grading calls.
// Each karaoke line grades in parallel, so we must reserve nonces upfront.

let lastKnownNonce: number | null = null
let lastNonceTimestamp = 0
const NONCE_CACHE_TTL_MS = 10_000 // 10 seconds - nonce cache expires after this

/**
 * Reserve nonces for a grading call.
 * Returns the starting nonce and updates the global tracker.
 *
 * @param txCount Number of transactions this call will emit:
 *   - First line (startSession=true): 2 txs (start + grade)
 *   - Middle lines: 1 tx (grade)
 *   - End-only call: 1 tx (end)
 */
async function reserveNonces(txCount: number): Promise<number | null> {
  try {
    const publicClient = createPublicClient({
      chain: lensTestnet,
      transport: http(),
    })

    // Get pending nonce for the PKP that signs karaoke transactions
    // (same PKP used by exercise grader)
    const chainNonce = await publicClient.getTransactionCount({
      address: EXERCISE_EVENTS_PKP_ADDRESS as `0x${string}`,
      blockTag: 'pending',
    })

    // Optimistic nonce: use max of chain nonce or our tracked nonce
    const now = Date.now()
    let startNonce = Number(chainNonce)

    if (lastKnownNonce !== null && (now - lastNonceTimestamp) < NONCE_CACHE_TTL_MS) {
      // Use our tracked nonce if it's higher (we know txs are in flight)
      if (lastKnownNonce >= startNonce) {
        startNonce = lastKnownNonce
      }
    }

    // Reserve the block of nonces for this call
    lastKnownNonce = startNonce + txCount
    lastNonceTimestamp = now

    console.log(`[useLineKaraokeGrader] Reserved nonces ${startNonce}-${startNonce + txCount - 1} (chain=${chainNonce}, txCount=${txCount})`)
    return startNonce
  } catch (err) {
    console.warn('[useLineKaraokeGrader] Failed to reserve nonces:', err)
    return null // Fallback to Lit Action internal handling
  }
}

/**
 * Update nonce tracker from error message.
 * Called when we get "nonce too low" errors to recover.
 */
function updateNonceFromError(errorMessage: string): void {
  const nonceMatch = errorMessage.match(/allowed nonce range: (\d+)/)
  if (nonceMatch) {
    const correctNonce = parseInt(nonceMatch[1], 10)
    console.log(`[useLineKaraokeGrader] Updating nonce tracker to ${correctNonce} from error`)
    lastKnownNonce = correctNonce
    lastNonceTimestamp = Date.now()
  }
}

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
  const auth = useAuth()
  const [isGrading, setIsGrading] = createSignal(false)
  const [error, setError] = createSignal<Error | null>(null)
  const [isReady, setIsReady] = createSignal(false)
  const [configError, setConfigError] = createSignal<string | null>(null)

  // Validate configuration on mount
  createEffect(() => {
    if (!validateOnMount) {
      setIsReady(true)
      return
    }

    if (!LIT_KARAOKE_LINE_CID) {
      setConfigError('Karaoke line grader not configured. Set VITE_KARAOKE_LINE_CID environment variable.')
      setIsReady(false)
      return
    }

    if (!LIT_KARAOKE_LINE_DEEPINFRA_KEY) {
      setConfigError('DeepInfra key not configured for line grader.')
      setIsReady(false)
      return
    }

    setConfigError(null)
    setIsReady(true)
  })

  const gradeLine = async (params: GradeLineParams): Promise<LineGradeResult | null> => {
    const pkpAuthContext = auth.pkpAuthContext()
    const pkpInfo = auth.pkpInfo()

    if (!pkpAuthContext || !pkpInfo) {
      setError(new Error('PKP not ready - please authenticate first'))
      return null
    }

    if (!LIT_KARAOKE_LINE_CID) {
      setError(new Error('Karaoke line Lit Action CID not configured (set VITE_KARAOKE_LINE_CID)'))
      return null
    }

    if (!LIT_KARAOKE_LINE_DEEPINFRA_KEY) {
      setError(new Error('Missing encrypted DeepInfra key for line grader'))
      return null
    }

    try {
      setIsGrading(true)
      setError(null)

      const { getLitClient } = await import('@/lib/lit')
      const litClient = await getLitClient()

      // Calculate how many txs this call will emit for nonce reservation
      const isEndOnly = params.endOnly ?? false
      const txCount = isEndOnly
        ? 1 // end-only: just endSession tx
        : (params.startSession ? 2 : 1) // first line: start + grade, others: just grade

      // Reserve nonces before starting Lit Action (prevents race conditions)
      const nonceOverride = params.skipTx ? null : await reserveNonces(txCount)

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
        voxtralEncryptedKey: LIT_KARAOKE_LINE_DEEPINFRA_KEY,
        // End-only mode: skip line grading, just emit endSession
        endOnly: isEndOnly,
        // Deterministic nonce override (prevents race conditions)
        nonceOverride,
      }

      const sessionFlags = [
        params.startSession && 'start',
        params.endSession && 'end',
      ].filter(Boolean).join('+')

      console.log(`[useLineKaraokeGrader] Line ${params.lineIndex}${sessionFlags ? ` (${sessionFlags})` : ''} → session ${params.sessionId.slice(0, 10)}... CID=${LIT_KARAOKE_LINE_CID.slice(0, 12)} endSession=${params.endSession} endOnly=${params.endOnly ?? false}`)

      const litStart = performance.now()
      const result = await withTimeout(
        litClient.executeJs({
          ipfsId: LIT_KARAOKE_LINE_CID,
          authContext: pkpAuthContext,
          jsParams,
        }),
        45_000, // Increased timeout for blockchain tx
        'Lit Action execution timed out'
      )
      const litEnd = performance.now()
      console.log(`[useLineKaraokeGrader] Line ${params.lineIndex}: executeJs completed in ${((litEnd - litStart) / 1000).toFixed(2)}s`)

      if (!result.response) {
        throw new Error('Lit Action returned empty response')
      }

      const response = typeof result.response === 'string'
        ? JSON.parse(result.response)
        : result.response

      // Log internal Lit Action metrics if available
      if (response?.metrics?.phases) {
        console.log(`[useLineKaraokeGrader] Line ${params.lineIndex} phases:`, response.metrics.phases.map((p: {phase: string, ms: number}) => `${p.phase}:${p.ms}ms`).join(' → '))
      }

      if (!response?.success) {
        const errMsg = response?.error || response?.errorType || 'Line grading failed'
        throw new Error(errMsg)
      }

      const scoreBp = Number(response.scoreBp || 0)
      const rating = ratingLabel(Number(response.rating))

      const txs = [
        response.startTxHash && 'start',
        response.lineTxHash && 'line',
        response.endTxHash && 'end',
      ].filter(Boolean).join('+')

      console.log(`[useLineKaraokeGrader] Line ${params.lineIndex}: ${scoreBp / 100}% (${rating})${txs ? ` [tx: ${txs}]` : ''}`)

      // Log transcript comparison for debugging
      if (response.transcript !== undefined || response.expectedText !== undefined) {
        console.log(`[useLineKaraokeGrader] Line ${params.lineIndex} transcript: "${response.transcript || '(empty)'}"`)
        console.log(`[useLineKaraokeGrader] Line ${params.lineIndex} expected:   "${response.expectedText || '(empty)'}"`)
      }

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

      // Try to recover nonce tracker from error message
      updateNonceFromError(error.message)

      setError(error)
      return null
    } finally {
      setIsGrading(false)
    }
  }

  return {
    gradeLine,
    isGrading,
    error,
    isReady,
    configError,
    /** Whether the PKP is authenticated and ready for grading */
    isPKPReady: () => Boolean(auth.pkpAuthContext() && auth.pkpInfo()),
  }
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
